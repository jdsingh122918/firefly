import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const conversationRepository = new ConversationRepository();
const userRepository = new UserRepository();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get params
    const { id, userId: targetUserId } = await params;
    const conversationId = id;

    // Resolve Clerk ID to database user ID for the requesting user
    const requestingUser = await userRepository.getUserByClerkId(clerkUserId);
    if (!requestingUser) {
      return NextResponse.json(
        { success: false, error: "Requesting user not found" },
        { status: 404 }
      );
    }

    // Check if the requesting user is a participant in the conversation
    const isParticipant = await conversationRepository.isUserParticipant(
      conversationId,
      requestingUser.id
    );

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, error: "Access denied: You must be a participant in this conversation" },
        { status: 403 }
      );
    }

    // For now, only allow self-removal (user removing themselves)
    // This aligns with the "Add + Self-Remove" requirement from the plan
    if (requestingUser.id !== targetUserId) {
      return NextResponse.json(
        { success: false, error: "You can only remove yourself from conversations" },
        { status: 403 }
      );
    }

    // Check if target user is actually a participant
    const isTargetParticipant = await conversationRepository.isUserParticipant(
      conversationId,
      targetUserId
    );

    if (!isTargetParticipant) {
      return NextResponse.json(
        { success: false, error: "User is not a participant in this conversation" },
        { status: 404 }
      );
    }

    // Get conversation details for validation
    const conversation = await conversationRepository.getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Check if this is the last participant - prevent leaving empty conversations
    const participantCount = conversation.participants?.filter(p => !p.leftAt).length || 0;
    if (participantCount <= 1) {
      return NextResponse.json(
        { success: false, error: "Cannot leave conversation: You are the last participant" },
        { status: 409 }
      );
    }

    // Remove the participant (sets leftAt timestamp)
    await conversationRepository.removeParticipant(
      conversationId,
      targetUserId
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          conversationId,
          userId: targetUserId,
          leftAt: new Date().toISOString(),
        },
        message: "Successfully left the conversation",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing conversation participant:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}