import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { MessageRepository } from "@/lib/db/repositories/message.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationType } from "@/lib/types";
import type { MessageMetadata } from "@/lib/types/api";
import { broadcastToConversation } from "../stream/route";

const conversationRepository = new ConversationRepository();
const messageRepository = new MessageRepository();
const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

// Validation schema for creating a message
const createMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message content is required")
    .max(5000, "Message content must be less than 5000 characters"),
  replyToId: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  metadata: z.custom<MessageMetadata>().optional(),
});

// GET /api/conversations/[id]/messages - Get messages for conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const conversationId = id;

    console.log("📨 GET /api/conversations/[id]/messages - User:", {
      role: user.role,
      email: user.email,
      conversationId,
    });

    // Check if user is participant in this conversation
    const isParticipant = await conversationRepository.isUserParticipant(
      conversationId,
      user.id,
    );

    if (!isParticipant) {
      return NextResponse.json(
        {
          error:
            "Access denied: You are not a participant in this conversation",
        },
        { status: 403 },
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortOrder = (searchParams.get("sortOrder") || "desc") as
      | "asc"
      | "desc";

    // Get messages for conversation
    const messages = await messageRepository.getMessagesForConversation(
      conversationId,
      {
        query: query || undefined,
        page,
        limit,
        sortOrder,
      },
    );

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("❌ GET /api/conversations/[id]/messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

// POST /api/conversations/[id]/messages - Send new message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const conversationId = id;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createMessageSchema.parse(body);

    console.log("📨 POST /api/conversations/[id]/messages - User:", {
      role: user.role,
      email: user.email,
      conversationId,
      contentLength: validatedData.content.length,
    });

    // Check if user is participant in this conversation
    const permissions = await conversationRepository.getUserPermissions(
      conversationId,
      user.id,
    );

    if (!permissions) {
      return NextResponse.json(
        {
          error:
            "Access denied: You are not a participant in this conversation",
        },
        { status: 403 },
      );
    }

    if (!permissions.canWrite) {
      return NextResponse.json(
        {
          error:
            "Access denied: You don't have permission to send messages in this conversation",
        },
        { status: 403 },
      );
    }

    // Validate reply-to message if specified
    if (validatedData.replyToId) {
      const replyToMessage = await messageRepository.getMessageById(
        validatedData.replyToId,
      );
      if (!replyToMessage || replyToMessage.conversationId !== conversationId) {
        return NextResponse.json(
          { error: "Invalid reply-to message" },
          { status: 400 },
        );
      }
    }

    // Create message
    const message = await messageRepository.createMessage({
      content: validatedData.content,
      conversationId,
      senderId: user.id,
      replyToId: validatedData.replyToId,
      attachments: validatedData.attachments,
      metadata: validatedData.metadata,
    });

    // Broadcast new message to all connected clients in real-time
    console.log("💬 Preparing to broadcast new message:", {
      conversationId,
      messageId: message.id,
      senderId: user.id,
      senderEmail: user.email,
      content: message.content.substring(0, 50) + (message.content.length > 50 ? "..." : ""),
      timestamp: new Date().toISOString()
    });

    broadcastToConversation(conversationId, {
      type: "new_message",
      data: {
        message,
        conversationId,
        timestamp: new Date().toISOString(),
      },
    });

    // Create notifications for other participants
    await createMessageNotifications(conversationId, message.id, user.id);

    return NextResponse.json(
      {
        success: true,
        data: message,
        message: "Message sent successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ POST /api/conversations/[id]/messages error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications for message
async function createMessageNotifications(
  conversationId: string,
  messageId: string,
  senderId: string,
): Promise<void> {
  try {
    // Get conversation details
    const conversation =
      await conversationRepository.getConversationById(conversationId);
    if (!conversation) return;

    // Get sender details
    const sender = await userRepository.getUserById(senderId);
    if (!sender) return;

    // Get other participants (exclude sender)
    const otherParticipants =
      conversation.participants?.filter(
        (p: any) => p.userId !== senderId && !p.leftAt,
      ) || [];

    // Create notifications for each participant with role-based actionUrl
    const notifications = await Promise.all(
      otherParticipants.map(async (participant: any) => {
        // Get participant's role for correct routing
        const participantUser = await userRepository.getUserById(participant.userId);
        const role = participantUser?.role?.toLowerCase() || 'member';

        return {
          userId: participant.userId,
          type: NotificationType.MESSAGE,
          title:
            conversation.title ||
            `Message from ${sender.firstName} ${sender.lastName}`,
          message: `New message in ${conversation.title || "conversation"}`,
          data: {
            messageId,
            conversationId,
            senderId,
            senderName: `${sender.firstName} ${sender.lastName}`,
          },
          actionUrl: `/${role}/chat/${conversationId}`,
        };
      })
    );

    // Create notifications in parallel
    await Promise.all(
      notifications.map((notification: any) =>
        notificationRepository.createNotification(notification),
      ),
    );
  } catch (error) {
    console.error("❌ Failed to create message notifications:", error);
    // Don't throw error as this is not critical for message sending
  }
}
