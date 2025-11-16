import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { MessageType } from "@/lib/types";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const conversationRepository = new ConversationRepository();
const userRepository = new UserRepository();

// Validation schema for creating a conversation
const createConversationSchema = z.object({
  title: z.string().optional(),
  type: z.nativeEnum(MessageType),
  familyId: z.string().optional(),
  participantIds: z
    .array(z.string())
    .min(1, "At least one participant is required")
    .max(50, "Maximum 50 participants allowed"),
});

// GET /api/conversations - List conversations for current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database with graceful handling for unsynced users
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      // User not yet synced to database - return empty conversations instead of 404
      console.log("💬 User not synced yet, returning empty conversations:", userId);
      return NextResponse.json({
        success: true,
        data: {
          conversations: [],
          total: 0,
          page: 1,
          limit: 20,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    console.log("💬 GET /api/conversations - User:", {
      clerkId: userId,
      databaseId: user.id,
      role: user.role,
      email: user.email,
    });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as MessageType | null;
    const familyId = searchParams.get("familyId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get conversations for user
    console.log("💬 [API] About to call repository.getConversationsForUser with:", {
      userId: user.id,
      options: {
        type: type || undefined,
        familyId: familyId || undefined,
        page,
        limit,
      }
    });

    const result = await conversationRepository.getConversationsForUser(
      user.id,
      {
        type: type || undefined,
        familyId: familyId || undefined,
        page,
        limit,
      },
    );

    console.log("💬 [API] Repository call completed, result:", {
      resultType: typeof result,
      hasItems: !!result?.items,
      itemsLength: result?.items?.length,
      total: result?.total
    });

    // Workaround implemented to fix Prisma nested query issue

    console.log("💬 Conversations fetched:", {
      userId: user.id,
      totalFound: result.total,
      itemsReturned: result.items.length,
      page,
      limit,
      conversationIds: result.items.map(c => c.id)
    });

    return NextResponse.json({
      success: true,
      data: {
        conversations: result.items, // ← Fix: Extract items as conversations
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      }
    });
  } catch (error) {
    console.error("❌ GET /api/conversations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    console.log("💬 Raw Request Body Debug:", {
      userId: user.id,
      userEmail: user.email,
      requestBody: body
    });

    const validatedData = createConversationSchema.parse(body);

    console.log("💬 POST /api/conversations - User & Validation:", {
      role: user.role,
      email: user.email,
      validatedData,
      participantCount: validatedData.participantIds.length
    });

    // Role-based validation
    switch (validatedData.type) {
      case MessageType.ANNOUNCEMENT:
        // Only ADMIN can create announcements
        if (user.role !== UserRole.ADMIN) {
          return NextResponse.json(
            { error: "Only administrators can create announcements" },
            { status: 403 },
          );
        }
        break;


      case MessageType.FAMILY_CHAT:
        // ADMIN and VOLUNTEER can create family chats for any family
        // MEMBER can only create family chats for their own family
        if (user.role === UserRole.MEMBER) {
          // Members can only create family chats for their own family
          if (!user.familyId) {
            return NextResponse.json(
              { error: "You must be assigned to a family to create family chats" },
              { status: 400 },
            );
          }
          if (!validatedData.familyId) {
            return NextResponse.json(
              { error: "Family ID is required for family chats" },
              { status: 400 },
            );
          }
          if (user.familyId !== validatedData.familyId) {
            return NextResponse.json(
              { error: "You can only create family chats for your own family" },
              { status: 403 },
            );
          }
        } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
          return NextResponse.json(
            {
              error: "Insufficient permissions to create family chats",
            },
            { status: 403 },
          );
        } else {
          // ADMIN and VOLUNTEER: Validate familyId is provided
          if (!validatedData.familyId) {
            return NextResponse.json(
              { error: "Family ID is required for family chats" },
              { status: 400 },
            );
          }
        }
        break;

      case MessageType.DIRECT:
        // Anyone can create direct messages
        console.log("💬 Direct Message Validation Debug:", {
          participantIds: validatedData.participantIds,
          participantCount: validatedData.participantIds.length,
          currentUserId: user.id,
          includesCurrentUser: validatedData.participantIds.includes(user.id)
        });

        // Validate exactly 2 participants for direct messages
        if (validatedData.participantIds.length !== 2) {
          console.error("💬 Direct Message Validation Error - Participant count:", {
            expected: 2,
            actual: validatedData.participantIds.length,
            participants: validatedData.participantIds
          });
          return NextResponse.json(
            { error: "Direct conversations must have exactly 2 participants" },
            { status: 400 },
          );
        }

        // Ensure current user is one of the participants
        if (!validatedData.participantIds.includes(user.id)) {
          console.log("💬 Direct Message Fix - Adding current user:", {
            before: validatedData.participantIds,
            userId: user.id
          });
          validatedData.participantIds[0] = user.id; // Replace first participant with current user
          console.log("💬 Direct Message Fix - After adding current user:", {
            after: validatedData.participantIds
          });
        } else {
          console.log("💬 Direct Message Validation - Current user already included");
        }

        console.log("💬 Direct Message Validation - Final participants:", {
          participantIds: validatedData.participantIds,
          count: validatedData.participantIds.length
        });
        break;
    }

    // Create conversation
    console.log("💬 Creating conversation with data:", {
      title: validatedData.title,
      type: validatedData.type,
      familyId: validatedData.familyId,
      createdBy: user.id,
      participantIds: validatedData.participantIds,
      participantCount: validatedData.participantIds.length
    });

    const conversation = await conversationRepository.createConversation({
      title: validatedData.title,
      type: validatedData.type,
      familyId: validatedData.familyId,
      createdBy: user.id,
      participantIds: validatedData.participantIds,
    });

    console.log("💬 Conversation created successfully:", {
      conversationId: conversation.id,
      type: conversation.type,
      participantsCreated: conversation.participants?.length || 0,
      title: conversation.title
    });

    return NextResponse.json(
      {
        success: true,
        data: conversation,
        message: "Conversation created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ POST /api/conversations error:", error);

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
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}
