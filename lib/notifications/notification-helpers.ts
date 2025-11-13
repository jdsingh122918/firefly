import { NotificationType } from "@/lib/types";
import { notificationDispatcher } from "./notification-dispatcher.service";

/**
 * Helper functions for creating and dispatching notifications
 * These provide a simple API for sending notifications from anywhere in the app
 */

/**
 * Send a message notification
 */
export async function notifyMessage(
  recipientUserId: string,
  data: {
    senderName: string;
    messagePreview: string;
    conversationUrl: string;
    conversationTitle?: string;
    familyName?: string;
    messageCount?: number;
  },
) {
  return await notificationDispatcher.dispatchNotification(
    recipientUserId,
    NotificationType.MESSAGE,
    {
      title: `New message from ${data.senderName}`,
      message: data.messagePreview,
      isActionable: true,
      actionUrl: data.conversationUrl,
    },
    {
      recipientName: "User", // Will be filled by email service
      senderName: data.senderName,
      messagePreview: data.messagePreview,
      conversationUrl: data.conversationUrl,
      conversationTitle: data.conversationTitle,
      familyName: data.familyName,
      messageCount: data.messageCount,
    },
  );
}

/**
 * Send a care update notification
 */
export async function notifyCareUpdate(
  recipientUserId: string,
  data: {
    updateTitle: string;
    updateContent: string;
    updateUrl: string;
    updateAuthor: string;
    familyName: string;
  },
) {
  return await notificationDispatcher.dispatchNotification(
    recipientUserId,
    NotificationType.CARE_UPDATE,
    {
      title: data.updateTitle,
      message: `${data.updateAuthor} posted an update: ${data.updateContent}`,
      isActionable: true,
      actionUrl: data.updateUrl,
    },
    {
      recipientName: "User",
      familyName: data.familyName,
      updateTitle: data.updateTitle,
      updateContent: data.updateContent,
      updateUrl: data.updateUrl,
      updateAuthor: data.updateAuthor,
      updateDate: new Date().toISOString(),
    },
  );
}

/**
 * Send an emergency alert notification
 */
export async function notifyEmergencyAlert(
  recipientUserId: string,
  data: {
    alertTitle: string;
    alertContent: string;
    alertUrl: string;
    familyName: string;
    contactInfo: string;
    severity: "low" | "medium" | "high" | "critical";
  },
) {
  return await notificationDispatcher.dispatchNotification(
    recipientUserId,
    NotificationType.EMERGENCY_ALERT,
    {
      title: data.alertTitle,
      message: data.alertContent,
      isActionable: true,
      actionUrl: data.alertUrl,
    },
    {
      recipientName: "User",
      alertTitle: data.alertTitle,
      alertContent: data.alertContent,
      alertUrl: data.alertUrl,
      familyName: data.familyName,
      contactInfo: data.contactInfo,
      issueDate: new Date().toISOString(),
      severity: data.severity,
    },
  );
}

/**
 * Send a system announcement notification
 */
export async function notifySystemAnnouncement(
  recipientUserId: string,
  data: {
    announcementTitle: string;
    announcementContent: string;
    announcementUrl?: string;
    authorName?: string;
    priority?: "low" | "normal" | "high" | "urgent";
  },
) {
  return await notificationDispatcher.dispatchNotification(
    recipientUserId,
    NotificationType.SYSTEM_ANNOUNCEMENT,
    {
      title: data.announcementTitle,
      message: data.announcementContent,
      isActionable: !!data.announcementUrl,
      actionUrl: data.announcementUrl,
    },
    {
      recipientName: "User",
      announcementTitle: data.announcementTitle,
      announcementContent: data.announcementContent,
      announcementUrl: data.announcementUrl || "#",
      authorName: data.authorName || "Firefly Team",
      publishDate: new Date().toISOString(),
      priority: data.priority || "normal",
    },
  );
}

/**
 * Send a family activity notification
 */
export async function notifyFamilyActivity(
  recipientUserId: string,
  data: {
    activityTitle: string;
    activityDescription: string;
    activityUrl: string;
    familyName: string;
    participants: string[];
  },
) {
  return await notificationDispatcher.dispatchNotification(
    recipientUserId,
    NotificationType.FAMILY_ACTIVITY,
    {
      title: data.activityTitle,
      message: data.activityDescription,
      isActionable: true,
      actionUrl: data.activityUrl,
    },
    {
      recipientName: "User",
      familyName: data.familyName,
      activityTitle: data.activityTitle,
      activityDescription: data.activityDescription,
      activityUrl: data.activityUrl,
      activityDate: new Date().toISOString(),
      participants: data.participants,
    },
  );
}

/**
 * Send notification to all family members
 */
export async function notifyFamily(
  familyId: string,
  type: NotificationType,
  notificationData: {
    title: string;
    message: string;
    actionUrl?: string;
    isActionable?: boolean;
  },
  emailData: {
    [key: string]: unknown;
  },
  options: {
    excludeUserIds?: string[];
  } = {},
) {
  return await notificationDispatcher.dispatchFamilyNotification(
    familyId,
    type,
    {
      title: notificationData.title,
      message: notificationData.message,
      isActionable: notificationData.isActionable,
      actionUrl: notificationData.actionUrl,
    },
    emailData,
    options,
  );
}

/**
 * Simple notification for quick messages (in-app only, no email)
 */
export async function notifySimple(
  recipientUserId: string,
  data: {
    title: string;
    message: string;
    type?: NotificationType;
    actionUrl?: string;
    expiresAt?: Date;
  },
) {
  return await notificationDispatcher.dispatchNotification(
    recipientUserId,
    data.type || NotificationType.SYSTEM_ANNOUNCEMENT,
    {
      title: data.title,
      message: data.message,
      isActionable: !!data.actionUrl,
      actionUrl: data.actionUrl,
      expiresAt: data.expiresAt,
    },
    // No email data provided - will be in-app only
  );
}

/**
 * Mark notification as read using the dispatcher
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
) {
  return await notificationDispatcher.markNotificationAsRead(
    notificationId,
    userId,
  );
}

/**
 * Mark all notifications as read using the dispatcher
 */
export async function markAllNotificationsAsRead(userId: string) {
  return await notificationDispatcher.markAllNotificationsAsRead(userId);
}

/**
 * Batch helpers for common scenarios
 */
export const NotificationHelpers = {
  /**
   * Notify when a new message is posted in a conversation
   */
  async messagePosted(
    conversationId: string,
    senderId: string,
    content: string,
  ) {
    // This would need to be integrated with your message system
    // to get conversation participants and send notifications to each
    console.log("TODO: Implement messagePosted notification", {
      conversationId,
      senderId,
      content,
    });
  },

  /**
   * Notify when a care plan is updated
   */
  async carePlanUpdated(
    carePlanId: string,
    updatedBy: string,
    changes: string[],
  ) {
    console.log("TODO: Implement carePlanUpdated notification", {
      carePlanId,
      updatedBy,
      changes,
    });
  },

  /**
   * Notify when an emergency situation occurs
   */
  async emergencyAlert(
    familyId: string,
    alertType: string,
    details: string,
    severity: "low" | "medium" | "high" | "critical",
  ) {
    console.log("TODO: Implement emergencyAlert notification", {
      familyId,
      alertType,
      details,
      severity,
    });
  },

  /**
   * Welcome new user with onboarding notifications
   */
  async welcomeNewUser(userId: string) {
    await notifySystemAnnouncement(userId, {
      announcementTitle: "Welcome to Firefly!",
      announcementContent:
        "Get started by setting up your family profile and inviting family members to join.",
      priority: "normal",
    });
  },

  /**
   * Remind user to complete their profile
   */
  async reminderCompleteProfile(userId: string) {
    await notifySimple(userId, {
      title: "Complete Your Profile",
      message:
        "Help your family connect with you by completing your profile information.",
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      actionUrl: "/profile",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
  },
};

const notificationHelpers = {
  notifyMessage,
  notifyCareUpdate,
  notifyEmergencyAlert,
  notifySystemAnnouncement,
  notifyFamilyActivity,
  notifyFamily,
  notifySimple,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationHelpers,
};

export default notificationHelpers;
