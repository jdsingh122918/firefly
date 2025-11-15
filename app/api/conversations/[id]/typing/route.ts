import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { broadcastTypingStatus } from "../stream/route";

const conversationRepository = new ConversationRepository();
const userRepository = new UserRepository();

// Validation schema for typing indicator
const typingSchema = z.object({
  isTyping: z.boolean(),
});

/**
 * POST /api/conversations/[id]/typing - Send typing indicator
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { isTyping } = typingSchema.parse(body);

    console.log("⌨️  Typing indicator:", {
      conversationId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      isTyping,
    });

    // Check if user is participant in this conversation
    const isParticipant = await conversationRepository.isUserParticipant(
      conversationId,
      user.id
    );

    if (!isParticipant) {
      return NextResponse.json(
        {
          error: "Access denied: You are not a participant in this conversation",
        },
        { status: 403 }
      );
    }

    // Broadcast typing status to other participants
    const userName = user.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : user.email;

    broadcastTypingStatus(conversationId, user.id, isTyping, userName);

    return NextResponse.json(
      {
        success: true,
        message: "Typing indicator sent",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ POST /api/conversations/[id]/typing error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send typing indicator" },
      { status: 500 }
    );
  }
}