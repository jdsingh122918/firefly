import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationDeliveryRepository } from "@/lib/db/repositories/notification-delivery.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import {
  NotificationType,
  Notification,
} from "@/lib/types";
import {
  sendNotificationEmail,
  NotificationEmailHelpers,
} from "@/lib/email";
import { NotificationLogger } from "./notification-logger";
import { DeliveryStatus } from "@prisma/client";

// Import the broadcaster functions from the SSE endpoint
// Note: This import will work at runtime since the SSE route exports these functions

// Notification broadcast data type
interface NotificationBroadcastData {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  isActionable: boolean;
  actionUrl: string | null;
  createdAt: Date;
  deliveryLogId?: string; // For client acknowledgment
}

// Broadcast result type
interface BroadcastResult {
  success: boolean;
  connectionId?: string;
  error?: string;
}

let broadcastNotificationToUser: (userId: string, notification: NotificationBroadcastData) => BroadcastResult;
let broadcastUnreadCountToUser: (userId: string, count: number) => void;
let isUserConnected: (userId: string) => boolean;
let getConnectionIdForUser: (userId: string) => string | undefined;

// Dynamic import to avoid circular dependencies
async function initializeBroadcasters() {
  if (!broadcastNotificationToUser) {
    try {
      const streamModule = await import("@/app/api/notifications/stream/route");
      broadcastNotificationToUser = streamModule.broadcastNotificationToUser as (
        userId: string,
        notification: NotificationBroadcastData
      ) => BroadcastResult;
      broadcastUnreadCountToUser = streamModule.broadcastUnreadCountToUser as (
        userId: string,
        count: number
      ) => void;
      isUserConnected = streamModule.isUserConnected as (
        userId: string
      ) => boolean;
      getConnectionIdForUser = streamModule.getConnectionIdForUser as (
        userId: string
      ) => string | undefined;
    } catch (_error) {
      console.error(
        "❌ Failed to initialize notification broadcasters:",
        _error,
      );
      // Provide fallback functions
      broadcastNotificationToUser = () => ({ success: false, error: "Broadcasters not initialized" });
      broadcastUnreadCountToUser = () => {};
      isUserConnected = () => false;
      getConnectionIdForUser = () => undefined;
    }
  }
}

export class NotificationDispatcher {
  private notificationRepository: NotificationRepository;
  private deliveryRepository: NotificationDeliveryRepository;
  private userRepository: UserRepository;
  private initialized = false;

  constructor() {
    this.notificationRepository = new NotificationRepository();
    this.deliveryRepository = new NotificationDeliveryRepository();
    this.userRepository = new UserRepository();
    this.initialize();
  }

  private async initialize() {
    if (!this.initialized) {
      await initializeBroadcasters();
      this.initialized = true;
    }
  }

  /**
   * Create and dispatch a notification (both in-app and email if preferences allow)
   */
  async dispatchNotification(
    recipientUserId: string,
    type: NotificationType,
    data: {
      title: string;
      message: string;
      data?: Record<string, unknown> | null;
      isActionable?: boolean;
      actionUrl?: string;
      expiresAt?: Date;
    },
    emailData?: {
      recipientName: string;
      senderName?: string;
      conversationTitle?: string;
      familyName?: string;
      messageCount?: number;
      updateAuthor?: string;
      contactInfo?: string;
      severity?: string;
      authorName?: string;
      priority?: string;
      participants?: string[];
      [key: string]: unknown;
    },
  ): Promise<{
    inAppNotification?: Notification;
    emailSent: boolean;
    sseDelivered: boolean;
    deliveryLogId?: string;
    success: boolean;
    errors: string[];
  }> {
    await this.initialize();

    const errors: string[] = [];
    let inAppNotification: Notification | undefined;
    let emailSent = false;
    let sseDelivered = false;
    let deliveryLogId: string | undefined;

    try {
      // Always create in-app notification first
      inAppNotification = await this.notificationRepository.createNotification({
        userId: recipientUserId,
        type,
        title: data.title,
        message: data.message,
        data: data.data,
        isActionable: data.isActionable,
        actionUrl: data.actionUrl,
        expiresAt: data.expiresAt,
      });

      // Log notification creation
      NotificationLogger.notificationCreated(
        inAppNotification.id,
        recipientUserId,
        type
      );

      // Check if user is connected and get connection info
      const wasConnected = isUserConnected(recipientUserId);
      const connectionId = getConnectionIdForUser(recipientUserId);

      // Create delivery tracking log
      const deliveryLog = await this.deliveryRepository.createDeliveryLog({
        notificationId: inAppNotification.id,
        userId: recipientUserId,
        wasConnected,
        connectionId,
      });
      deliveryLogId = deliveryLog.id;

      // Log dispatch attempt
      NotificationLogger.sseDispatchAttempted(
        inAppNotification.id,
        recipientUserId,
        wasConnected,
        connectionId
      );

      // Broadcast the notification via SSE
      const broadcastResult = broadcastNotificationToUser(recipientUserId, {
        id: inAppNotification.id,
        type: inAppNotification.type,
        title: inAppNotification.title,
        message: inAppNotification.message,
        data: inAppNotification.data as Record<string, unknown> | null,
        isActionable: inAppNotification.isActionable,
        actionUrl: inAppNotification.actionUrl,
        createdAt: inAppNotification.createdAt,
        deliveryLogId: deliveryLog.id,
      });

      // Update delivery log based on result
      if (broadcastResult.success) {
        const latencyMs = Date.now() - inAppNotification.createdAt.getTime();
        await this.deliveryRepository.markAsDelivered(deliveryLog.id, latencyMs);
        sseDelivered = true;
        NotificationLogger.sseDispatchSuccess(
          inAppNotification.id,
          recipientUserId,
          latencyMs,
          broadcastResult.connectionId
        );
      } else {
        await this.deliveryRepository.markAsFailed(
          deliveryLog.id,
          broadcastResult.error || "Unknown error"
        );
        if (!wasConnected) {
          NotificationLogger.sseNoConnection(inAppNotification.id, recipientUserId);
        } else {
          NotificationLogger.sseDispatchFailed(
            inAppNotification.id,
            recipientUserId,
            broadcastResult.error || "Unknown error",
            broadcastResult.connectionId
          );
        }
      }

      // Update unread count
      const unreadCount =
        await this.notificationRepository.getUnreadCount(recipientUserId);
      broadcastUnreadCountToUser(recipientUserId, unreadCount);

      // Send email notification if email data is provided and preferences allow
      if (emailData) {
        try {
          // Check if user wants email notifications
          const shouldSendEmail =
            await this.notificationRepository.shouldSendNotification(
              recipientUserId,
              type,
              "email",
            );

          if (shouldSendEmail) {
            // Check quiet hours (emergency alerts always go through)
            const isWithinQuietHours =
              await this.notificationRepository.isWithinQuietHours(
                recipientUserId,
              );

            if (
              !isWithinQuietHours ||
              type === NotificationType.EMERGENCY_ALERT
            ) {
              // Create proper email notification data based on type
              let emailNotificationData;

              switch (type) {
                case NotificationType.MESSAGE:
                  emailNotificationData =
                    NotificationEmailHelpers.createMessageNotification({
                      recipientName: emailData.recipientName,
                      senderName: (emailData.senderName as string) || "Unknown",
                      messagePreview: data.message,
                      conversationUrl: data.actionUrl || "#",
                      conversationTitle: emailData.conversationTitle as string | undefined,
                      familyName: emailData.familyName as string | undefined,
                      messageCount: emailData.messageCount as number | undefined,
                    });
                  break;

                case NotificationType.CARE_UPDATE:
                  emailNotificationData =
                    NotificationEmailHelpers.createCareUpdateNotification({
                      recipientName: emailData.recipientName,
                      familyName: (emailData.familyName as string) || "",
                      updateTitle: data.title,
                      updateContent: data.message,
                      updateUrl: data.actionUrl || "#",
                      updateAuthor: (emailData.updateAuthor as string) || "System",
                      updateDate: new Date().toISOString(),
                    });
                  break;

                case NotificationType.EMERGENCY_ALERT:
                  emailNotificationData =
                    NotificationEmailHelpers.createEmergencyAlertNotification({
                      recipientName: emailData.recipientName,
                      alertTitle: data.title,
                      alertContent: data.message,
                      alertUrl: data.actionUrl || "#",
                      familyName: (emailData.familyName as string) || "",
                      contactInfo: (emailData.contactInfo as string) || "",
                      issueDate: new Date().toISOString(),
                      severity: (emailData.severity as "low" | "medium" | "high" | "critical") || "medium",
                    });
                  break;

                case NotificationType.SYSTEM_ANNOUNCEMENT:
                  emailNotificationData =
                    NotificationEmailHelpers.createAnnouncementNotification({
                      recipientName: emailData.recipientName,
                      announcementTitle: data.title,
                      announcementContent: data.message,
                      announcementUrl: data.actionUrl || "#",
                      authorName: (emailData.authorName as string) || "Firefly Team",
                      publishDate: new Date().toISOString(),
                      priority: (emailData.priority as "low" | "normal" | "high" | "urgent") || "normal",
                    });
                  break;

                case NotificationType.FAMILY_ACTIVITY:
                  emailNotificationData =
                    NotificationEmailHelpers.createFamilyActivityNotification({
                      recipientName: emailData.recipientName,
                      familyName: (emailData.familyName as string) || "",
                      activityTitle: data.title,
                      activityDescription: data.message,
                      activityUrl: data.actionUrl || "#",
                      activityDate: new Date().toISOString(),
                      participants: (emailData.participants as string[]) || [],
                    });
                  break;

                default:
                  // For unknown types, create a generic announcement
                  emailNotificationData =
                    NotificationEmailHelpers.createAnnouncementNotification({
                      recipientName: emailData.recipientName,
                      announcementTitle: data.title,
                      announcementContent: data.message,
                      announcementUrl: data.actionUrl || "#",
                      authorName: "Firefly",
                      publishDate: new Date().toISOString(),
                    });
              }

              const emailResult = await sendNotificationEmail(
                recipientUserId,
                type,
                emailNotificationData,
              );

              if (emailResult.success) {
                emailSent = true;
                console.log(
                  "✅ Email notification sent:",
                  emailResult.messageId,
                );
              } else {
                errors.push(`Email failed: ${emailResult.error}`);
              }
            } else {
              console.log(
                "🔕 Email notification skipped due to quiet hours:",
                recipientUserId,
              );
            }
          } else {
            console.log(
              "🔕 Email notification disabled by user preferences:",
              recipientUserId,
            );
          }
        } catch (emailError) {
          console.error("❌ Email notification error:", emailError);
          errors.push(
            `Email error: ${
              emailError instanceof Error ? emailError.message : "Unknown"
            }`,
          );
        }
      }

      return {
        inAppNotification,
        emailSent,
        sseDelivered,
        deliveryLogId,
        success: true,
        errors,
      };
    } catch (error) {
      console.error("❌ Notification dispatch error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Dispatch error: ${errorMessage}`);

      return {
        inAppNotification,
        emailSent,
        sseDelivered,
        deliveryLogId,
        success: false,
        errors,
      };
    }
  }

  /**
   * Dispatch notification to multiple users (bulk)
   */
  async dispatchBulkNotifications(
    recipients: Array<{
      userId: string;
      emailData?: {
        recipientName: string;
        [key: string]: unknown;
      };
    }>,
    type: NotificationType,
    notificationData: {
      title: string;
      message: string;
      data?: Record<string, unknown> | null;
      isActionable?: boolean;
      actionUrl?: string;
      expiresAt?: Date;
    },
  ): Promise<{
    successCount: number;
    failureCount: number;
    sseDeliveredCount: number;
    results: Array<{
      userId: string;
      success: boolean;
      inAppNotification?: Notification;
      emailSent: boolean;
      sseDelivered: boolean;
      errors: string[];
    }>;
  }> {
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.dispatchNotification(
          recipient.userId,
          type,
          notificationData,
          recipient.emailData,
        ).then((result) => ({
          userId: recipient.userId,
          ...result,
        })),
      ),
    );

    const finalResults = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          userId: recipients[index].userId,
          success: false,
          emailSent: false,
          sseDelivered: false,
          errors: [`Failed to dispatch: ${result.reason}`],
        };
      }
    });

    const successCount = finalResults.filter((r) => r.success).length;
    const failureCount = finalResults.length - successCount;
    const sseDeliveredCount = finalResults.filter((r) => r.sseDelivered).length;

    console.log("🔔 Bulk notification dispatch complete:", {
      total: recipients.length,
      success: successCount,
      failed: failureCount,
      sseDelivered: sseDeliveredCount,
    });

    return {
      successCount,
      failureCount,
      sseDeliveredCount,
      results: finalResults,
    };
  }

  /**
   * Send notification to all family members
   */
  async dispatchFamilyNotification(
    familyId: string,
    type: NotificationType,
    notificationData: {
      title: string;
      message: string;
      data?: Record<string, unknown> | null;
      isActionable?: boolean;
      actionUrl?: string;
      expiresAt?: Date;
    },
    emailData: {
      [key: string]: unknown;
    },
    options: {
      excludeUserIds?: string[];
    } = {},
  ): Promise<{
    successCount: number;
    failureCount: number;
    sseDeliveredCount: number;
    results: Array<{
      userId: string;
      success: boolean;
      inAppNotification?: Notification;
      emailSent: boolean;
      sseDelivered: boolean;
      errors: string[];
    }>;
  }> {
    try {
      // Get family members
      const { FamilyRepository } = await import(
        "@/lib/db/repositories/family.repository"
      );
      const familyRepo = new FamilyRepository();

      const family = await familyRepo.getFamilyById(familyId);
      if (!family || !family.members) {
        throw new Error("Family not found or has no members");
      }

      // Filter out excluded users
      let recipients = family.members;
      if (options.excludeUserIds) {
        recipients = recipients.filter(
          (member) => !options.excludeUserIds!.includes(member.id),
        );
      }

      // Prepare recipients with email data
      const recipientsWithEmailData = recipients
        .filter((member) => member.email) // Only members with email addresses
        .map((member) => ({
          userId: member.id,
          emailData: {
            ...emailData,
            recipientName:
              `${member.firstName} ${member.lastName}`.trim() || member.email,
            familyName: family.name,
          },
        }));

      return await this.dispatchBulkNotifications(
        recipientsWithEmailData,
        type,
        notificationData,
      );
    } catch (error) {
      console.error("❌ Family notification dispatch error:", error);
      return {
        successCount: 0,
        failureCount: 1,
        sseDeliveredCount: 0,
        results: [
          {
            userId: "family",
            success: false,
            emailSent: false,
            sseDelivered: false,
            errors: [error instanceof Error ? error.message : "Unknown error"],
          },
        ],
      };
    }
  }

  /**
   * Mark notification as read and update real-time counters
   */
  async markNotificationAsRead(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    await this.initialize();

    try {
      await this.notificationRepository.markAsRead(notificationId);

      // Update unread count in real-time
      const unreadCount =
        await this.notificationRepository.getUnreadCount(userId);
      broadcastUnreadCountToUser(userId, unreadCount);

      console.log("🔔 Notification marked as read:", {
        notificationId,
        userId,
        newUnreadCount: unreadCount,
      });
    } catch (error) {
      console.error("❌ Failed to mark notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read and update real-time counters
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await this.initialize();

    try {
      await this.notificationRepository.markAllAsRead(userId);

      // Update unread count in real-time
      broadcastUnreadCountToUser(userId, 0);

      console.log("🔔 All notifications marked as read for user:", userId);
    } catch (error) {
      console.error("❌ Failed to mark all notifications as read:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationDispatcher = new NotificationDispatcher();
