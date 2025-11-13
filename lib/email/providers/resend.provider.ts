import {
  EmailProvider,
  EmailRequest,
  EmailResponse,
  EmailConfiguration,
} from "../types";

export class ResendProvider implements EmailProvider {
  private config: EmailConfiguration;
  private apiKey: string;
  private baseUrl = "https://api.resend.com";

  constructor(config: EmailConfiguration) {
    this.config = config;

    if (!config.apiKey) {
      throw new Error("Resend API key is required");
    }

    this.apiKey = config.apiKey;
  }

  async sendEmail(request: EmailRequest): Promise<EmailResponse> {
    try {
      console.log("📧 ResendProvider.sendEmail - Sending email:", {
        to: Array.isArray(request.to)
          ? request.to.length + " recipients"
          : request.to,
        subject: request.subject,
        hasHtml: !!request.html,
        hasText: !!request.text,
        tags: request.tags,
      });

      // Prepare the request payload for Resend API
      const payload: {
        from: string;
        to: string[];
        subject: string;
        html?: string;
        text?: string;
        cc?: string[];
        bcc?: string[];
        replyTo?: string;
        attachments?: Array<{
          filename: string;
          content: string;
          contentType?: string;
        }>;
        tags?: Array<{ name: string; value: string }>;
        headers?: Record<string, string>;
      } = {
        from:
          request.from || `${this.config.fromName} <${this.config.fromEmail}>`,
        to: Array.isArray(request.to) ? request.to : [request.to],
        subject: request.subject,
      };

      // Add content
      if (request.html) {
        payload.html = request.html;
      }

      if (request.text) {
        payload.text = request.text;
      }

      // Add reply-to if configured
      if (this.config.replyToEmail) {
        payload.replyTo = this.config.replyToEmail;
      }

      // Add tags if provided
      if (request.tags && request.tags.length > 0) {
        payload.tags = request.tags.map((tag) => ({ name: tag, value: tag }));
      }

      // Add attachments if provided
      if (request.attachments && request.attachments.length > 0) {
        payload.attachments = request.attachments
          .filter((attachment) => attachment.content !== undefined)
          .map((attachment) => ({
            filename: attachment.filename,
            content: Buffer.isBuffer(attachment.content)
              ? attachment.content.toString('base64')
              : String(attachment.content),
            contentType: attachment.contentType,
          }));
      }

      // Add custom headers if provided
      if (request.headers) {
        payload.headers = request.headers;
      }

      // Make the API request to Resend
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("❌ Resend API error:", {
          status: response.status,
          statusText: response.statusText,
          error: responseData,
        });

        return {
          success: false,
          error: `Resend API error: ${responseData.message || response.statusText}`,
          metadata: {
            status: response.status,
            resendError: responseData,
          },
        };
      }

      console.log("✅ Email sent successfully via Resend:", {
        messageId: responseData.id,
        to: payload.to,
      });

      return {
        success: true,
        messageId: responseData.id,
        metadata: {
          provider: "resend",
          timestamp: new Date().toISOString(),
          recipients: payload.to.length,
        },
      };
    } catch (error) {
      console.error("❌ ResendProvider.sendEmail error:", error);

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          provider: "resend",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Test the API key by making a request to the domains endpoint
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        console.log("✅ Resend configuration is valid");
        return true;
      } else {
        console.error("❌ Resend configuration validation failed:", {
          status: response.status,
          statusText: response.statusText,
        });
        return false;
      }
    } catch (error) {
      console.error("❌ Resend configuration validation error:", error);
      return false;
    }
  }

  getName(): string {
    return "Resend";
  }

  /**
   * Get delivery status of an email (if supported by Resend)
   */
  async getEmailStatus(messageId: string): Promise<{
    status: "pending" | "sent" | "delivered" | "bounced" | "failed";
    timestamp?: Date;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/emails/${messageId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return {
          status: "failed",
          error: `Failed to get email status: ${response.statusText}`,
        };
      }

      const emailData = await response.json();

      // Map Resend status to our status enum
      const statusMap: Record<
        string,
        "pending" | "sent" | "delivered" | "bounced" | "failed"
      > = {
        queued: "pending",
        sent: "sent",
        delivered: "delivered",
        bounced: "bounced",
        failed: "failed",
        complained: "failed",
      };

      return {
        status: statusMap[emailData.last_event] || "pending",
        timestamp: emailData.created_at
          ? new Date(emailData.created_at)
          : undefined,
      };
    } catch (error) {
      console.error("❌ Error getting email status from Resend:", error);
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cancel a scheduled email (if it's still queued)
   */
  async cancelEmail(messageId: string): Promise<boolean> {
    try {
      // Resend doesn't have a native cancel endpoint, but we could potentially
      // implement this if they add support in the future
      console.log(
        `📧 Cancel email not supported by Resend provider for message: ${messageId}`,
      );
      return false;
    } catch (error) {
      console.error("❌ Error canceling email via Resend:", error);
      return false;
    }
  }

  /**
   * Get domain verification status
   */
  async getDomainStatus(): Promise<{
    domain: string;
    status: "pending" | "verified" | "failed";
    records?: Array<{
      type: string;
      name: string;
      value: string;
      status: "pending" | "verified" | "failed";
    }>;
  } | null> {
    try {
      if (!this.config.domain) {
        return null;
      }

      const response = await fetch(
        `${this.baseUrl}/domains/${this.config.domain}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        console.error(
          "❌ Failed to get domain status from Resend:",
          response.statusText,
        );
        return null;
      }

      const domainData = await response.json();

      return {
        domain: domainData.name,
        status:
          domainData.status === "verified"
            ? "verified"
            : domainData.status === "failed"
              ? "failed"
              : "pending",
        records: domainData.records?.map((record: {
          type: string;
          name: string;
          value: string;
          status?: string;
        }) => ({
          type: record.type,
          name: record.name,
          value: record.value,
          status:
            record.status === "verified"
              ? "verified"
              : record.status === "failed"
                ? "failed"
                : "pending",
        })),
      };
    } catch (error) {
      console.error("❌ Error getting domain status from Resend:", error);
      return null;
    }
  }

  /**
   * Get sending statistics
   */
  async getStats(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _startDate?: Date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _endDate?: Date,
  ): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
  } | null> {
    try {
      // Resend doesn't have a public stats API yet, but this could be implemented
      // when they add analytics endpoints
      console.log("📧 Stats not yet available from Resend API");
      return null;
    } catch (error) {
      console.error("❌ Error getting stats from Resend:", error);
      return null;
    }
  }

  /**
   * List recent emails
   */
  async listEmails(limit: number = 50): Promise<
    Array<{
      id: string;
      to: string[];
      subject: string;
      status: string;
      createdAt: Date;
    }>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/emails?limit=${limit}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          "❌ Failed to list emails from Resend:",
          response.statusText,
        );
        return [];
      }

      const emailsData = await response.json();

      return (
        emailsData.data?.map((email: {
          id: string;
          to: string | string[];
          subject: string;
          last_event?: string;
          created_at: string;
        }) => ({
          id: email.id,
          to: email.to,
          subject: email.subject,
          status: email.last_event || "unknown",
          createdAt: new Date(email.created_at),
        })) || []
      );
    } catch (error) {
      console.error("❌ Error listing emails from Resend:", error);
      return [];
    }
  }
}
