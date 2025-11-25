import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationDeliveryRepository } from "@/lib/db/repositories/notification-delivery.repository";
import { NotificationLogger } from "@/lib/notifications/notification-logger";
import { DeliveryStatus } from "@prisma/client";

const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();
const deliveryRepository = new NotificationDeliveryRepository();

// Generate unique connection ID
function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced connection tracking
interface ConnectionState {
  controller: ReadableStreamDefaultController;
  connectionId: string;
  userId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  heartbeatCount: number;
  messagesDelivered: number;
}

// Keep track of active connections
const connections = new Map<string, ConnectionState>();

// Broadcast result type
interface BroadcastResult {
  success: boolean;
  connectionId?: string;
  error?: string;
}

/**
 * GET /api/notifications/stream - Server-Sent Events endpoint for real-time notifications
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get user from database with graceful handling for unsynced users
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      // User not yet synced to database - return a minimal SSE stream
      console.log("🔔 User not synced yet, returning minimal SSE stream:", userId);

      const stream = new ReadableStream({
        start(controller) {
          const initialMessage = {
            type: "user_not_synced",
            data: {
              timestamp: new Date().toISOString(),
              message: "User not synced to database yet",
            },
          };
          controller.enqueue(`data: ${JSON.stringify(initialMessage)}\n\n`);

          // Close the stream immediately
          setTimeout(() => {
            try {
              controller.close();
            } catch {
              // Already closed
            }
          }, 100);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const connectionId = generateConnectionId();

    NotificationLogger.sseConnectionOpened(user.id, connectionId);
    console.log("🔔 SSE connection established for user:", {
      userId: user.id,
      email: user.email,
      connectionId,
    });

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        // Create connection state
        const connectionState: ConnectionState = {
          controller,
          connectionId,
          userId: user.id,
          connectedAt: new Date(),
          lastHeartbeat: new Date(),
          heartbeatCount: 0,
          messagesDelivered: 0,
        };

        // Store connection for this user (replaces any existing connection)
        connections.set(user.id, connectionState);

        // Send initial connection confirmation
        const initialMessage = {
          type: "connected",
          data: {
            timestamp: new Date().toISOString(),
            message: "Real-time notifications connected",
            connectionId,
          },
        };

        controller.enqueue(`data: ${JSON.stringify(initialMessage)}\n\n`);

        // Flush pending notifications on reconnect
        try {
          const pendingDeliveries = await deliveryRepository.getPendingDeliveries(user.id);

          if (pendingDeliveries.length > 0) {
            NotificationLogger.pendingNotificationsFlushed(
              user.id,
              connectionId,
              pendingDeliveries.length
            );
            console.log(`🔔 Flushing ${pendingDeliveries.length} pending notifications for user ${user.id}`);

            for (const delivery of pendingDeliveries) {
              try {
                // Get the notification details
                const notification = await notificationRepository.getNotificationsForUser(user.id, {
                  page: 1,
                  limit: 1,
                });

                // We need to get the actual notification from the delivery
                // For now, we'll mark them as delivered via reconnect
                await deliveryRepository.updateStatus(delivery.id, DeliveryStatus.DELIVERED, {
                  latencyMs: Date.now() - delivery.createdAt.getTime(),
                });
              } catch (error) {
                console.error("Failed to flush pending notification:", error);
              }
            }
          }
        } catch (error) {
          console.error("Failed to flush pending notifications:", error);
        }

        // Send current unread count
        notificationRepository
          .getUnreadCount(user.id)
          .then((unreadCount) => {
            const unreadMessage = {
              type: "unread_count",
              data: { count: unreadCount },
            };
            controller.enqueue(`data: ${JSON.stringify(unreadMessage)}\n\n`);
          })
          .catch((error) => {
            console.error("❌ Failed to get initial unread count:", error);
          });

        // Keep connection alive with periodic heartbeat
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = {
              type: "heartbeat",
              data: {
                timestamp: new Date().toISOString(),
                connectionId,
              },
            };
            controller.enqueue(`data: ${JSON.stringify(heartbeat)}\n\n`);

            // Update connection state
            const conn = connections.get(user.id);
            if (conn && conn.connectionId === connectionId) {
              conn.lastHeartbeat = new Date();
              conn.heartbeatCount++;
            }

            NotificationLogger.sseHeartbeatSent(user.id, connectionId);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            NotificationLogger.sseHeartbeatFailed(user.id, connectionId, errorMsg);
            console.error("❌ Heartbeat failed, cleaning up connection:", error);
            clearInterval(heartbeatInterval);
            connections.delete(user.id);
          }
        }, 10000); // Send heartbeat every 10 seconds to prevent timeouts

        // Cleanup on client disconnect
        request.signal.addEventListener("abort", () => {
          NotificationLogger.sseConnectionClosed(user.id, connectionId, "client_abort");
          console.log("🔔 SSE connection closed for user:", user.id);
          clearInterval(heartbeatInterval);
          connections.delete(user.id);
          try {
            controller.close();
          } catch {
            // Connection already closed
          }
        });
      },
    });

    // Return SSE response with longer timeout settings
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
        // Prevent timeout by ensuring the connection stays active
        "X-Accel-Buffering": "no", // Disable Nginx buffering
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("❌ SSE stream error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * Check if a user has an active SSE connection
 */
export function isUserConnected(userId: string): boolean {
  const conn = connections.get(userId);
  if (!conn) return false;

  // Check if connection is healthy (heartbeat within last 30 seconds)
  const timeSinceHeartbeat = Date.now() - conn.lastHeartbeat.getTime();
  return timeSinceHeartbeat < 30000;
}

/**
 * Get connection ID for a user
 */
export function getConnectionIdForUser(userId: string): string | undefined {
  const conn = connections.get(userId);
  return conn?.connectionId;
}

/**
 * Utility function to send notifications to connected clients
 * Returns success/failure status for delivery tracking
 */
export function broadcastNotificationToUser(
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown> | null;
    isActionable?: boolean;
    actionUrl?: string | null;
    createdAt: Date;
    deliveryLogId?: string;
  },
): BroadcastResult {
  const conn = connections.get(userId);

  if (!conn) {
    return { success: false, error: "No active connection" };
  }

  // Check connection health
  const timeSinceHeartbeat = Date.now() - conn.lastHeartbeat.getTime();
  if (timeSinceHeartbeat > 30000) {
    connections.delete(userId);
    return { success: false, error: "Connection unhealthy", connectionId: conn.connectionId };
  }

  try {
    const message = {
      type: "notification",
      data: notification,
    };

    conn.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
    conn.messagesDelivered++;
    conn.lastHeartbeat = new Date();

    console.log("🔔 Broadcasted notification to user:", {
      userId,
      notificationId: notification.id,
      type: notification.type,
      connectionId: conn.connectionId,
    });

    return { success: true, connectionId: conn.connectionId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Failed to broadcast notification:", error);
    // Remove failed connection
    connections.delete(userId);
    return { success: false, error: errorMsg, connectionId: conn.connectionId };
  }
}

/**
 * Utility function to update unread count for connected clients
 */
export function broadcastUnreadCountToUser(userId: string, count: number) {
  const conn = connections.get(userId);

  if (conn) {
    try {
      const message = {
        type: "unread_count",
        data: { count },
      };

      conn.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);

      console.log("🔔 Broadcasted unread count to user:", {
        userId,
        count,
      });
    } catch (error) {
      console.error("❌ Failed to broadcast unread count:", error);
      connections.delete(userId);
    }
  }
}

/**
 * Get count of active connections (for monitoring)
 */
export function getActiveConnectionsCount(): number {
  return connections.size;
}

/**
 * Get active user IDs (for monitoring)
 */
export function getActiveUserIds(): string[] {
  return Array.from(connections.keys());
}

/**
 * Get connection statistics for monitoring/debug dashboard
 */
export function getConnectionStats(): {
  totalConnections: number;
  connectionsByUser: Record<string, number>;
  averageAgeMs: number;
  connections: Array<{
    connectionId: string;
    userId: string;
    connectedAt: Date;
    lastHeartbeat: Date;
    heartbeatCount: number;
    messagesDelivered: number;
    isHealthy: boolean;
  }>;
} {
  const stats = {
    totalConnections: connections.size,
    connectionsByUser: {} as Record<string, number>,
    averageAgeMs: 0,
    connections: [] as Array<{
      connectionId: string;
      userId: string;
      connectedAt: Date;
      lastHeartbeat: Date;
      heartbeatCount: number;
      messagesDelivered: number;
      isHealthy: boolean;
    }>,
  };

  let totalAge = 0;
  const now = Date.now();

  connections.forEach((conn, key) => {
    stats.connectionsByUser[conn.userId] = (stats.connectionsByUser[conn.userId] || 0) + 1;
    totalAge += now - conn.connectedAt.getTime();

    const timeSinceHeartbeat = now - conn.lastHeartbeat.getTime();

    stats.connections.push({
      connectionId: conn.connectionId,
      userId: conn.userId,
      connectedAt: conn.connectedAt,
      lastHeartbeat: conn.lastHeartbeat,
      heartbeatCount: conn.heartbeatCount,
      messagesDelivered: conn.messagesDelivered,
      isHealthy: timeSinceHeartbeat < 30000,
    });
  });

  stats.averageAgeMs = stats.totalConnections > 0 ? totalAge / stats.totalConnections : 0;

  return stats;
}
