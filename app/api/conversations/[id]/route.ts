import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const conversationRepository = new ConversationRepository();
const userRepository = new UserRepository();

// Validation schema for updating a conversation
const updateConversationSchema = z.object({
  title: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/conversations/[id] - Get conversation details
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

    console.log("💬 GET /api/conversations/[id] - User:", {
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

    // Get conversation details
    const conversation =
      await conversationRepository.getConversationById(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("❌ GET /api/conversations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 },
    );
  }
}

// PUT /api/conversations/[id] - Update conversation
export async function PUT(
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
    const validatedData = updateConversationSchema.parse(body);

    console.log("💬 PUT /api/conversations/[id] - User:", {
      role: user.role,
      email: user.email,
      conversationId,
      data: validatedData,
    });

    // Check if user has manage permissions in this conversation
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

    if (!permissions.canManage) {
      return NextResponse.json(
        {
          error:
            "Access denied: You don't have management permissions for this conversation",
        },
        { status: 403 },
      );
    }

    // Update conversation
    const conversation = await conversationRepository.updateConversation(
      conversationId,
      validatedData,
    );

    return NextResponse.json({
      success: true,
      data: conversation,
      message: "Conversation updated successfully",
    });
  } catch (error) {
    console.error("❌ PUT /api/conversations/[id] error:", error);

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
      { error: "Failed to update conversation" },
      { status: 500 },
    );
  }
}

// DELETE /api/conversations/[id] - Delete/leave conversation
export async function DELETE(
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

    console.log("💬 DELETE /api/conversations/[id] - User:", {
      role: user.role,
      email: user.email,
      conversationId,
    });

    // Get query parameter to determine action
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "leave"; // "leave" or "delete"

    if (action === "delete") {
      // Only admins or conversation managers can delete conversations
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

      const canDelete = user.role === UserRole.ADMIN || permissions.canManage;

      if (!canDelete) {
        return NextResponse.json(
          {
            error:
              "Access denied: Only administrators or conversation managers can delete conversations",
          },
          { status: 403 },
        );
      }

      // Delete conversation (soft delete)
      await conversationRepository.deleteConversation(conversationId);

      return NextResponse.json({
        success: true,
        message: "Conversation deleted successfully",
      });
    } else {
      // Leave conversation (remove participant)
      const isParticipant = await conversationRepository.isUserParticipant(
        conversationId,
        user.id,
      );

      if (!isParticipant) {
        return NextResponse.json(
          { error: "You are not a participant in this conversation" },
          { status: 400 },
        );
      }

      await conversationRepository.removeParticipant(conversationId, user.id);

      return NextResponse.json({
        success: true,
        message: "Left conversation successfully",
      });
    }
  } catch (error) {
    console.error("❌ DELETE /api/conversations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
