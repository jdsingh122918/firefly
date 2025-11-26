import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { DocumentRepository } from "@/lib/db/repositories/document.repository";
import { databaseFileStorageService } from "@/lib/storage/database-file-storage.service";
import { ResendProvider } from "@/lib/email/providers/resend.provider";
import { EmailAttachment } from "@/lib/email/types";

const feedbackSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be 100 characters or less"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be 2000 characters or less"),
  attachments: z.array(z.string()).optional(),
  isAnonymous: z.boolean(),
  userInfo: z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.string(),
    userId: z.string().optional(),
  }).optional(),
});

type FeedbackData = z.infer<typeof feedbackSchema>;

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user from database
    const userRepository = new UserRepository();
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Parse and validate request
    const body = await request.json();
    const validatedData: FeedbackData = feedbackSchema.parse(body);

    console.log("📧 Processing feedback submission:", {
      title: validatedData.title,
      isAnonymous: validatedData.isAnonymous,
      userName: validatedData.userInfo?.name || "Anonymous",
      userEmail: validatedData.userInfo?.email || "Anonymous",
      userRole: validatedData.userInfo?.role || "Anonymous",
      attachmentCount: validatedData.attachments?.length || 0,
    });

    // 4. Prepare email attachments if any
    const emailAttachments: EmailAttachment[] = [];
    if (validatedData.attachments && validatedData.attachments.length > 0) {
      const documentRepository = new DocumentRepository();

      console.log("📧 Processing attachments:", {
        count: validatedData.attachments.length,
        ids: validatedData.attachments,
      });

      for (const attachmentId of validatedData.attachments) {
        console.log(`📧 Processing attachment: ${attachmentId}`);
        try {
          // Get document metadata
          const document =
            await documentRepository.getDocumentById(attachmentId);
          if (!document) {
            console.warn(
              `📧 Document not found for attachment: ${attachmentId}`,
            );
            continue;
          }

          console.log(`📧 Document found:`, {
            id: document.id,
            fileName: document.fileName,
            originalFileName: document.originalFileName,
            mimeType: document.mimeType,
            fileSize: document.fileSize,
          });

          // Get file content from database
          const fileResult =
            await databaseFileStorageService.readFile(attachmentId);
          if (!fileResult.success || !fileResult.buffer) {
            console.warn(
              `📧 Failed to read file content for: ${attachmentId}`,
              fileResult.error,
            );
            continue;
          }

          console.log(`📧 File data read successfully:`, {
            bufferSize: fileResult.buffer.length,
            mimeType: fileResult.mimeType,
            fileName: fileResult.fileName,
          });

          // Add to email attachments
          emailAttachments.push({
            filename:
              document.originalFileName ||
              document.fileName ||
              `attachment-${attachmentId}`,
            content: fileResult.buffer.toString("base64"),
            contentType: document.mimeType || "application/octet-stream",
          });

          console.log("📧 Added attachment:", {
            filename: document.originalFileName || document.fileName,
            size: fileResult.buffer.length,
            mimeType: document.mimeType,
          });
        } catch (error) {
          console.error(
            `📧 Error processing attachment ${attachmentId}:`,
            error,
          );
        }
      }

      console.log(`📧 Total attachments prepared for email: ${emailAttachments.length}`);
    } else {
      console.log("📧 No attachments in request");
    }

    // 5. Compose email content
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🎯 New Feedback Received</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">From the Firefly platform</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: #f8fafc; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
            <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 20px;">${validatedData.title}</h2>
            <div style="color: #64748b; white-space: pre-wrap; line-height: 1.6; font-size: 15px;">${validatedData.description}</div>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
            ${
              validatedData.isAnonymous || !validatedData.userInfo
                ? `
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">🔒 Submission Type</h3>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; text-align: center;">
                <div style="color: #64748b; font-size: 14px; margin-bottom: 5px;">Anonymous Feedback</div>
                <div style="color: #1e293b; font-weight: 500;">User identity protected</div>
              </div>
            `
                : `
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">📋 User Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500; width: 100px;">Name:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${validatedData.userInfo.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Email:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${validatedData.userInfo.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Role:</td>
                  <td style="padding: 8px 0;">
                    <span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                      ${validatedData.userInfo.role}
                    </span>
                  </td>
                </tr>
              </table>
            `
            }
          </div>

          ${
            emailAttachments.length > 0
              ? `
            <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 25px;">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">📎 Attachments (${emailAttachments.length})</h3>
              <div style="background: #f1f5f9; padding: 15px; border-radius: 6px;">
                ${emailAttachments
                  .map(
                    (attachment) => `
                  <div style="color: #475569; font-size: 14px; margin-bottom: 5px;">• ${attachment.filename}</div>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 25px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">Sent from Firefly Platform</p>
            <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    `;

    const emailText = `
New Feedback Received

Title: ${validatedData.title}

Description:
${validatedData.description}

${
  validatedData.isAnonymous || !validatedData.userInfo
    ? `Submission Type:
Anonymous Feedback - User identity protected`
    : `User Information:
- Name: ${validatedData.userInfo.name}
- Email: ${validatedData.userInfo.email}
- Role: ${validatedData.userInfo.role}`
}

${
  emailAttachments.length > 0
    ? `
Attachments (${emailAttachments.length}):
${emailAttachments.map((att) => `- ${att.filename}`).join("\n")}
`
    : ""
}

Sent from Firefly Platform
Generated on ${new Date().toLocaleString()}
    `.trim();

    // 6. Send email via Resend
    const feedbackEmail = process.env.FEEDBACK_EMAIL;
    if (!feedbackEmail) {
      console.error("❌ Missing FEEDBACK_EMAIL environment variable");
      throw new Error("Email service configuration error: Missing recipient email address");
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("❌ Missing RESEND_API_KEY environment variable");
      throw new Error("Email service configuration error: Missing API credentials");
    }

    const resendProvider = new ResendProvider({
      provider: "resend",
      apiKey: resendApiKey,
      fromEmail: "noreply@feedback.thanacare.org",
      fromName: "Firefly Feedback",
      baseUrl: "https://api.resend.com",
      supportEmail: feedbackEmail,
    });

    console.log("📧 Sending email with attachments:", {
      to: feedbackEmail,
      subject: `[Firefly Feedback] ${validatedData.title}`,
      attachmentCount: emailAttachments.length,
      attachments: emailAttachments.map(a => ({
        filename: a.filename,
        contentType: a.contentType,
        contentLength: typeof a.content === 'string' ? a.content.length : 0,
      })),
    });

    const emailResult = await resendProvider.sendEmail({
      to: feedbackEmail,
      subject: `[Firefly Feedback] ${validatedData.title}`,
      html: emailHtml,
      text: emailText,
      attachments: emailAttachments,
      tags: [
        "feedback",
        "user-feedback",
        validatedData.isAnonymous ? "anonymous" : validatedData.userInfo?.role?.toLowerCase() || "unknown",
      ],
    });

    if (!emailResult.success) {
      console.error("❌ Email sending failed:", emailResult.error);
      throw new Error(`Email delivery failed: ${emailResult.error || 'Unknown email service error'}`);
    }

    console.log("✅ Feedback email sent successfully:", {
      messageId: emailResult.messageId,
      to: feedbackEmail,
      attachmentCount: emailAttachments.length,
    });

    // 7. Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Feedback submitted successfully",
        messageId: emailResult.messageId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Feedback submission error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', '),
        },
        { status: 400 },
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Categorize errors for better user experience
    let statusCode = 500;
    let userFriendlyError = "Failed to submit feedback";

    if (errorMessage.includes("configuration error") || errorMessage.includes("environment variable")) {
      statusCode = 503;
      userFriendlyError = "Feedback service is temporarily unavailable";
    } else if (errorMessage.includes("Email delivery failed")) {
      statusCode = 502;
      userFriendlyError = "Unable to send feedback email";
    } else if (errorMessage.includes("User not found") || errorMessage.includes("Unauthorized")) {
      statusCode = 401;
      userFriendlyError = "Authentication required";
    } else if (errorMessage.includes("Document not found") || errorMessage.includes("attachment")) {
      statusCode = 400;
      userFriendlyError = "Attachment processing failed";
    }

    return NextResponse.json(
      {
        error: userFriendlyError,
        details: errorMessage,
      },
      { status: statusCode },
    );
  }
}
