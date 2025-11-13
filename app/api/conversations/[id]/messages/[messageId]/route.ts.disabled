import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { MessageRepository } from "@/lib/db/repositories/message.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import type { MessageMetadata } from "@/lib/types/api";

const conversationRepository = new ConversationRepository();
const messageRepository = new MessageRepository();
const userRepository = new UserRepository();

// Validation schema for updating a message
const updateMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message content is required")
    .max(5000, "Message content must be less than 5000 characters"),
  attachments: z.array(z.string()).optional(),
  metadata: z.custom<MessageMetadata>().optional(),
});

// GET /api/conversations/[id]/messages/[messageId] - Get specific message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
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

    const { id: conversationId, messageId } = await params;

    console.log("📨 GET /api/conversations/[id]/messages/[messageId] - User:", {
      role: user.role,
      email: user.email,
      conversationId,
      messageId,
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

    // Get message
    const message = await messageRepository.getMessageById(messageId);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Verify message belongs to this conversation
    if (message.conversationId !== conversationId) {
      return NextResponse.json(
        { error: "Message does not belong to this conversation" },
        { status: 400 },
      );
    }

    // Mark message as read for current user
    await messageRepository.markMessageAsRead(messageId, user.id);

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error(
      "❌ GET /api/conversations/[id]/messages/[messageId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}

// PUT /api/conversations/[id]/messages/[messageId] - Edit message
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
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

    const { id: conversationId, messageId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateMessageSchema.parse(body);

    console.log("📨 PUT /api/conversations/[id]/messages/[messageId] - User:", {
      role: user.role,
      email: user.email,
      conversationId,
      messageId,
    });

    // Get message to check ownership
    const message = await messageRepository.getMessageById(messageId);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Verify message belongs to this conversation
    if (message.conversationId !== conversationId) {
      return NextResponse.json(
        { error: "Message does not belong to this conversation" },
        { status: 400 },
      );
    }

    // Check if user can edit this message
    const canEdit =
      message.senderId === user.id || user.role === UserRole.ADMIN;

    if (!canEdit) {
      return NextResponse.json(
        { error: "Access denied: You can only edit your own messages" },
        { status: 403 },
      );
    }

    // Check if message is too old to edit (e.g., older than 24 hours)
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours

    if (messageAge > maxEditAge && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Message is too old to edit (24 hour limit)" },
        { status: 403 },
      );
    }

    // Update message
    const updatedMessage = await messageRepository.updateMessage(
      messageId,
      validatedData,
    );

    return NextResponse.json({
      success: true,
      data: updatedMessage,
      message: "Message updated successfully",
    });
  } catch (error) {
    console.error(
      "❌ PUT /api/conversations/[id]/messages/[messageId] error:",
      error,
    );

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
      { error: "Failed to update message" },
      { status: 500 },
    );
  }
}

// DELETE /api/conversations/[id]/messages/[messageId] - Delete message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
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

    const { id: conversationId, messageId } = await params;

    console.log(
      "📨 DELETE /api/conversations/[id]/messages/[messageId] - User:",
      {
        role: user.role,
        email: user.email,
        conversationId,
        messageId,
      },
    );

    // Get message to check ownership
    const message = await messageRepository.getMessageById(messageId);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Verify message belongs to this conversation
    if (message.conversationId !== conversationId) {
      return NextResponse.json(
        { error: "Message does not belong to this conversation" },
        { status: 400 },
      );
    }

    // Check if user can delete this message
    const canDelete =
      message.senderId === user.id || user.role === UserRole.ADMIN;

    if (!canDelete) {
      return NextResponse.json(
        { error: "Access denied: You can only delete your own messages" },
        { status: 403 },
      );
    }

    // Check if message is too old to delete (e.g., older than 24 hours)
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const maxDeleteAge = 24 * 60 * 60 * 1000; // 24 hours

    if (messageAge > maxDeleteAge && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Message is too old to delete (24 hour limit)" },
        { status: 403 },
      );
    }

    // Delete message (soft delete)
    await messageRepository.deleteMessage(messageId);

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error(
      "❌ DELETE /api/conversations/[id]/messages/[messageId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 },
    );
  }
}
