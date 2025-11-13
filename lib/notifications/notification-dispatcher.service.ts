import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import {
  NotificationType,
  Notification,
} from "@/lib/types";
import {
  sendNotificationEmail,
  NotificationEmailHelpers,
} from "@/lib/email";

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
}

let broadcastNotificationToUser: (userId: string, notification: NotificationBroadcastData) => void;
let broadcastUnreadCountToUser: (userId: string, count: number) => void;

// Dynamic import to avoid circular dependencies
async function initializeBroadcasters() {
  if (!broadcastNotificationToUser) {
    try {
      const streamModule = await import("@/app/api/notifications/stream/route");
      broadcastNotificationToUser = streamModule.broadcastNotificationToUser as (
        userId: string,
        notification: unknown
      ) => void;
      broadcastUnreadCountToUser = streamModule.broadcastUnreadCountToUser as (
        userId: string,
        count: number
      ) => void;
    } catch (_error) {
      console.error(
        "❌ Failed to initialize notification broadcasters:",
        _error,
      );
      // Provide fallback functions
      broadcastNotificationToUser = () => {};
      broadcastUnreadCountToUser = () => {};
    }
  }
}

export class NotificationDispatcher {
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;
  private initialized = false;

  constructor() {
    this.notificationRepository = new NotificationRepository();
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
    success: boolean;
    errors: string[];
  }> {
    await this.initialize();

    const errors: string[] = [];
    let inAppNotification: Notification | undefined;
    let emailSent = false;

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

      console.log("🔔 Created in-app notification:", {
        id: inAppNotification.id,
        userId: recipientUserId,
        type,
      });

      // Broadcast the notification via SSE
      broadcastNotificationToUser(recipientUserId, {
        id: inAppNotification.id,
        type: inAppNotification.type,
        title: inAppNotification.title,
        message: inAppNotification.message,
        data: inAppNotification.data as Record<string, unknown> | null,
        isActionable: inAppNotification.isActionable,
        actionUrl: inAppNotification.actionUrl,
        createdAt: inAppNotification.createdAt,
      });

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
    results: Array<{
      userId: string;
      success: boolean;
      inAppNotification?: Notification;
      emailSent: boolean;
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
          errors: [`Failed to dispatch: ${result.reason}`],
        };
      }
    });

    const successCount = finalResults.filter((r) => r.success).length;
    const failureCount = finalResults.length - successCount;

    console.log("🔔 Bulk notification dispatch complete:", {
      total: recipients.length,
      success: successCount,
      failed: failureCount,
    });

    return {
      successCount,
      failureCount,
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
    results: Array<{
      userId: string;
      success: boolean;
      inAppNotification?: Notification;
      emailSent: boolean;
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
        results: [
          {
            userId: "family",
            success: false,
            emailSent: false,
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
