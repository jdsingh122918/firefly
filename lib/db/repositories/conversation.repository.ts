import { prisma } from "@/lib/db/prisma";
import {
  Conversation,
  ConversationParticipant,
  CreateConversationInput,
  ConversationSearchOptions,
  PaginatedResult,
  MessageType,
} from "@/lib/types";

export class ConversationRepository {
  /**
   * Create a new conversation
   */
  async createConversation(
    data: CreateConversationInput,
  ): Promise<Conversation> {
    const conversation = await prisma.conversation.create({
      data: {
        title: data.title || null,
        type: data.type,
        familyId: data.familyId || null,
        createdBy: data.createdBy,
        participants: {
          create: data.participantIds.map((userId) => ({
            userId,
            canWrite: true,
            canManage: userId === data.createdBy, // Creator can manage
          })),
        },
      },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                familyRole: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return conversation as Conversation;
  }

  /**
   * Get conversation by ID with full details
   */
  async getConversationById(id: string): Promise<Conversation | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                familyRole: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20, // Latest 20 messages
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return conversation as Conversation | null;
  }

  /**
   * Get conversations for a specific user
   */
  async getConversationsForUser(
    userId: string,
    options: ConversationSearchOptions = {},
  ): Promise<PaginatedResult<Conversation>> {
    const { type, familyId, isActive = true, page = 1, limit = 20 } = options;

    console.log("💬 [REPOSITORY] getConversationsForUser called:", {
      userId,
      type,
      familyId,
      isActive,
      page,
      limit
    });

    // Build where clause
    const where: {
      isActive: boolean;
      participants: {
        some: {
          userId: string;
          leftAt: null;
        };
      };
      type?: MessageType;
      familyId?: string;
    } = {
      isActive,
      participants: {
        some: {
          userId: userId, // Ensure consistent ObjectId string comparison
          leftAt: null, // User hasn't left the conversation
        },
      },
    };

    if (type) where.type = type;
    if (familyId) where.familyId = familyId;

    // Previous nested query approach was failing due to Prisma/MongoDB aggregation issue
    // Keeping minimal logging for debugging

    // WORKAROUND: Use raw MongoDB query to bypass Prisma ObjectId conversion issues
    console.log("💬 [REPOSITORY] Using raw MongoDB query workaround");

    try {
      // ULTIMATE WORKAROUND: Get all conversations and manually filter in JavaScript
      console.log("💬 [REPOSITORY] Using JavaScript filtering workaround");

      // First, get all active conversations (without participants to avoid nested query issues)
      const allConversations = await prisma.conversation.findMany({
        where: {
          isActive: true,
          ...(type && { type }),
          ...(familyId && { familyId })
        },
        include: {
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: [
          { updatedAt: "desc" },
        ],
      });

      console.log("💬 [REPOSITORY] All conversations fetched:", {
        totalFetched: allConversations.length,
        lookingForUserId: userId
      });

      // Separately get ALL participants to avoid nested query issues
      // Fix: Get all participants and filter out those who have left in JavaScript
      const allParticipants = await prisma.conversationParticipant.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              familyRole: true,
            },
          },
        },
      });

      // Filter out participants who have left (leftAt is not null/undefined)
      const activeParticipants = allParticipants.filter(p => !p.leftAt);

      console.log("💬 [REPOSITORY] All participants fetched:", {
        totalParticipants: allParticipants.length,
        activeParticipants: activeParticipants.length,
        searchUserId: userId,
        userParticipants: activeParticipants.filter(p => p.userId === userId).length
      });

      // Manually attach participants to conversations
      const conversationsWithParticipants = allConversations.map(conversation => ({
        ...conversation,
        participants: activeParticipants.filter(p => p.conversationId === conversation.id),
      }));

      // Filter conversations where user is a participant (JavaScript filtering)
      const userConversations = conversationsWithParticipants.filter(conversation => {
        const hasUser = conversation.participants?.some(participant => {
          const match = participant.userId === userId;
          if (match) {
            console.log("💬 [REPOSITORY] Found user match in conversation:", {
              conversationId: conversation.id,
              participantUserId: participant.userId,
              searchUserId: userId,
              match: match
            });
          }
          return match;
        });
        return hasUser;
      });

      console.log("💬 [REPOSITORY] Filtered user conversations:", {
        userConversationsCount: userConversations.length,
        conversationIds: userConversations.map(c => c.id)
      });

      // Apply pagination
      const total = userConversations.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedConversations = userConversations.slice(startIndex, endIndex);

      return {
        items: paginatedConversations as Conversation[],
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("💬 [REPOSITORY] JavaScript filtering failed:", error);

      return {
        items: [],
        total: 0,
        page,
        limit,
        hasNextPage: false,
        hasPrevPage: page > 1,
      };
    }
  }

  /**
   * Add participant to conversation
   */
  async addParticipant(
    conversationId: string,
    userId: string,
    permissions: { canWrite?: boolean; canManage?: boolean } = {},
  ): Promise<ConversationParticipant> {
    const participant = await prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId,
        canWrite: permissions.canWrite ?? true,
        canManage: permissions.canManage ?? false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    return participant as ConversationParticipant;
  }

  /**
   * Remove participant from conversation
   */
  async removeParticipant(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId,
      },
      data: {
        leftAt: new Date(),
      },
    });
  }

  /**
   * Update conversation details
   */
  async updateConversation(
    id: string,
    data: { title?: string; isActive?: boolean },
  ): Promise<Conversation> {
    const conversation = await prisma.conversation.update({
      where: { id },
      data,
      include: {
        family: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return conversation as Conversation;
  }

  /**
   * Check if user is participant in conversation
   */
  async isUserParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    // Check if participant exists and hasn't left (leftAt is null/undefined)
    return !!participant && !participant.leftAt;
  }

  /**
   * Get user's permissions in conversation
   */
  async getUserPermissions(
    conversationId: string,
    userId: string,
  ): Promise<{ canWrite: boolean; canManage: boolean } | null> {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
      select: {
        canWrite: true,
        canManage: true,
        leftAt: true,
      },
    });

    // Return permissions only if participant exists and hasn't left
    return participant && !participant.leftAt ? {
      canWrite: participant.canWrite,
      canManage: participant.canManage,
    } : null;
  }

  /**
   * Create direct conversation between two users
   */
  async createDirectConversation(
    user1Id: string,
    user2Id: string,
  ): Promise<Conversation> {
    // Check if direct conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        type: MessageType.DIRECT,
        participants: {
          every: {
            userId: { in: [user1Id, user2Id] },
          },
        },
      },
      include: {
        participants: true,
      },
    });

    // If exists and has exactly 2 active participants (who haven't left), return it
    if (
      existingConversation &&
      existingConversation.participants?.length === 2 &&
      existingConversation.participants.every(p => !p.leftAt)
    ) {
      return this.getConversationById(
        existingConversation.id,
      ) as Promise<Conversation>;
    }

    // Create new direct conversation
    return this.createConversation({
      type: MessageType.DIRECT,
      createdBy: user1Id,
      participantIds: [user1Id, user2Id],
    });
  }

  /**
   * Create family chat conversation
   */
  async createFamilyChat(
    familyId: string,
    createdBy: string,
    title?: string,
  ): Promise<Conversation> {
    // Get all family members
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          select: { id: true },
        },
      },
    });

    if (!family) {
      throw new Error("Family not found");
    }

    const participantIds = family.members.map((member) => member.id);

    return this.createConversation({
      title: title || `${family.name} Family Chat`,
      type: MessageType.FAMILY_CHAT,
      familyId,
      createdBy,
      participantIds,
    });
  }

  /**
   * Delete conversation (soft delete)
   */
  async deleteConversation(id: string): Promise<void> {
    await prisma.conversation.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
