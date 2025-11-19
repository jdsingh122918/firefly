import { EmailServiceConfig, EmailConfiguration } from "./types";
import { defaultEmailTemplates } from "./templates";

// Email service configuration for different environments
export class EmailConfigManager {
  private static instance: EmailConfigManager;
  private config: EmailServiceConfig | null = null;

  private constructor() {}

  static getInstance(): EmailConfigManager {
    if (!EmailConfigManager.instance) {
      EmailConfigManager.instance = new EmailConfigManager();
    }
    return EmailConfigManager.instance;
  }

  /**
   * Initialize email configuration
   */
  initialize(overrides?: Partial<EmailServiceConfig>): void {
    const baseConfig = this.createDefaultConfig();

    if (overrides) {
      this.config = {
        ...baseConfig,
        ...overrides,
        provider: { ...baseConfig.provider, ...overrides.provider },
        queueConfig: { ...baseConfig.queueConfig, ...overrides.queueConfig },
        features: { ...baseConfig.features, ...overrides.features },
      };
    } else {
      this.config = baseConfig;
    }

    console.log("📧 Email service configured:", {
      provider: this.config.provider.provider,
      fromEmail: this.config.provider.fromEmail,
      templatesLoaded: this.config.templates.length,
      featuresEnabled: Object.entries(this.config.features)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): EmailServiceConfig {
    if (!this.config) {
      throw new Error(
        "Email service not initialized. Call initialize() first.",
      );
    }
    return this.config;
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Create default configuration based on environment variables
   */
  private createDefaultConfig(): EmailServiceConfig {
    // Get configuration from environment variables
    const provider: EmailConfiguration = {
      provider: (process.env.EMAIL_PROVIDER as "resend" | "sendgrid" | "nodemailer" | "aws-ses") || "resend",
      apiKey: process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY,
      domain: process.env.EMAIL_DOMAIN,
      fromEmail: process.env.EMAIL_FROM_ADDRESS || "noreply@firefly.care",
      fromName: process.env.EMAIL_FROM_NAME || "Firefly Care Team",
      replyToEmail: process.env.EMAIL_REPLY_TO,
      webhookSecret: process.env.EMAIL_WEBHOOK_SECRET,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      logoUrl: process.env.EMAIL_LOGO_URL,
      supportEmail: process.env.EMAIL_SUPPORT_ADDRESS || "support@firefly.care",
      unsubscribeUrl: process.env.EMAIL_UNSUBSCRIBE_URL,
    };

    return {
      provider,
      templates: defaultEmailTemplates,
      queueConfig: {
        maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || "3"),
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || "30000"), // 30 seconds
        batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || "10"),
        rateLimitPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT || "60"),
      },
      features: {
        tracking: process.env.EMAIL_TRACKING_ENABLED !== "false",
        analytics: process.env.EMAIL_ANALYTICS_ENABLED !== "false",
        webhooks: process.env.EMAIL_WEBHOOKS_ENABLED !== "false",
        scheduling: process.env.EMAIL_SCHEDULING_ENABLED !== "false",
        batching: process.env.EMAIL_BATCHING_ENABLED !== "false",
        unsubscribeHandling:
          process.env.EMAIL_UNSUBSCRIBE_HANDLING_ENABLED !== "false",
      },
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(config?: EmailServiceConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const configToValidate = config || this.config;
    const errors: string[] = [];

    if (!configToValidate) {
      errors.push("Email configuration is not initialized");
      return { isValid: false, errors };
    }

    // Validate provider configuration
    if (!configToValidate.provider.apiKey) {
      errors.push("Email provider API key is required");
    }

    if (!configToValidate.provider.fromEmail) {
      errors.push("From email address is required");
    }

    if (!configToValidate.provider.fromName) {
      errors.push("From name is required");
    }

    if (!configToValidate.provider.baseUrl) {
      errors.push("Base URL is required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      configToValidate.provider.fromEmail &&
      !emailRegex.test(configToValidate.provider.fromEmail)
    ) {
      errors.push("From email address is not valid");
    }

    if (
      configToValidate.provider.replyToEmail &&
      !emailRegex.test(configToValidate.provider.replyToEmail)
    ) {
      errors.push("Reply-to email address is not valid");
    }

    if (
      configToValidate.provider.supportEmail &&
      !emailRegex.test(configToValidate.provider.supportEmail)
    ) {
      errors.push("Support email address is not valid");
    }

    // Validate templates
    if (
      !configToValidate.templates ||
      configToValidate.templates.length === 0
    ) {
      errors.push("At least one email template is required");
    }

    // Validate queue configuration
    if (configToValidate.queueConfig.maxRetries < 0) {
      errors.push("Max retries must be non-negative");
    }

    if (configToValidate.queueConfig.retryDelay < 0) {
      errors.push("Retry delay must be non-negative");
    }

    if (configToValidate.queueConfig.batchSize < 1) {
      errors.push("Batch size must be at least 1");
    }

    if (configToValidate.queueConfig.rateLimitPerMinute < 1) {
      errors.push("Rate limit must be at least 1 per minute");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EmailServiceConfig>): void {
    if (!this.config) {
      throw new Error(
        "Email service not initialized. Call initialize() first.",
      );
    }

    this.config = {
      ...this.config,
      ...updates,
      provider: { ...this.config.provider, ...updates.provider },
      queueConfig: { ...this.config.queueConfig, ...updates.queueConfig },
      features: { ...this.config.features, ...updates.features },
    };

    // Validate updated configuration
    const validation = this.validateConfig();
    if (!validation.isValid) {
      console.warn(
        "⚠️ Email configuration validation warnings:",
        validation.errors,
      );
    }
  }

  /**
   * Get configuration for specific environment
   */
  static getEnvironmentConfig(
    environment: "development" | "staging" | "production",
  ): Partial<EmailServiceConfig> {
    switch (environment) {
      case "development":
        return {
          provider: {
            provider: "nodemailer" as const,
            fromEmail: "dev@firefly.localhost",
            fromName: "Firefly (Dev)",
            baseUrl: "http://localhost:3000",
            supportEmail: "support@firefly.localhost",
          },
          features: {
            tracking: false,
            analytics: false,
            webhooks: false,
            scheduling: true,
            batching: false,
            unsubscribeHandling: true,
          },
          queueConfig: {
            maxRetries: 1,
            retryDelay: 5000,
            batchSize: 5,
            rateLimitPerMinute: 30,
          },
        };

      case "staging":
        return {
          provider: {
            provider: "resend" as const,
            fromEmail: "staging@firefly.care",
            fromName: "Firefly (Staging)",
            baseUrl: "https://staging.firefly.care",
            supportEmail: "support@firefly.care",
          },
          features: {
            tracking: true,
            analytics: true,
            webhooks: true,
            scheduling: true,
            batching: true,
            unsubscribeHandling: true,
          },
          queueConfig: {
            maxRetries: 2,
            retryDelay: 15000,
            batchSize: 8,
            rateLimitPerMinute: 45,
          },
        };

      case "production":
        return {
          provider: {
            provider: "resend" as const,
            fromEmail: "noreply@firefly.care",
            fromName: "Firefly",
            baseUrl: "https://app.firefly.care",
            supportEmail: "support@firefly.care",
          },
          features: {
            tracking: true,
            analytics: true,
            webhooks: true,
            scheduling: true,
            batching: true,
            unsubscribeHandling: true,
          },
          queueConfig: {
            maxRetries: 3,
            retryDelay: 30000,
            batchSize: 10,
            rateLimitPerMinute: 60,
          },
        };

      default:
        return {};
    }
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = null;
    this.initialize();
  }

  /**
   * Get provider-specific configuration requirements
   */
  static getProviderRequirements(provider: string): {
    requiredEnvVars: string[];
    optionalEnvVars: string[];
    description: string;
  } {
    switch (provider) {
      case "resend":
        return {
          requiredEnvVars: ["RESEND_API_KEY"],
          optionalEnvVars: ["EMAIL_DOMAIN", "EMAIL_WEBHOOK_SECRET"],
          description:
            "Resend email provider - modern email API for developers",
        };

      case "sendgrid":
        return {
          requiredEnvVars: ["SENDGRID_API_KEY"],
          optionalEnvVars: ["EMAIL_DOMAIN", "EMAIL_WEBHOOK_SECRET"],
          description:
            "SendGrid email provider - reliable email delivery service",
        };

      case "nodemailer":
        return {
          requiredEnvVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
          optionalEnvVars: ["SMTP_SECURE", "SMTP_TLS"],
          description: "Nodemailer SMTP provider - flexible email sending",
        };

      default:
        return {
          requiredEnvVars: [],
          optionalEnvVars: [],
          description: "Unknown email provider",
        };
    }
  }
}

// Export singleton instance
export const emailConfig = EmailConfigManager.getInstance();
