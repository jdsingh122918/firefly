import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const conversationRepository = new ConversationRepository();
const userRepository = new UserRepository();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get conversation ID from params
    const { id } = await params;
    const conversationId = id;

    // Parse request body
    const body = await request.json();
    const { userId: targetUserId, canWrite = true, canManage = false } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

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
        { success: false, error: "Access denied: You must be a participant to add members" },
        { status: 403 }
      );
    }

    // Get the target user to add
    const targetUser = await userRepository.getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Target user not found" },
        { status: 404 }
      );
    }

    // Check if target user is already a participant
    const isAlreadyParticipant = await conversationRepository.isUserParticipant(
      conversationId,
      targetUserId
    );

    if (isAlreadyParticipant) {
      return NextResponse.json(
        { success: false, error: "User is already a participant in this conversation" },
        { status: 409 }
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

    // Add the participant
    const participant = await conversationRepository.addParticipant(
      conversationId,
      targetUserId,
      {
        canWrite: Boolean(canWrite),
        canManage: Boolean(canManage),
      }
    );

    if (!participant) {
      return NextResponse.json(
        { success: false, error: "Failed to add participant" },
        { status: 500 }
      );
    }

    // Return success response with participant details
    return NextResponse.json(
      {
        success: true,
        data: {
          participant: {
            id: participant.id,
            userId: participant.userId,
            canWrite: participant.canWrite,
            canManage: participant.canManage,
            joinedAt: participant.joinedAt,
            user: {
              id: targetUser.id,
              firstName: targetUser.firstName,
              lastName: targetUser.lastName,
              email: targetUser.email,
              role: targetUser.role,
            },
          },
        },
        message: "Participant added successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding conversation participant:", error);

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