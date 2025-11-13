import { prisma } from "@/lib/db/prisma";
import {
  Notification,
  NotificationPreferences,
  CreateNotificationInput,
  UpdateNotificationPreferencesInput,
  NotificationType,
  PaginatedResult,
} from "@/lib/types";
import { Prisma } from "@prisma/client";

export class NotificationRepository {
  /**
   * Create a new notification
   */
  async createNotification(
    data: CreateNotificationInput,
  ): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: (data.data || null) as Prisma.InputJsonValue,
        isActionable: data.isActionable || false,
        actionUrl: data.actionUrl || null,
        expiresAt: data.expiresAt || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return notification as Notification;
  }

  /**
   * Get notifications for a user with pagination
   */
  async getNotificationsForUser(
    userId: string,
    options: {
      isRead?: boolean;
      type?: NotificationType;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<PaginatedResult<Notification>> {
    const { isRead, type, page = 1, limit = 20 } = options;

    // Build where clause
    const where: Record<string, unknown> = {
      userId,
      // Filter out expired notifications
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    if (isRead !== undefined) where.isRead = isRead;
    if (type) where.type = type;

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: notifications as Notification[],
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const notification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return notification as Notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<void> {
    await prisma.notification.delete({
      where: { id },
    });
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  /**
   * Delete expired notifications
   */
  async deleteExpiredNotifications(): Promise<number> {
    const result = await prisma.notification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Get notification preferences for user
   */
  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences | null> {
    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return preferences as NotificationPreferences | null;
  }

  /**
   * Create or update notification preferences for user
   */
  async upsertNotificationPreferences(
    userId: string,
    data: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId },
      update: {
        emailEnabled: data.emailEnabled,
        emailMessages: data.emailMessages,
        emailCareUpdates: data.emailCareUpdates,
        emailAnnouncements: data.emailAnnouncements,
        emailFamilyActivity: data.emailFamilyActivity,
        emailEmergencyAlerts: data.emailEmergencyAlerts,
        inAppEnabled: data.inAppEnabled,
        inAppMessages: data.inAppMessages,
        inAppCareUpdates: data.inAppCareUpdates,
        inAppAnnouncements: data.inAppAnnouncements,
        inAppFamilyActivity: data.inAppFamilyActivity,
        inAppEmergencyAlerts: data.inAppEmergencyAlerts,
        quietHoursEnabled: data.quietHoursEnabled,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        timezone: data.timezone,
      },
      create: {
        userId,
        emailEnabled: data.emailEnabled ?? true,
        emailMessages: data.emailMessages ?? true,
        emailCareUpdates: data.emailCareUpdates ?? true,
        emailAnnouncements: data.emailAnnouncements ?? true,
        emailFamilyActivity: data.emailFamilyActivity ?? false,
        emailEmergencyAlerts: data.emailEmergencyAlerts ?? true,
        inAppEnabled: data.inAppEnabled ?? true,
        inAppMessages: data.inAppMessages ?? true,
        inAppCareUpdates: data.inAppCareUpdates ?? true,
        inAppAnnouncements: data.inAppAnnouncements ?? true,
        inAppFamilyActivity: data.inAppFamilyActivity ?? true,
        inAppEmergencyAlerts: data.inAppEmergencyAlerts ?? true,
        quietHoursEnabled: data.quietHoursEnabled ?? false,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        timezone: data.timezone,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return preferences as NotificationPreferences;
  }

  /**
   * Check if user should receive notification based on preferences
   */
  async shouldSendNotification(
    userId: string,
    type: NotificationType,
    deliveryMethod: "email" | "inApp",
  ): Promise<boolean> {
    const preferences = await this.getNotificationPreferences(userId);

    // If no preferences exist, use defaults
    if (!preferences) {
      return true;
    }

    // Check if delivery method is enabled
    const methodEnabled =
      deliveryMethod === "email"
        ? preferences.emailEnabled
        : preferences.inAppEnabled;

    if (!methodEnabled) return false;

    // Check specific notification type preferences
    const typeKey =
      deliveryMethod === "email"
        ? `email${type.charAt(0)}${type
            .slice(1)
            .toLowerCase()
            .replace(/_./g, (m) => m[1].toUpperCase())}`
        : `inApp${type.charAt(0)}${type
            .slice(1)
            .toLowerCase()
            .replace(/_./g, (m) => m[1].toUpperCase())}`;

    // Handle specific mappings
    const preferenceMap: Record<string, keyof NotificationPreferences> = {
      emailMessage: "emailMessages",
      emailCareUpdate: "emailCareUpdates",
      emailSystemAnnouncement: "emailAnnouncements",
      emailFamilyActivity: "emailFamilyActivity",
      emailEmergencyAlert: "emailEmergencyAlerts",
      inAppMessage: "inAppMessages",
      inAppCareUpdate: "inAppCareUpdates",
      inAppSystemAnnouncement: "inAppAnnouncements",
      inAppFamilyActivity: "inAppFamilyActivity",
      inAppEmergencyAlert: "inAppEmergencyAlerts",
    };

    const preferenceKey = preferenceMap[typeKey];
    if (preferenceKey) {
      return preferences[preferenceKey] as boolean;
    }

    // Default to enabled if no specific preference found
    return true;
  }

  /**
   * Check if current time is within user's quiet hours
   */
  async isWithinQuietHours(userId: string): Promise<boolean> {
    const preferences = await this.getNotificationPreferences(userId);

    if (
      !preferences?.quietHoursEnabled ||
      !preferences.quietHoursStart ||
      !preferences.quietHoursEnd
    ) {
      return false;
    }

    const now = new Date();
    const userTimezone = preferences.timezone || "UTC";

    // Convert current time to user's timezone
    const userTime = new Date(
      now.toLocaleString("en-US", { timeZone: userTimezone }),
    );
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Parse quiet hours
    const [startHour, startMin] = preferences.quietHoursStart
      .split(":")
      .map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 06:00)
    if (startMinutes > endMinutes) {
      return (
        currentTimeMinutes >= startMinutes || currentTimeMinutes <= endMinutes
      );
    }

    // Handle same-day quiet hours (e.g., 12:00 to 14:00)
    return (
      currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes
    );
  }

  /**
   * Create bulk notifications for multiple users
   */
  async createBulkNotifications(
    userIds: string[],
    notificationData: Omit<CreateNotificationInput, "userId">,
  ): Promise<Notification[]> {
    const notifications = await Promise.all(
      userIds.map((userId) =>
        this.createNotification({
          ...notificationData,
          userId,
        }),
      ),
    );

    return notifications;
  }

  /**
   * Get notification statistics for a user
   */
  async getUserNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
  }> {
    const [total, unread, byTypeResult] = await Promise.all([
      prisma.notification.count({
        where: { userId },
      }),
      this.getUnreadCount(userId),
      prisma.notification.groupBy({
        by: ["type"],
        where: { userId },
        _count: { type: true },
      }),
    ]);

    const byType = byTypeResult.reduce(
      (acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      },
      {} as Record<NotificationType, number>,
    );

    return {
      total,
      unread,
      byType,
    };
  }

  /**
   * Clean up old read notifications (older than 30 days)
   */
  async cleanupOldNotifications(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: { lt: thirtyDaysAgo },
      },
    });

    return result.count;
  }
}
