import { NotificationType } from "@/lib/types";

// Email provider types
export interface EmailProvider {
  sendEmail(request: EmailRequest): Promise<EmailResponse>;
  validateConfiguration(): Promise<boolean>;
  getName(): string;
}

// Core email interfaces
export interface EmailRequest {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  contentType?: string;
  url?: string;
  path?: string;
}

// Email template system
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: EmailVariable[];
  notificationType?: NotificationType;
  isActive: boolean;
}

export interface EmailVariable {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "date" | "url";
  required: boolean;
  defaultValue?: unknown;
}

// Template data interfaces for different notification types
export interface MessageNotificationData {
  recipientName: string;
  senderName: string;
  conversationTitle: string;
  messagePreview: string;
  conversationUrl: string;
  unsubscribeUrl: string;
  familyName?: string;
  messageCount?: number;
  [key: string]: unknown;
}

export interface CareUpdateNotificationData {
  recipientName: string;
  familyName: string;
  updateTitle: string;
  updateContent: string;
  updateUrl: string;
  updateAuthor: string;
  updateDate: string;
  unsubscribeUrl: string;
  [key: string]: unknown;
}

export interface AnnouncementNotificationData {
  recipientName: string;
  announcementTitle: string;
  announcementContent: string;
  announcementUrl: string;
  authorName: string;
  publishDate: string;
  unsubscribeUrl: string;
  priority?: "low" | "normal" | "high" | "urgent";
  [key: string]: unknown;
}

export interface EmergencyAlertNotificationData {
  recipientName: string;
  alertTitle: string;
  alertContent: string;
  alertUrl: string;
  familyName: string;
  contactInfo: string;
  issueDate: string;
  severity: "low" | "medium" | "high" | "critical";
  [key: string]: unknown;
}

export interface FamilyActivityNotificationData {
  recipientName: string;
  familyName: string;
  activityTitle: string;
  activityDescription: string;
  activityUrl: string;
  activityDate: string;
  participants: string[];
  unsubscribeUrl: string;
  [key: string]: unknown;
}

// Email configuration
export interface EmailConfiguration {
  provider: "resend" | "sendgrid" | "nodemailer" | "aws-ses";
  apiKey?: string;
  domain?: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  webhookSecret?: string;
  baseUrl: string;
  logoUrl?: string;
  supportEmail: string;
  unsubscribeUrl?: string;
}

// Email queue and scheduling
export interface EmailJob {
  id: string;
  recipientId: string;
  recipientEmail: string;
  templateId: string;
  templateData: Record<string, unknown>;
  scheduledAt?: Date;
  priority: "low" | "normal" | "high" | "urgent";
  maxRetries: number;
  currentRetries: number;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  failedAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Email analytics and tracking
export interface EmailMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
}

export interface EmailActivity {
  messageId: string;
  recipientEmail: string;
  event:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "complained"
    | "unsubscribed";
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Batch email operations
export interface BatchEmailRequest {
  templateId: string;
  recipients: Array<{
    email: string;
    templateData: Record<string, unknown>;
  }>;
  scheduledAt?: Date;
  priority?: "low" | "normal" | "high" | "urgent";
  tags?: string[];
}

export interface BatchEmailResponse {
  success: boolean;
  jobId?: string;
  enqueuedCount?: number;
  errors?: Array<{
    email: string;
    error: string;
  }>;
}

// Email service configuration
export interface EmailServiceConfig {
  provider: EmailConfiguration;
  templates: EmailTemplate[];
  queueConfig: {
    maxRetries: number;
    retryDelay: number;
    batchSize: number;
    rateLimitPerMinute: number;
  };
  features: {
    tracking: boolean;
    analytics: boolean;
    webhooks: boolean;
    scheduling: boolean;
    batching: boolean;
    unsubscribeHandling: boolean;
  };
}

// Notification to email mapping
export type NotificationEmailData =
  | MessageNotificationData
  | CareUpdateNotificationData
  | AnnouncementNotificationData
  | EmergencyAlertNotificationData
  | FamilyActivityNotificationData;

// Email validation results
export interface EmailValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

// Unsubscribe handling
export interface UnsubscribeRequest {
  email: string;
  reason?: string;
  categories?: NotificationType[];
  allNotifications?: boolean;
}

export interface UnsubscribeResponse {
  success: boolean;
  message: string;
}

// Email preferences (extends notification preferences)
export interface EmailPreferences {
  userId: string;
  globalUnsubscribe: boolean;
  categories: {
    [key in NotificationType]: {
      enabled: boolean;
      frequency: "immediate" | "hourly" | "daily" | "weekly";
    };
  };
  format: "html" | "text" | "both";
  language: string;
  timezone: string;
  unsubscribeToken: string;
  createdAt: Date;
  updatedAt: Date;
}
