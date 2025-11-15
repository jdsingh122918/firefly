import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";

const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Keep track of active connections
const connections = new Map<string, ReadableStreamDefaultController>();

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

    console.log("🔔 SSE connection established for user:", {
      userId: user.id,
      email: user.email,
    });

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Store connection for this user
        connections.set(user.id, controller);

        // Send initial connection confirmation
        const initialMessage = {
          type: "connected",
          data: {
            timestamp: new Date().toISOString(),
            message: "Real-time notifications connected",
          },
        };

        controller.enqueue(`data: ${JSON.stringify(initialMessage)}\n\n`);

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
              data: { timestamp: new Date().toISOString() },
            };
            controller.enqueue(`data: ${JSON.stringify(heartbeat)}\n\n`);
          } catch (error) {
            console.error(
              "❌ Heartbeat failed, cleaning up connection:",
              error,
            );
            clearInterval(heartbeatInterval);
            connections.delete(user.id);
          }
        }, 10000); // Send heartbeat every 10 seconds to prevent timeouts

        // Cleanup on client disconnect
        request.signal.addEventListener("abort", () => {
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
 * Utility function to send notifications to connected clients
 * This will be called by the notification dispatcher
 */
export function broadcastNotificationToUser(
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    isActionable?: boolean;
    actionUrl?: string;
    createdAt: Date;
  },
) {
  const controller = connections.get(userId);

  if (controller) {
    try {
      const message = {
        type: "notification",
        data: notification,
      };

      controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);

      console.log("🔔 Broadcasted notification to user:", {
        userId,
        notificationId: notification.id,
        type: notification.type,
      });
    } catch (error) {
      console.error("❌ Failed to broadcast notification:", error);
      // Remove failed connection
      connections.delete(userId);
    }
  }
}

/**
 * Utility function to update unread count for connected clients
 */
export function broadcastUnreadCountToUser(userId: string, count: number) {
  const controller = connections.get(userId);

  if (controller) {
    try {
      const message = {
        type: "unread_count",
        data: { count },
      };

      controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);

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
