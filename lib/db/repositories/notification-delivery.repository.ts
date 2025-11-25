import { prisma } from "@/lib/db/prisma";
import { DeliveryStatus } from "@prisma/client";

export interface CreateDeliveryLogInput {
  notificationId: string;
  userId: string;
  wasConnected: boolean;
  connectionId?: string;
}

export interface NotificationDeliveryLog {
  id: string;
  notificationId: string;
  userId: string;
  createdAt: Date;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  status: DeliveryStatus;
  wasConnected: boolean;
  connectionId: string | null;
  sseError: string | null;
  latencyMs: number | null;
}

export interface DeliveryMetrics {
  total: number;
  delivered: number;
  failed: number;
  polled: number;
  pending: number;
  avgLatencyMs: number | null;
  maxLatencyMs: number | null;
  minLatencyMs: number | null;
}

export class NotificationDeliveryRepository {
  /**
   * Create a delivery log for a notification
   */
  async createDeliveryLog(
    data: CreateDeliveryLogInput
  ): Promise<NotificationDeliveryLog> {
    const deliveryLog = await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: data.notificationId,
        userId: data.userId,
        dispatchedAt: new Date(),
        wasConnected: data.wasConnected,
        connectionId: data.connectionId,
        status: DeliveryStatus.PENDING,
      },
    });

    return deliveryLog as NotificationDeliveryLog;
  }

  /**
   * Update delivery log status with optional error
   */
  async updateStatus(
    id: string,
    status: DeliveryStatus,
    options?: {
      error?: string;
      latencyMs?: number;
    }
  ): Promise<NotificationDeliveryLog> {
    const deliveryLog = await prisma.notificationDeliveryLog.update({
      where: { id },
      data: {
        status,
        sseError: options?.error,
        latencyMs: options?.latencyMs,
        deliveredAt:
          status === DeliveryStatus.DELIVERED || status === DeliveryStatus.POLLED
            ? new Date()
            : undefined,
      },
    });

    return deliveryLog as NotificationDeliveryLog;
  }

  /**
   * Mark delivery as delivered via SSE
   */
  async markAsDelivered(
    id: string,
    latencyMs?: number
  ): Promise<NotificationDeliveryLog> {
    return this.updateStatus(id, DeliveryStatus.DELIVERED, { latencyMs });
  }

  /**
   * Mark delivery as failed
   */
  async markAsFailed(
    id: string,
    error: string
  ): Promise<NotificationDeliveryLog> {
    return this.updateStatus(id, DeliveryStatus.FAILED, { error });
  }

  /**
   * Mark delivery as picked up via polling
   */
  async markAsPolled(id: string): Promise<NotificationDeliveryLog> {
    return this.updateStatus(id, DeliveryStatus.POLLED);
  }

  /**
   * Get pending deliveries for a user (for flush on reconnect)
   */
  async getPendingDeliveries(
    userId: string
  ): Promise<NotificationDeliveryLog[]> {
    const deliveryLogs = await prisma.notificationDeliveryLog.findMany({
      where: {
        userId,
        status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED] },
      },
      orderBy: { createdAt: "asc" },
    });

    return deliveryLogs as NotificationDeliveryLog[];
  }

  /**
   * Get delivery log by notification ID
   */
  async getByNotificationId(
    notificationId: string
  ): Promise<NotificationDeliveryLog | null> {
    const deliveryLog = await prisma.notificationDeliveryLog.findFirst({
      where: { notificationId },
      orderBy: { createdAt: "desc" },
    });

    return deliveryLog as NotificationDeliveryLog | null;
  }

  /**
   * Get delivery metrics for a time range
   */
  async getDeliveryMetrics(startTime: Date): Promise<DeliveryMetrics> {
    const [total, delivered, failed, polled, pending, latencyStats] =
      await Promise.all([
        prisma.notificationDeliveryLog.count({
          where: { createdAt: { gte: startTime } },
        }),
        prisma.notificationDeliveryLog.count({
          where: { createdAt: { gte: startTime }, status: DeliveryStatus.DELIVERED },
        }),
        prisma.notificationDeliveryLog.count({
          where: { createdAt: { gte: startTime }, status: DeliveryStatus.FAILED },
        }),
        prisma.notificationDeliveryLog.count({
          where: { createdAt: { gte: startTime }, status: DeliveryStatus.POLLED },
        }),
        prisma.notificationDeliveryLog.count({
          where: { createdAt: { gte: startTime }, status: DeliveryStatus.PENDING },
        }),
        prisma.notificationDeliveryLog.aggregate({
          where: {
            createdAt: { gte: startTime },
            latencyMs: { not: null },
          },
          _avg: { latencyMs: true },
          _max: { latencyMs: true },
          _min: { latencyMs: true },
        }),
      ]);

    return {
      total,
      delivered,
      failed,
      polled,
      pending,
      avgLatencyMs: latencyStats._avg.latencyMs,
      maxLatencyMs: latencyStats._max.latencyMs,
      minLatencyMs: latencyStats._min.latencyMs,
    };
  }

  /**
   * Get recent delivery logs with notification details
   */
  async getRecentDeliveryLogs(
    options: {
      limit?: number;
      startTime?: Date;
      status?: DeliveryStatus;
    } = {}
  ): Promise<
    (NotificationDeliveryLog & {
      notification: {
        type: string;
        title: string;
      };
    })[]
  > {
    const { limit = 50, startTime, status } = options;

    const where: Record<string, unknown> = {};
    if (startTime) where.createdAt = { gte: startTime };
    if (status) where.status = status;

    const deliveryLogs = await prisma.notificationDeliveryLog.findMany({
      where,
      include: {
        notification: {
          select: {
            type: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return deliveryLogs as (NotificationDeliveryLog & {
      notification: { type: string; title: string };
    })[];
  }

  /**
   * Clean up old delivery logs (older than specified days)
   */
  async cleanupOldDeliveryLogs(olderThanDays: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await prisma.notificationDeliveryLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        status: { in: [DeliveryStatus.DELIVERED, DeliveryStatus.POLLED] },
      },
    });

    return result.count;
  }

  /**
   * Mark all pending deliveries as polled for a user
   * (Called when user fetches notifications via polling)
   */
  async markUserDeliveriesAsPolled(
    userId: string,
    notificationIds: string[]
  ): Promise<number> {
    const result = await prisma.notificationDeliveryLog.updateMany({
      where: {
        userId,
        notificationId: { in: notificationIds },
        status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED] },
      },
      data: {
        status: DeliveryStatus.POLLED,
        deliveredAt: new Date(),
      },
    });

    return result.count;
  }
}
