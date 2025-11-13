// Main email service integration
export { EmailService } from "./email.service";
export { emailConfig, EmailConfigManager } from "./config";
export { ResendProvider } from "./providers/resend.provider";
export {
  defaultEmailTemplates,
  getTemplateById,
  getTemplatesByType,
} from "./templates";
export * from "./types";

import { EmailService } from "./email.service";
import { emailConfig, EmailConfigManager } from "./config";
import { NotificationType } from "@/lib/types";
import type {
  NotificationEmailData,
  MessageNotificationData,
  CareUpdateNotificationData,
  EmergencyAlertNotificationData,
  AnnouncementNotificationData,
  FamilyActivityNotificationData,
} from "./types";

// Global email service instance
let emailServiceInstance: EmailService | null = null;

/**
 * Initialize email service with configuration
 */
export async function initializeEmailService(
  environment?: "development" | "staging" | "production",
): Promise<EmailService> {
  try {
    // Initialize configuration
    if (environment) {
      const envConfig = EmailConfigManager.getEnvironmentConfig(environment);
      emailConfig.initialize(envConfig);
    } else {
      emailConfig.initialize();
    }

    // Validate configuration
    const validation = emailConfig.validateConfig();
    if (!validation.isValid) {
      console.error(
        "❌ Email service configuration validation failed:",
        validation.errors,
      );
      throw new Error(
        `Email service configuration is invalid: ${validation.errors.join(", ")}`,
      );
    }

    // Create email service instance
    emailServiceInstance = new EmailService(emailConfig.getConfig());

    // Validate provider configuration
    const healthStatus = await emailServiceInstance.getHealthStatus();
    if (!healthStatus.isHealthy) {
      console.warn(
        "⚠️ Email service health check failed:",
        healthStatus.lastError,
      );
      // Don't throw error here - service can still work for some operations
    }

    console.log("✅ Email service initialized successfully:", {
      provider: healthStatus.provider,
      isHealthy: healthStatus.isHealthy,
      templatesLoaded: healthStatus.templatesLoaded,
    });

    return emailServiceInstance;
  } catch (error) {
    console.error("❌ Failed to initialize email service:", error);
    throw error;
  }
}

/**
 * Get email service instance (initialize if needed)
 */
export async function getEmailService(): Promise<EmailService> {
  if (!emailServiceInstance) {
    // Auto-initialize with current environment
    const environment = process.env.NODE_ENV as
      | "development"
      | "staging"
      | "production";
    return await initializeEmailService(environment);
  }

  return emailServiceInstance;
}

/**
 * Helper function to send notification emails
 * This integrates with the existing notification system
 */
export async function sendNotificationEmail(
  recipientUserId: string,
  notificationType: NotificationType,
  notificationData: NotificationEmailData,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const emailService = await getEmailService();
    const response = await emailService.sendNotificationEmail(
      recipientUserId,
      notificationType,
      notificationData,
    );

    return {
      success: response.success,
      messageId: response.messageId,
      error: response.error,
    };
  } catch (error) {
    console.error("❌ Failed to send notification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Enhanced notification function that creates in-app notification AND sends email
 * This can be used to replace the existing notification creation
 */
export async function createNotificationWithEmail(
  recipientUserId: string,
  notificationType: NotificationType,
  inAppNotificationData: {
    title: string;
    message: string;
    data?: Record<string, unknown>;
    isActionable?: boolean;
    actionUrl?: string;
    expiresAt?: Date;
  },
  emailNotificationData: NotificationEmailData,
): Promise<{
  inAppSuccess: boolean;
  emailSuccess: boolean;
  inAppNotificationId?: string;
  emailMessageId?: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let inAppSuccess = false;
  let emailSuccess = false;
  let inAppNotificationId: string | undefined;
  let emailMessageId: string | undefined;

  try {
    // Create in-app notification using existing notification repository
    const { NotificationRepository } = await import(
      "@/lib/db/repositories/notification.repository"
    );
    const notificationRepo = new NotificationRepository();

    const inAppNotification = await notificationRepo.createNotification({
      userId: recipientUserId,
      type: notificationType,
      title: inAppNotificationData.title,
      message: inAppNotificationData.message,
      data: inAppNotificationData.data,
      isActionable: inAppNotificationData.isActionable,
      actionUrl: inAppNotificationData.actionUrl,
      expiresAt: inAppNotificationData.expiresAt,
    });

    inAppSuccess = true;
    inAppNotificationId = inAppNotification.id;
    console.log("✅ In-app notification created:", inAppNotificationId);
  } catch (error) {
    console.error("❌ Failed to create in-app notification:", error);
    errors.push(
      `In-app notification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  try {
    // Send email notification
    const emailResult = await sendNotificationEmail(
      recipientUserId,
      notificationType,
      emailNotificationData,
    );

    emailSuccess = emailResult.success;
    emailMessageId = emailResult.messageId;

    if (!emailResult.success) {
      errors.push(
        `Email notification failed: ${emailResult.error || "Unknown error"}`,
      );
    } else {
      console.log("✅ Email notification sent:", emailMessageId);
    }
  } catch (error) {
    console.error("❌ Failed to send email notification:", error);
    errors.push(
      `Email notification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  return {
    inAppSuccess,
    emailSuccess,
    inAppNotificationId,
    emailMessageId,
    errors,
  };
}

/**
 * Utility functions to create properly typed notification data
 */
export const NotificationEmailHelpers = {
  createMessageNotification(data: {
    recipientName: string;
    senderName: string;
    conversationTitle?: string;
    messagePreview: string;
    conversationUrl: string;
    familyName?: string;
    messageCount?: number;
  }): MessageNotificationData {
    return {
      ...data,
      conversationTitle: data.conversationTitle || "",
      unsubscribeUrl: "", // Will be filled by email service
    } as MessageNotificationData;
  },

  createCareUpdateNotification(data: {
    recipientName: string;
    familyName: string;
    updateTitle: string;
    updateContent: string;
    updateUrl: string;
    updateAuthor: string;
    updateDate: string;
  }): CareUpdateNotificationData {
    return {
      ...data,
      unsubscribeUrl: "", // Will be filled by email service
    };
  },

  createEmergencyAlertNotification(data: {
    recipientName: string;
    alertTitle: string;
    alertContent: string;
    alertUrl: string;
    familyName: string;
    contactInfo: string;
    issueDate: string;
    severity: "low" | "medium" | "high" | "critical";
  }): EmergencyAlertNotificationData {
    return data;
  },

  createAnnouncementNotification(data: {
    recipientName: string;
    announcementTitle: string;
    announcementContent: string;
    announcementUrl: string;
    authorName: string;
    publishDate: string;
    priority?: "low" | "normal" | "high" | "urgent";
  }): AnnouncementNotificationData {
    return {
      ...data,
      unsubscribeUrl: "", // Will be filled by email service
    };
  },

  createFamilyActivityNotification(data: {
    recipientName: string;
    familyName: string;
    activityTitle: string;
    activityDescription: string;
    activityUrl: string;
    activityDate: string;
    participants: string[];
  }): FamilyActivityNotificationData {
    return {
      ...data,
      unsubscribeUrl: "", // Will be filled by email service
    };
  },
};

/**
 * Batch email utilities
 */
export const BatchEmailHelpers = {
  async sendBulkNotifications(
    recipients: Array<{
      userId: string;
      email: string;
      templateData: Record<string, unknown>;
    }>,
    templateId: string,
    options?: {
      priority?: "low" | "normal" | "high" | "urgent";
      scheduledAt?: Date;
      tags?: string[];
    },
  ) {
    try {
      const emailService = await getEmailService();
      return await emailService.sendBatchEmails({
        templateId,
        recipients: recipients.map((recipient) => ({
          email: recipient.email,
          templateData: recipient.templateData,
        })),
        ...options,
      });
    } catch (error) {
      console.error("❌ Failed to send bulk notifications:", error);
      return {
        success: false,
        errors: [
          {
            email: "batch",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      };
    }
  },

  async sendFamilyBroadcast(
    familyId: string,
    templateId: string,
    templateData: Record<string, unknown>,
    options?: {
      priority?: "low" | "normal" | "high" | "urgent";
      scheduledAt?: Date;
      excludeUserIds?: string[];
    },
  ) {
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
      if (options?.excludeUserIds) {
        recipients = recipients.filter(
          (member) => !options.excludeUserIds!.includes(member.id),
        );
      }

      // Prepare batch email data
      const emailRecipients = recipients
        .filter((member) => member.email) // Only members with email addresses
        .map((member) => ({
          email: member.email!,
          templateData: {
            ...templateData,
            recipientName:
              `${member.firstName} ${member.lastName}`.trim() || member.email,
            familyName: family.name,
          },
        }));

      return await BatchEmailHelpers.sendBulkNotifications(
        emailRecipients.map((recipient, index) => ({
          userId: recipients[index].id,
          ...recipient,
        })),
        templateId,
        {
          priority: options?.priority,
          scheduledAt: options?.scheduledAt,
          tags: [`family-${familyId}`],
        },
      );
    } catch (error) {
      console.error("❌ Failed to send family broadcast:", error);
      return {
        success: false,
        errors: [
          {
            email: "family-broadcast",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      };
    }
  },
};

/**
 * Health check and monitoring utilities
 */
export const EmailHealthHelpers = {
  async checkEmailHealth(): Promise<{
    isHealthy: boolean;
    provider: string;
    templatesLoaded: number;
    configValid: boolean;
    lastError?: string;
  }> {
    try {
      if (!emailServiceInstance) {
        return {
          isHealthy: false,
          provider: "none",
          templatesLoaded: 0,
          configValid: false,
          lastError: "Email service not initialized",
        };
      }

      const healthStatus = await emailServiceInstance.getHealthStatus();
      const configValidation = emailConfig.validateConfig();

      return {
        ...healthStatus,
        configValid: configValidation.isValid,
        lastError:
          healthStatus.lastError ||
          (configValidation.isValid
            ? undefined
            : configValidation.errors.join(", ")),
      };
    } catch (error) {
      return {
        isHealthy: false,
        provider: "unknown",
        templatesLoaded: 0,
        configValid: false,
        lastError: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async testEmailConfiguration(): Promise<{
    success: boolean;
    results: Array<{
      test: string;
      passed: boolean;
      message: string;
    }>;
  }> {
    const results = [];
    let success = true;

    // Test configuration
    const configValidation = emailConfig.validateConfig();
    results.push({
      test: "Configuration Validation",
      passed: configValidation.isValid,
      message: configValidation.isValid
        ? "Configuration is valid"
        : configValidation.errors.join(", "),
    });

    if (!configValidation.isValid) {
      success = false;
    }

    // Test provider connection
    try {
      const emailService = await getEmailService();
      const healthStatus = await emailService.getHealthStatus();

      results.push({
        test: "Provider Connection",
        passed: healthStatus.isHealthy,
        message: healthStatus.isHealthy
          ? `Connected to ${healthStatus.provider}`
          : `Connection failed: ${healthStatus.lastError}`,
      });

      if (!healthStatus.isHealthy) {
        success = false;
      }
    } catch (error) {
      results.push({
        test: "Provider Connection",
        passed: false,
        message: `Failed to test provider: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      success = false;
    }

    // Test templates
    const templates = emailConfig.getConfig().templates;
    results.push({
      test: "Template Loading",
      passed: templates.length > 0,
      message: `${templates.length} templates loaded`,
    });

    if (templates.length === 0) {
      success = false;
    }

    return { success, results };
  },
};

// Default export
const emailModule = {
  initializeEmailService,
  getEmailService,
  sendNotificationEmail,
  createNotificationWithEmail,
  NotificationEmailHelpers,
  BatchEmailHelpers,
  EmailHealthHelpers,
};

export default emailModule;
