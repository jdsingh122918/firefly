import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  Message,
  MessageUserStatus,
  CreateMessageInput,
  UpdateMessageInput,
  MessageSearchOptions,
  MessageStatus,
  PaginatedResult,
} from "@/lib/types";
import { MessageReaction, MessageMetadata } from "@/lib/types/api";

export class MessageRepository {
  /**
   * Create a new message
   */
  async createMessage(data: CreateMessageInput): Promise<Message> {
    const message = await prisma.message.create({
      data: {
        content: data.content,
        conversationId: data.conversationId,
        senderId: data.senderId,
        replyToId: data.replyToId || null,
        attachments: data.attachments || [],
        metadata: (data.metadata || null) as Prisma.InputJsonValue,
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            createdAt: true,
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

    // Update conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    // Create message status for all conversation participants
    await this.createMessageStatusForParticipants(
      data.conversationId,
      message.id,
    );

    return message as Message;
  }

  /**
   * Get message by ID
   */
  async getMessageById(id: string): Promise<Message | null> {
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
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
        replies: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        userStatuses: {
          include: {
            user: {
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

    return message as Message | null;
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessagesForConversation(
    conversationId: string,
    options: MessageSearchOptions = {},
  ): Promise<PaginatedResult<Message>> {
    const {
      query,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    // Build where clause
    const where: Record<string, unknown> = {
      conversationId,
      isDeleted: false,
    };

    if (query) {
      where.content = {
        contains: query,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    // Get total count
    const total = await prisma.message.count({ where });

    // Get messages
    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
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
        userStatuses: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: messages as Message[],
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Update message content
   */
  async updateMessage(id: string, data: UpdateMessageInput): Promise<Message> {
    const message = await prisma.message.update({
      where: { id },
      data: {
        content: data.content,
        attachments: data.attachments,
        metadata: data.metadata as Prisma.InputJsonValue,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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

    return message as Message;
  }

  /**
   * Delete message (soft delete)
   */
  async deleteMessage(id: string): Promise<void> {
    await prisma.message.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: "[This message was deleted]",
      },
    });
  }

  /**
   * Mark message as read for a user
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    await prisma.messageUserStatus.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      update: {
        status: MessageStatus.READ,
        readAt: new Date(),
      },
      create: {
        messageId,
        userId,
        status: MessageStatus.READ,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all messages in conversation as read for user
   */
  async markAllMessagesAsRead(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    // Get all unread messages for this user in the conversation
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        userStatuses: {
          some: {
            userId,
            status: { not: MessageStatus.READ },
          },
        },
      },
      select: { id: true },
    });

    // Mark all as read
    const updatePromises = unreadMessages.map((message) =>
      this.markMessageAsRead(message.id, userId),
    );

    await Promise.all(updatePromises);
  }

  /**
   * Get unread message count for user in conversation
   */
  async getUnreadMessageCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    return prisma.message.count({
      where: {
        conversationId,
        isDeleted: false,
        senderId: { not: userId }, // Don't count own messages
        userStatuses: {
          some: {
            userId,
            status: { not: MessageStatus.READ },
          },
        },
      },
    });
  }

  /**
   * Get user's message status for a message
   */
  async getMessageStatus(
    messageId: string,
    userId: string,
  ): Promise<MessageUserStatus | null> {
    const status = await prisma.messageUserStatus.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      include: {
        message: {
          select: {
            id: true,
            content: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return status as MessageUserStatus | null;
  }

  /**
   * Search messages across all conversations for a user
   */
  async searchMessages(
    userId: string,
    options: MessageSearchOptions = {},
  ): Promise<PaginatedResult<Message>> {
    const {
      query,
      conversationId,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    // Build where clause - Note: Removed leftAt constraint as it's handled by participant validation
    const where: {
      isDeleted: boolean;
      conversation: {
        participants: {
          some: {
            userId: string;
          };
        };
      };
      conversationId?: string;
      content?: {
        contains: string;
        mode: Prisma.QueryMode;
      };
    } = {
      isDeleted: false,
      conversation: {
        participants: {
          some: {
            userId,
          },
        },
      },
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    if (query) {
      where.content = {
        contains: query,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    if (conversationId) {
      where.conversationId = conversationId;
    }

    // Get total count
    const total = await prisma.message.count({ where });

    // Get messages
    const messages = await prisma.message.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            type: true,
            family: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: messages as Message[],
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Create message status for all conversation participants
   */
  private async createMessageStatusForParticipants(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    // Get all active participants in the conversation
    const allParticipants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
      },
      select: { userId: true, leftAt: true },
    });

    // Filter active participants (those who haven't left)
    const participants = allParticipants.filter(p => !p.leftAt);

    // Create status records for all participants
    const statusData = participants.map((participant) => ({
      messageId,
      userId: participant.userId,
      status: MessageStatus.SENT,
    }));

    if (statusData.length > 0) {
      await prisma.messageUserStatus.createMany({
        data: statusData,
      });
    }
  }

  /**
   * Get recent messages for user across all conversations
   */
  async getRecentMessages(
    userId: string,
    limit: number = 10,
  ): Promise<Message[]> {
    const messages = await prisma.message.findMany({
      where: {
        isDeleted: false,
        conversation: {
          participants: {
            some: {
              userId,
            },
          },
        },
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return messages as Message[];
  }

  /**
   * Get message statistics for conversation
   */
  async getConversationStats(conversationId: string): Promise<{
    totalMessages: number;
    activeParticipants: number;
    lastMessageAt: Date | null;
  }> {
    // Get active participants using JavaScript filtering to handle undefined leftAt
    const allParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { leftAt: true },
    });
    const activeParticipantCount = allParticipants.filter(p => !p.leftAt).length;

    const [messageCount, lastMessage] = await Promise.all([
      prisma.message.count({
        where: {
          conversationId,
          isDeleted: false,
        },
      }),
      prisma.message.findFirst({
        where: {
          conversationId,
          isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      totalMessages: messageCount,
      activeParticipants: activeParticipantCount,
      lastMessageAt: lastMessage?.createdAt || null,
    };
  }

  /**
   * Add a reaction to a message
   */
  async addReactionToMessage(
    messageId: string,
    emoji: string,
    userId: string,
    userName: string
  ): Promise<Message> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { metadata: true },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const currentMetadata = (message.metadata as MessageMetadata) || {};
    const currentReactions = currentMetadata.reactions || {};
    const emojiReactions = currentReactions[emoji] || [];

    // Check if user already reacted with this emoji
    const existingReaction = emojiReactions.find(r => r.userId === userId);
    if (existingReaction) {
      // User already reacted with this emoji, no change needed
      const result = await this.getMessageById(messageId);
      if (!result) throw new Error("Message not found after reaction");
      return result;
    }

    // Add new reaction
    const newReaction: MessageReaction = {
      userId,
      userName,
      createdAt: new Date(),
    };

    const updatedReactions = {
      ...currentReactions,
      [emoji]: [...emojiReactions, newReaction],
    };

    const updatedMetadata = {
      ...currentMetadata,
      reactions: updatedReactions,
    };

    // Update message with new reactions
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            createdAt: true,
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

    return updatedMessage as Message;
  }

  /**
   * Remove a reaction from a message
   */
  async removeReactionFromMessage(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<Message> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { metadata: true },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const currentMetadata = (message.metadata as MessageMetadata) || {};
    const currentReactions = currentMetadata.reactions || {};
    const emojiReactions = currentReactions[emoji] || [];

    // Remove user's reaction
    const filteredReactions = emojiReactions.filter(r => r.userId !== userId);

    let updatedReactions: Record<string, MessageReaction[]>;
    if (filteredReactions.length === 0) {
      // Remove the emoji entirely if no reactions left
      const { [emoji]: _, ...restReactions } = currentReactions;
      updatedReactions = restReactions;
    } else {
      updatedReactions = {
        ...currentReactions,
        [emoji]: filteredReactions,
      };
    }

    const updatedMetadata = {
      ...currentMetadata,
      reactions: updatedReactions,
    };

    // Update message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            createdAt: true,
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

    return updatedMessage as Message;
  }

  /**
   * Get reaction counts for a message
   */
  async getMessageReactions(messageId: string): Promise<Record<string, MessageReaction[]>> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { metadata: true },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const metadata = (message.metadata as MessageMetadata) || {};
    return metadata.reactions || {};
  }

  /**
   * Get reaction counts by emoji for a message
   */
  async getReactionCounts(messageId: string): Promise<Record<string, number>> {
    const reactions = await this.getMessageReactions(messageId);
    const counts: Record<string, number> = {};

    for (const [emoji, reactionList] of Object.entries(reactions)) {
      counts[emoji] = reactionList.length;
    }

    return counts;
  }

  /**
   * Check if user has reacted to a message with specific emoji
   */
  async hasUserReacted(messageId: string, emoji: string, userId: string): Promise<boolean> {
    const reactions = await this.getMessageReactions(messageId);
    const emojiReactions = reactions[emoji] || [];
    return emojiReactions.some(r => r.userId === userId);
  }

  /**
   * Get all users who reacted to a message with specific emoji
   */
  async getReactionUsers(messageId: string, emoji: string): Promise<MessageReaction[]> {
    const reactions = await this.getMessageReactions(messageId);
    return reactions[emoji] || [];
  }
}
