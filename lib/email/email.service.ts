import {
  EmailProvider,
  EmailRequest,
  EmailResponse,
  EmailTemplate,
  EmailConfiguration,
  BatchEmailRequest,
  BatchEmailResponse,
  NotificationEmailData,
  EmailValidationResult,
  UnsubscribeRequest,
  UnsubscribeResponse,
  EmailServiceConfig,
} from "./types";
import { NotificationType } from "@/lib/types";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

export class EmailService {
  private provider: EmailProvider | null = null;
  private providerPromise: Promise<EmailProvider> | null = null;
  private config: EmailServiceConfig;
  private templates: Map<string, EmailTemplate> = new Map();
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;

  constructor(config: EmailServiceConfig) {
    this.config = config;
    this.notificationRepository = new NotificationRepository();
    this.userRepository = new UserRepository();

    // Initialize provider based on config (async)
    this.providerPromise = this.initializeProvider(config.provider);

    // Load templates
    this.loadTemplates();
  }

  private async getProvider(): Promise<EmailProvider> {
    if (this.provider) {
      return this.provider;
    }
    if (this.providerPromise) {
      this.provider = await this.providerPromise;
      return this.provider;
    }
    throw new Error("Provider not initialized");
  }

  private async initializeProvider(config: EmailConfiguration): Promise<EmailProvider> {
    switch (config.provider) {
      case "resend": {
        const { ResendProvider } = await import("./providers/resend.provider");
        return new ResendProvider(config);
      }
      // Note: Additional providers (sendgrid, nodemailer) would be added here
      default:
        throw new Error(`Unsupported email provider: ${config.provider}. Currently only 'resend' is supported.`);
    }
  }

  private loadTemplates(): void {
    this.config.templates.forEach((template) => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Send a single email
   */
  async sendEmail(request: EmailRequest): Promise<EmailResponse> {
    try {
      // Validate email addresses
      const validation = await this.validateEmail(
        Array.isArray(request.to) ? request.to[0] : request.to,
      );
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid email address: ${validation.reason}`,
        };
      }

      // Add default from address if not provided
      if (!request.from) {
        request.from = `${this.config.provider.fromName} <${this.config.provider.fromEmail}>`;
      }

      // Send email through provider
      const provider = await this.getProvider();
      const response = await provider.sendEmail(request);

      // Log email activity if tracking is enabled
      if (
        this.config.features.tracking &&
        response.success &&
        response.messageId
      ) {
        await this.logEmailActivity({
          messageId: response.messageId,
          recipientEmail: Array.isArray(request.to)
            ? request.to[0]
            : request.to,
          event: "sent",
          timestamp: new Date(),
          metadata: request.metadata,
        });
      }

      return response;
    } catch (error) {
      console.error("❌ EmailService.sendEmail error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Send email using template
   */
  async sendTemplatedEmail(
    recipientEmail: string,
    templateId: string,
    templateData: Record<string, unknown>,
    options: {
      scheduledAt?: Date;
      priority?: "low" | "normal" | "high" | "urgent";
      tags?: string[];
    } = {},
  ): Promise<EmailResponse> {
    try {
      const template = this.templates.get(templateId);
      if (!template || !template.isActive) {
        return {
          success: false,
          error: `Template not found or inactive: ${templateId}`,
        };
      }

      // Validate required template variables
      const missingVariables = template.variables
        .filter(
          (variable) => variable.required && !(variable.name in templateData),
        )
        .map((variable) => variable.name);

      if (missingVariables.length > 0) {
        return {
          success: false,
          error: `Missing required template variables: ${missingVariables.join(", ")}`,
        };
      }

      // Process template
      const processedTemplate = await this.processTemplate(
        template,
        templateData,
      );

      // Prepare email request
      const emailRequest: EmailRequest = {
        to: recipientEmail,
        subject: processedTemplate.subject,
        html: processedTemplate.html,
        text: processedTemplate.text,
        tags: options.tags,
        metadata: {
          templateId,
          templateData,
          scheduledAt: options.scheduledAt,
          priority: options.priority,
        },
      };

      // Handle scheduling if requested
      if (options.scheduledAt && this.config.features.scheduling) {
        return await this.scheduleEmail(emailRequest, options.scheduledAt);
      }

      return await this.sendEmail(emailRequest);
    } catch (error) {
      console.error("❌ EmailService.sendTemplatedEmail error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Send notification email based on notification type
   */
  async sendNotificationEmail(
    recipientUserId: string,
    notificationType: NotificationType,
    notificationData: NotificationEmailData,
  ): Promise<EmailResponse> {
    try {
      // Get user details
      const user = await this.userRepository.getUserById(recipientUserId);
      if (!user || !user.email) {
        return {
          success: false,
          error: "User not found or no email address",
        };
      }

      // Check if user should receive email notifications for this type
      const shouldSend =
        await this.notificationRepository.shouldSendNotification(
          recipientUserId,
          notificationType,
          "email",
        );

      if (!shouldSend) {
        return {
          success: false,
          error: "User has disabled email notifications for this type",
        };
      }

      // Check quiet hours
      const isQuietTime =
        await this.notificationRepository.isWithinQuietHours(recipientUserId);
      if (
        isQuietTime &&
        notificationType !== NotificationType.EMERGENCY_ALERT
      ) {
        // Queue for later if it's quiet hours (except for emergency alerts)
        const scheduleTime = await this.getNextAvailableTime(recipientUserId);
        return await this.sendTemplatedEmail(
          user.email,
          this.getTemplateIdForNotificationType(notificationType),
          notificationData,
          { scheduledAt: scheduleTime, priority: "normal" },
        );
      }

      // Get template ID for notification type
      const templateId =
        this.getTemplateIdForNotificationType(notificationType);

      // Add common template data
      const enhancedData = {
        ...notificationData,
        recipientName:
          notificationData.recipientName ||
          `${user.firstName} ${user.lastName}`.trim() ||
          user.email,
        unsubscribeUrl:
          ('unsubscribeUrl' in notificationData ? notificationData.unsubscribeUrl : null) ||
          this.generateUnsubscribeUrl(user.id),
        supportEmail: this.config.provider.supportEmail,
        baseUrl: this.config.provider.baseUrl,
      };

      // Set priority based on notification type
      const priority = this.getPriorityForNotificationType(notificationType);

      return await this.sendTemplatedEmail(
        user.email,
        templateId,
        enhancedData,
        {
          priority,
          tags: [notificationType.toLowerCase()],
        },
      );
    } catch (error) {
      console.error("❌ EmailService.sendNotificationEmail error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Send batch emails
   */
  async sendBatchEmails(
    request: BatchEmailRequest,
  ): Promise<BatchEmailResponse> {
    try {
      if (!this.config.features.batching) {
        return {
          success: false,
          errors: [{ email: "batch", error: "Batch sending is not enabled" }],
        };
      }

      const results: EmailResponse[] = [];
      const errors: Array<{ email: string; error: string }> = [];
      let enqueuedCount = 0;

      // Process recipients in batches
      const batchSize = this.config.queueConfig.batchSize;
      for (let i = 0; i < request.recipients.length; i += batchSize) {
        const batch = request.recipients.slice(i, i + batchSize);

        const batchPromises = batch.map(async (recipient) => {
          try {
            const response = await this.sendTemplatedEmail(
              recipient.email,
              request.templateId,
              recipient.templateData,
              {
                scheduledAt: request.scheduledAt,
                priority: request.priority,
                tags: request.tags,
              },
            );

            if (response.success) {
              enqueuedCount++;
            } else {
              errors.push({
                email: recipient.email,
                error: response.error || "Unknown error",
              });
            }

            return response;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            errors.push({ email: recipient.email, error: errorMessage });
            return { success: false, error: errorMessage };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(
          ...batchResults.map((result) =>
            result.status === "fulfilled"
              ? result.value
              : { success: false, error: "Promise rejected" },
          ),
        );

        // Rate limiting: wait between batches
        if (i + batchSize < request.recipients.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second between batches
        }
      }

      return {
        success: enqueuedCount > 0,
        enqueuedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("❌ EmailService.sendBatchEmails error:", error);
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
  }

  /**
   * Handle unsubscribe requests
   */
  async handleUnsubscribe(
    request: UnsubscribeRequest,
  ): Promise<UnsubscribeResponse> {
    try {
      if (!this.config.features.unsubscribeHandling) {
        return {
          success: false,
          message: "Unsubscribe handling is not enabled",
        };
      }

      // Find user by email
      const user = await this.userRepository.getUserByEmail(request.email);
      if (!user) {
        return {
          success: false,
          message: "Email address not found in our system",
        };
      }

      // Get current notification preferences
      await this.notificationRepository.getNotificationPreferences(user.id);

      if (request.allNotifications) {
        // Disable all email notifications
        await this.notificationRepository.upsertNotificationPreferences(
          user.id,
          {
            emailEnabled: false,
          },
        );
      } else if (request.categories && request.categories.length > 0) {
        // Disable specific categories
        const updates: Record<string, boolean> = {};
        request.categories.forEach((category) => {
          const key = `email${category.charAt(0)}${category
            .slice(1)
            .toLowerCase()
            .replace(/_./g, (m) => m[1].toUpperCase())}`;
          updates[key] = false;
        });

        await this.notificationRepository.upsertNotificationPreferences(
          user.id,
          updates,
        );
      }

      return {
        success: true,
        message:
          "You have been successfully unsubscribed from the requested notifications.",
      };
    } catch (error) {
      console.error("❌ EmailService.handleUnsubscribe error:", error);
      return {
        success: false,
        message:
          "An error occurred while processing your unsubscribe request. Please contact support.",
      };
    }
  }

  /**
   * Validate email address
   */
  private async validateEmail(email: string): Promise<EmailValidationResult> {
    // Basic email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        isValid: false,
        reason: "Invalid email format",
        suggestions: ["Please check the email address format"],
      };
    }

    // Additional validation could be added here (DNS checks, etc.)
    return {
      isValid: true,
    };
  }

  /**
   * Process email template with data
   */
  private async processTemplate(
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<{ subject: string; html: string; text?: string }> {
    // Simple template processing (could be enhanced with a proper template engine)
    let processedSubject = template.subject;
    let processedHtml = template.htmlTemplate;
    let processedText = template.textTemplate;

    // Replace variables in templates
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const stringValue = String(value);

      processedSubject = processedSubject.replace(
        new RegExp(placeholder, "g"),
        stringValue,
      );
      processedHtml = processedHtml.replace(
        new RegExp(placeholder, "g"),
        stringValue,
      );

      if (processedText) {
        processedText = processedText.replace(
          new RegExp(placeholder, "g"),
          stringValue,
        );
      }
    });

    return {
      subject: processedSubject,
      html: processedHtml,
      text: processedText,
    };
  }

  /**
   * Get template ID for notification type
   */
  private getTemplateIdForNotificationType(type: NotificationType): string {
    const templateMap: Record<NotificationType, string> = {
      [NotificationType.MESSAGE]: "message-notification",
      [NotificationType.CARE_UPDATE]: "care-update-notification",
      [NotificationType.SYSTEM_ANNOUNCEMENT]:
        "system-announcement-notification",
      [NotificationType.FAMILY_ACTIVITY]: "family-activity-notification",
      [NotificationType.EMERGENCY_ALERT]: "emergency-alert-notification",
    };

    return templateMap[type] || "default-notification";
  }

  /**
   * Get priority for notification type
   */
  private getPriorityForNotificationType(
    type: NotificationType,
  ): "low" | "normal" | "high" | "urgent" {
    switch (type) {
      case NotificationType.EMERGENCY_ALERT:
        return "urgent";
      case NotificationType.CARE_UPDATE:
        return "high";
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return "normal";
      case NotificationType.MESSAGE:
        return "normal";
      case NotificationType.FAMILY_ACTIVITY:
        return "low";
      default:
        return "normal";
    }
  }

  /**
   * Generate unsubscribe URL for user
   */
  private generateUnsubscribeUrl(userId: string): string {
    // In a real implementation, you'd generate a secure token
    const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64");
    return `${this.config.provider.baseUrl}/unsubscribe?token=${token}`;
  }

  /**
   * Get next available time outside of quiet hours
   */
  private async getNextAvailableTime(userId: string): Promise<Date> {
    const preferences =
      await this.notificationRepository.getNotificationPreferences(userId);

    if (
      !preferences?.quietHoursEnabled ||
      !preferences.quietHoursStart ||
      !preferences.quietHoursEnd
    ) {
      return new Date(); // No quiet hours, send immediately
    }

    const now = new Date();
    const [endHour, endMin] = preferences.quietHoursEnd.split(":").map(Number);

    const nextAvailable = new Date(now);
    nextAvailable.setHours(endHour, endMin, 0, 0);

    // If quiet hours end time is today but already passed, schedule for tomorrow
    if (nextAvailable <= now) {
      nextAvailable.setDate(nextAvailable.getDate() + 1);
    }

    return nextAvailable;
  }

  /**
   * Schedule email for later delivery
   */
  private async scheduleEmail(
    emailRequest: EmailRequest,
    scheduledAt: Date,
  ): Promise<EmailResponse> {
    // In a real implementation, this would add to a queue/scheduler
    // For now, we'll just delay the sending
    const delay = scheduledAt.getTime() - Date.now();

    if (delay > 0) {
      setTimeout(
        async () => {
          await this.sendEmail(emailRequest);
        },
        Math.min(delay, 2147483647),
      ); // Max setTimeout value

      return {
        success: true,
        messageId: `scheduled-${Date.now()}`,
        metadata: { scheduledAt: scheduledAt.toISOString() },
      };
    } else {
      // Scheduled time has passed, send immediately
      return await this.sendEmail(emailRequest);
    }
  }

  /**
   * Log email activity for tracking
   */
  private async logEmailActivity(activity: {
    messageId: string;
    recipientEmail: string;
    event: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // In a real implementation, this would store in database
    console.log("📧 Email Activity:", activity);
  }

  /**
   * Get email service health status
   */
  async getHealthStatus(): Promise<{
    provider: string;
    isHealthy: boolean;
    templatesLoaded: number;
    lastError?: string;
  }> {
    try {
      const provider = await this.getProvider();
      const providerHealthy = await provider.validateConfiguration();

      return {
        provider: provider.getName(),
        isHealthy: providerHealthy,
        templatesLoaded: this.templates.size,
      };
    } catch (error) {
      const provider = await this.getProvider();
      return {
        provider: provider.getName(),
        isHealthy: false,
        templatesLoaded: this.templates.size,
        lastError: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
