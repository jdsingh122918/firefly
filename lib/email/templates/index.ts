import { EmailTemplate } from "../types";
import { NotificationType } from "@/lib/types";

// Base template styles
const baseStyles = `
<style>
  .email-container {
    max-width: 600px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
  }
  .email-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px 20px;
    text-align: center;
  }
  .email-body {
    padding: 30px 20px;
    background: #ffffff;
  }
  .email-footer {
    padding: 20px;
    background: #f8f9fa;
    border-top: 1px solid #dee2e6;
    text-align: center;
    font-size: 14px;
    color: #6c757d;
  }
  .button {
    display: inline-block;
    padding: 12px 24px;
    background: #667eea;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    margin: 20px 0;
    font-weight: 600;
  }
  .urgent {
    background: #dc3545;
  }
  .high-priority {
    background: #fd7e14;
  }
  .notification-content {
    background: #f8f9fa;
    padding: 20px;
    border-left: 4px solid #667eea;
    margin: 20px 0;
    border-radius: 0 6px 6px 0;
  }
  .emergency-content {
    background: #fff5f5;
    border-left-color: #dc3545;
  }
  .care-content {
    background: #fff8f0;
    border-left-color: #fd7e14;
  }
  .unsubscribe {
    font-size: 12px;
    color: #6c757d;
    margin-top: 20px;
  }
  .unsubscribe a {
    color: #6c757d;
    text-decoration: underline;
  }
</style>
`;

// Message notification template
export const messageNotificationTemplate: EmailTemplate = {
  id: "message-notification",
  name: "New Message Notification",
  subject: "New message from {{senderName}}",
  htmlTemplate: `
    ${baseStyles}
    <div class="email-container">
      <div class="email-header">
        <h1>💬 New Message</h1>
        <p>You have received a new message in Firefly</p>
      </div>
      <div class="email-body">
        <h2>Hello {{recipientName}},</h2>

        <p><strong>{{senderName}}</strong> sent you a message{{#if familyName}} in the <strong>{{familyName}}</strong> family{{/if}}.</p>

        {{#if conversationTitle}}
        <p><strong>Conversation:</strong> {{conversationTitle}}</p>
        {{/if}}

        <div class="notification-content">
          <p><strong>Message Preview:</strong></p>
          <p>{{messagePreview}}</p>
        </div>

        <p>
          <a href="{{conversationUrl}}" class="button">View Message</a>
        </p>

        {{#if messageCount}}
        <p><em>You have {{messageCount}} unread message(s) in this conversation.</em></p>
        {{/if}}

        <p>Best regards,<br>The Firefly Team</p>
      </div>
      <div class="email-footer">
        <p>This email was sent to help you stay connected with your care community.</p>
        <div class="unsubscribe">
          <p><a href="{{unsubscribeUrl}}">Unsubscribe from message notifications</a> | <a href="{{baseUrl}}/support">Contact Support</a></p>
        </div>
      </div>
    </div>
  `,
  textTemplate: `
New Message - Firefly

Hello {{recipientName}},

{{senderName}} sent you a message{{#if familyName}} in the {{familyName}} family{{/if}}.

{{#if conversationTitle}}
Conversation: {{conversationTitle}}
{{/if}}

Message Preview:
{{messagePreview}}

View the message: {{conversationUrl}}

{{#if messageCount}}
You have {{messageCount}} unread message(s) in this conversation.
{{/if}}

Best regards,
The Firefly Team

---
Unsubscribe: {{unsubscribeUrl}}
Support: {{baseUrl}}/support
  `,
  variables: [
    {
      name: "recipientName",
      description: "Name of the email recipient",
      type: "string",
      required: true,
    },
    {
      name: "senderName",
      description: "Name of the message sender",
      type: "string",
      required: true,
    },
    {
      name: "conversationTitle",
      description: "Title of the conversation",
      type: "string",
      required: false,
    },
    {
      name: "messagePreview",
      description: "Preview of the message content",
      type: "string",
      required: true,
    },
    {
      name: "conversationUrl",
      description: "URL to view the conversation",
      type: "url",
      required: true,
    },
    {
      name: "familyName",
      description: "Name of the family if applicable",
      type: "string",
      required: false,
    },
    {
      name: "messageCount",
      description: "Number of unread messages",
      type: "number",
      required: false,
    },
    {
      name: "unsubscribeUrl",
      description: "URL to unsubscribe",
      type: "url",
      required: true,
    },
    {
      name: "baseUrl",
      description: "Base URL of the application",
      type: "url",
      required: true,
    },
  ],
  notificationType: NotificationType.MESSAGE,
  isActive: true,
};

// Care update notification template
export const careUpdateNotificationTemplate: EmailTemplate = {
  id: "care-update-notification",
  name: "Care Update Notification",
  subject: "Care update for {{familyName}}",
  htmlTemplate: `
    ${baseStyles}
    <div class="email-container">
      <div class="email-header">
        <h1>🏥 Care Update</h1>
        <p>Important care information for your family</p>
      </div>
      <div class="email-body">
        <h2>Hello {{recipientName}},</h2>

        <p>A care update has been posted for the <strong>{{familyName}}</strong> family.</p>

        <div class="notification-content care-content">
          <h3>{{updateTitle}}</h3>
          <p>{{updateContent}}</p>
          <p><strong>Update by:</strong> {{updateAuthor}}<br>
          <strong>Date:</strong> {{updateDate}}</p>
        </div>

        <p>
          <a href="{{updateUrl}}" class="button high-priority">View Full Update</a>
        </p>

        <p>If you have any questions about this update, please don't hesitate to reach out to your care coordinator.</p>

        <p>With care,<br>The Firefly Team</p>
      </div>
      <div class="email-footer">
        <p>This update helps keep everyone informed about important care developments.</p>
        <div class="unsubscribe">
          <p><a href="{{unsubscribeUrl}}">Unsubscribe from care updates</a> | <a href="{{baseUrl}}/support">Contact Support</a></p>
        </div>
      </div>
    </div>
  `,
  textTemplate: `
Care Update - Firefly

Hello {{recipientName}},

A care update has been posted for the {{familyName}} family.

{{updateTitle}}
{{updateContent}}

Update by: {{updateAuthor}}
Date: {{updateDate}}

View full update: {{updateUrl}}

If you have any questions about this update, please don't hesitate to reach out to your care coordinator.

With care,
The Firefly Team

---
Unsubscribe: {{unsubscribeUrl}}
Support: {{baseUrl}}/support
  `,
  variables: [
    {
      name: "recipientName",
      description: "Name of the email recipient",
      type: "string",
      required: true,
    },
    {
      name: "familyName",
      description: "Name of the family",
      type: "string",
      required: true,
    },
    {
      name: "updateTitle",
      description: "Title of the care update",
      type: "string",
      required: true,
    },
    {
      name: "updateContent",
      description: "Content of the care update",
      type: "string",
      required: true,
    },
    {
      name: "updateAuthor",
      description: "Author of the update",
      type: "string",
      required: true,
    },
    {
      name: "updateDate",
      description: "Date of the update",
      type: "date",
      required: true,
    },
    {
      name: "updateUrl",
      description: "URL to view the full update",
      type: "url",
      required: true,
    },
    {
      name: "unsubscribeUrl",
      description: "URL to unsubscribe",
      type: "url",
      required: true,
    },
    {
      name: "baseUrl",
      description: "Base URL of the application",
      type: "url",
      required: true,
    },
  ],
  notificationType: NotificationType.CARE_UPDATE,
  isActive: true,
};

// Emergency alert template
export const emergencyAlertTemplate: EmailTemplate = {
  id: "emergency-alert-notification",
  name: "Emergency Alert Notification",
  subject: "🚨 URGENT: {{alertTitle}}",
  htmlTemplate: `
    ${baseStyles}
    <div class="email-container">
      <div class="email-header" style="background: #dc3545;">
        <h1>🚨 EMERGENCY ALERT</h1>
        <p>Immediate attention required</p>
      </div>
      <div class="email-body">
        <h2>{{recipientName}},</h2>

        <div class="notification-content emergency-content">
          <h3>{{alertTitle}}</h3>
          <p><strong>Family:</strong> {{familyName}}</p>
          <p><strong>Severity:</strong> {{severity}}</p>
          <p><strong>Alert Details:</strong></p>
          <p>{{alertContent}}</p>
          <p><strong>Time:</strong> {{issueDate}}</p>
        </div>

        <p>
          <a href="{{alertUrl}}" class="button urgent">View Emergency Details</a>
        </p>

        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border: 1px solid #ffeaa7; margin: 20px 0;">
          <p><strong>Emergency Contact Information:</strong></p>
          <p>{{contactInfo}}</p>
        </div>

        <p><strong>Please take immediate action as appropriate for this emergency.</strong></p>

        <p>Firefly Emergency System</p>
      </div>
      <div class="email-footer">
        <p>This is an automated emergency notification. Emergency alerts cannot be unsubscribed from.</p>
        <div class="unsubscribe">
          <p><a href="{{baseUrl}}/support">Contact Support</a></p>
        </div>
      </div>
    </div>
  `,
  textTemplate: `
🚨 EMERGENCY ALERT - Firefly

{{recipientName}},

IMMEDIATE ATTENTION REQUIRED

Alert: {{alertTitle}}
Family: {{familyName}}
Severity: {{severity}}
Time: {{issueDate}}

Details:
{{alertContent}}

View Emergency Details: {{alertUrl}}

Emergency Contact Information:
{{contactInfo}}

Please take immediate action as appropriate for this emergency.

Firefly Emergency System

---
Support: {{baseUrl}}/support
  `,
  variables: [
    {
      name: "recipientName",
      description: "Name of the email recipient",
      type: "string",
      required: true,
    },
    {
      name: "alertTitle",
      description: "Title of the emergency alert",
      type: "string",
      required: true,
    },
    {
      name: "alertContent",
      description: "Content of the emergency alert",
      type: "string",
      required: true,
    },
    {
      name: "alertUrl",
      description: "URL to view emergency details",
      type: "url",
      required: true,
    },
    {
      name: "familyName",
      description: "Name of the affected family",
      type: "string",
      required: true,
    },
    {
      name: "contactInfo",
      description: "Emergency contact information",
      type: "string",
      required: true,
    },
    {
      name: "issueDate",
      description: "Date and time of the emergency",
      type: "date",
      required: true,
    },
    {
      name: "severity",
      description: "Severity level of the emergency",
      type: "string",
      required: true,
    },
    {
      name: "baseUrl",
      description: "Base URL of the application",
      type: "url",
      required: true,
    },
  ],
  notificationType: NotificationType.EMERGENCY_ALERT,
  isActive: true,
};

// System announcement template
export const systemAnnouncementTemplate: EmailTemplate = {
  id: "system-announcement-notification",
  name: "System Announcement Notification",
  subject: "📢 {{announcementTitle}}",
  htmlTemplate: `
    ${baseStyles}
    <div class="email-container">
      <div class="email-header">
        <h1>📢 Announcement</h1>
        <p>Important news from Firefly</p>
      </div>
      <div class="email-body">
        <h2>Hello {{recipientName}},</h2>

        <div class="notification-content">
          <h3>{{announcementTitle}}</h3>
          <p>{{announcementContent}}</p>
          <p><strong>Published by:</strong> {{authorName}}<br>
          <strong>Date:</strong> {{publishDate}}</p>

          {{#if priority}}
          {{#eq priority "urgent"}}
          <p style="color: #dc3545; font-weight: bold;">⚠️ This is an urgent announcement</p>
          {{/eq}}
          {{#eq priority "high"}}
          <p style="color: #fd7e14; font-weight: bold;">🔔 This is a high priority announcement</p>
          {{/eq}}
          {{/if}}
        </div>

        <p>
          <a href="{{announcementUrl}}" class="button">Read Full Announcement</a>
        </p>

        <p>Thank you for being part of our care community.</p>

        <p>Best regards,<br>The Firefly Team</p>
      </div>
      <div class="email-footer">
        <p>Stay informed about important updates and improvements to Firefly.</p>
        <div class="unsubscribe">
          <p><a href="{{unsubscribeUrl}}">Unsubscribe from announcements</a> | <a href="{{baseUrl}}/support">Contact Support</a></p>
        </div>
      </div>
    </div>
  `,
  textTemplate: `
Announcement - Firefly

Hello {{recipientName}},

{{announcementTitle}}

{{announcementContent}}

Published by: {{authorName}}
Date: {{publishDate}}

{{#if priority}}
{{#eq priority "urgent"}}
⚠️ This is an urgent announcement
{{/eq}}
{{#eq priority "high"}}
🔔 This is a high priority announcement
{{/eq}}
{{/if}}

Read full announcement: {{announcementUrl}}

Thank you for being part of our care community.

Best regards,
The Firefly Team

---
Unsubscribe: {{unsubscribeUrl}}
Support: {{baseUrl}}/support
  `,
  variables: [
    {
      name: "recipientName",
      description: "Name of the email recipient",
      type: "string",
      required: true,
    },
    {
      name: "announcementTitle",
      description: "Title of the announcement",
      type: "string",
      required: true,
    },
    {
      name: "announcementContent",
      description: "Content of the announcement",
      type: "string",
      required: true,
    },
    {
      name: "announcementUrl",
      description: "URL to view the full announcement",
      type: "url",
      required: true,
    },
    {
      name: "authorName",
      description: "Author of the announcement",
      type: "string",
      required: true,
    },
    {
      name: "publishDate",
      description: "Publication date of the announcement",
      type: "date",
      required: true,
    },
    {
      name: "priority",
      description: "Priority level of the announcement",
      type: "string",
      required: false,
    },
    {
      name: "unsubscribeUrl",
      description: "URL to unsubscribe",
      type: "url",
      required: true,
    },
    {
      name: "baseUrl",
      description: "Base URL of the application",
      type: "url",
      required: true,
    },
  ],
  notificationType: NotificationType.SYSTEM_ANNOUNCEMENT,
  isActive: true,
};

// Family activity template
export const familyActivityTemplate: EmailTemplate = {
  id: "family-activity-notification",
  name: "Family Activity Notification",
  subject: "👨‍👩‍👧‍👦 {{activityTitle}} - {{familyName}}",
  htmlTemplate: `
    ${baseStyles}
    <div class="email-container">
      <div class="email-header">
        <h1>👨‍👩‍👧‍👦 Family Activity</h1>
        <p>New activity in your care community</p>
      </div>
      <div class="email-body">
        <h2>Hello {{recipientName}},</h2>

        <p>There's new activity in the <strong>{{familyName}}</strong> family.</p>

        <div class="notification-content">
          <h3>{{activityTitle}}</h3>
          <p>{{activityDescription}}</p>
          <p><strong>Date:</strong> {{activityDate}}</p>

          {{#if participants}}
          <p><strong>Participants:</strong> {{participants}}</p>
          {{/if}}
        </div>

        <p>
          <a href="{{activityUrl}}" class="button">View Activity</a>
        </p>

        <p>Stay connected with your care community.</p>

        <p>Warm regards,<br>The Firefly Team</p>
      </div>
      <div class="email-footer">
        <p>Family activity notifications help keep everyone connected and informed.</p>
        <div class="unsubscribe">
          <p><a href="{{unsubscribeUrl}}">Unsubscribe from family activity notifications</a> | <a href="{{baseUrl}}/support">Contact Support</a></p>
        </div>
      </div>
    </div>
  `,
  textTemplate: `
Family Activity - Firefly

Hello {{recipientName}},

There's new activity in the {{familyName}} family.

{{activityTitle}}
{{activityDescription}}

Date: {{activityDate}}
{{#if participants}}
Participants: {{participants}}
{{/if}}

View activity: {{activityUrl}}

Stay connected with your care community.

Warm regards,
The Firefly Team

---
Unsubscribe: {{unsubscribeUrl}}
Support: {{baseUrl}}/support
  `,
  variables: [
    {
      name: "recipientName",
      description: "Name of the email recipient",
      type: "string",
      required: true,
    },
    {
      name: "familyName",
      description: "Name of the family",
      type: "string",
      required: true,
    },
    {
      name: "activityTitle",
      description: "Title of the family activity",
      type: "string",
      required: true,
    },
    {
      name: "activityDescription",
      description: "Description of the activity",
      type: "string",
      required: true,
    },
    {
      name: "activityUrl",
      description: "URL to view the activity",
      type: "url",
      required: true,
    },
    {
      name: "activityDate",
      description: "Date of the activity",
      type: "date",
      required: true,
    },
    {
      name: "participants",
      description: "List of participants",
      type: "string",
      required: false,
    },
    {
      name: "unsubscribeUrl",
      description: "URL to unsubscribe",
      type: "url",
      required: true,
    },
    {
      name: "baseUrl",
      description: "Base URL of the application",
      type: "url",
      required: true,
    },
  ],
  notificationType: NotificationType.FAMILY_ACTIVITY,
  isActive: true,
};

// Export all templates
export const defaultEmailTemplates: EmailTemplate[] = [
  messageNotificationTemplate,
  careUpdateNotificationTemplate,
  emergencyAlertTemplate,
  systemAnnouncementTemplate,
  familyActivityTemplate,
];

// Helper function to get template by ID
export function getTemplateById(templateId: string): EmailTemplate | undefined {
  return defaultEmailTemplates.find((template) => template.id === templateId);
}

// Helper function to get templates by notification type
export function getTemplatesByType(type: NotificationType): EmailTemplate[] {
  return defaultEmailTemplates.filter(
    (template) => template.notificationType === type,
  );
}
