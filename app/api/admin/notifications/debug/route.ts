import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@/lib/auth/roles";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationDeliveryRepository } from "@/lib/db/repositories/notification-delivery.repository";
import { NotificationLogger } from "@/lib/notifications/notification-logger";
import { getConnectionStats, getActiveConnectionsCount } from "@/app/api/notifications/stream/route";

const userRepository = new UserRepository();
const deliveryRepository = new NotificationDeliveryRepository();

/**
 * GET /api/admin/notifications/debug - Get notification system debug information
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN can access debug information
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "1h"; // 1h, 24h, 7d

    // Calculate start time based on time range
    const now = new Date();
    let startTime: Date;
    switch (timeRange) {
      case "24h":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "1h":
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
    }

    // Get all debug information in parallel
    const [
      deliveryMetrics,
      recentDeliveryLogs,
      connectionStats,
      recentLogs,
    ] = await Promise.all([
      deliveryRepository.getDeliveryMetrics(startTime),
      deliveryRepository.getRecentDeliveryLogs({ limit: 50, startTime }),
      getConnectionStats(),
      NotificationLogger.getRecentLogs(100),
    ]);

    // Calculate delivery success rate
    const successRate = deliveryMetrics.total > 0
      ? ((deliveryMetrics.delivered + deliveryMetrics.polled) / deliveryMetrics.total * 100).toFixed(1)
      : "N/A";

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          timeRange,
          startTime: startTime.toISOString(),
          activeConnections: connectionStats.totalConnections,
          deliverySuccessRate: successRate + "%",
        },
        connections: {
          total: connectionStats.totalConnections,
          byUser: connectionStats.connectionsByUser,
          averageAgeMs: Math.round(connectionStats.averageAgeMs),
          details: connectionStats.connections.map(conn => ({
            ...conn,
            connectedAt: conn.connectedAt.toISOString(),
            lastHeartbeat: conn.lastHeartbeat.toISOString(),
          })),
        },
        deliveryMetrics: {
          total: deliveryMetrics.total,
          delivered: deliveryMetrics.delivered,
          failed: deliveryMetrics.failed,
          polled: deliveryMetrics.polled,
          pending: deliveryMetrics.pending,
          latency: {
            avg: deliveryMetrics.avgLatencyMs ? Math.round(deliveryMetrics.avgLatencyMs) : null,
            max: deliveryMetrics.maxLatencyMs,
            min: deliveryMetrics.minLatencyMs,
          },
        },
        recentDeliveries: recentDeliveryLogs.slice(0, 20).map(log => ({
          id: log.id,
          notificationId: log.notificationId,
          notificationType: log.notification?.type,
          notificationTitle: log.notification?.title,
          status: log.status,
          wasConnected: log.wasConnected,
          connectionId: log.connectionId,
          latencyMs: log.latencyMs,
          error: log.sseError,
          createdAt: log.createdAt.toISOString(),
          deliveredAt: log.deliveredAt?.toISOString() || null,
        })),
        pipelineLogs: recentLogs.slice(0, 50).map(log => ({
          timestamp: log.timestamp.toISOString(),
          level: log.level,
          event: log.event,
          notificationId: log.notificationId,
          userId: log.userId,
          connectionId: log.connectionId,
          latencyMs: log.latencyMs,
          error: log.error,
          metadata: log.metadata,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching notification debug info:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug information" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications/debug - Clean up old delivery logs
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN can clean up logs
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "7");

    const deletedCount = await deliveryRepository.cleanupOldDeliveryLogs(olderThanDays);

    // Also clear in-memory logs
    NotificationLogger.clearLogs();

    console.log("🧹 Notification debug cleanup completed:", {
      deletedCount,
      olderThanDays,
      clearedBy: user.email,
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} old delivery logs`,
      deletedCount,
    });
  } catch (error) {
    console.error("❌ Error cleaning up notification logs:", error);
    return NextResponse.json(
      { error: "Failed to clean up logs" },
      { status: 500 }
    );
  }
}
