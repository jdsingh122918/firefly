import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  Reply,
  CreateReplyInput,
  UpdateReplyInput,
  CreateVoteInput,
  ReplyFilters,
  PaginatedResult,
  VoteType,
} from "@/lib/types";

/**
 * Reply Repository - Manages threaded reply system with Reddit-like functionality
 * Supports nested replies up to 3 levels deep with voting and attachments
 */
export class ReplyRepository {
  private readonly MAX_REPLY_DEPTH = 3;

  /**
   * Create a new reply
   */
  async createReply(data: CreateReplyInput): Promise<Reply> {
    try {
      // Validate required fields
      if (!data.content || !data.postId || !data.authorId) {
        throw new Error("Missing required fields: content, postId, and authorId are required");
      }

      // Verify post exists and is not locked
      const post = await prisma.post.findUnique({
        where: { id: data.postId },
        select: {
          id: true,
          isDeleted: true,
          isLocked: true,
          forumId: true,
          authorId: true,
        },
      });

      if (!post || post.isDeleted) {
        throw new Error("Post not found or has been deleted");
      }

      if (post.isLocked) {
        throw new Error("Cannot reply to a locked post");
      }

      // Verify author exists and is forum member
      const author = await prisma.user.findUnique({
        where: { id: data.authorId },
        select: { id: true },
      });

      if (!author) {
        throw new Error("Author not found");
      }

      // Check if author is forum member
      const membership = await prisma.forumMember.findUnique({
        where: {
          forumId_userId: {
            forumId: post.forumId,
            userId: data.authorId,
          },
        },
      });

      if (!membership) {
        throw new Error("Author is not a member of this forum");
      }

      let depth = 0;
      let parentReply = null;

      // Validate parent reply and calculate depth
      if (data.parentId) {
        parentReply = await prisma.reply.findUnique({
          where: { id: data.parentId },
          select: {
            id: true,
            postId: true,
            depth: true,
            isDeleted: true
          },
        });

        if (!parentReply || parentReply.isDeleted) {
          throw new Error("Parent reply not found or has been deleted");
        }

        if (parentReply.postId !== data.postId) {
          throw new Error("Parent reply is not from the same post");
        }

        depth = parentReply.depth + 1;

        if (depth > this.MAX_REPLY_DEPTH) {
          throw new Error(`Maximum reply depth of ${this.MAX_REPLY_DEPTH} exceeded`);
        }
      }

      const reply = await prisma.reply.create({
        data: {
          content: data.content,
          postId: data.postId,
          authorId: data.authorId,
          parentId: data.parentId,
          depth,
          attachments: data.attachments || [],
          metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              forumId: true,
            },
          },
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          parent: {
            select: {
              id: true,
              authorId: true,
              depth: true,
            },
          },
        },
      });

      // Update post reply count and last reply info
      await Promise.all([
        this.updatePostReplyCount(data.postId),
        this.updatePostLastReply(data.postId, data.authorId),
        this.updateForumActivity(post.forumId),
        this.updateMemberReplyCount(post.forumId, data.authorId),
      ]);

      console.log("💬 Reply created:", {
        id: reply.id,
        postId: reply.postId,
        authorId: reply.authorId,
        depth: reply.depth,
        parentId: reply.parentId,
      });

      return reply as Reply;
    } catch (error) {
      console.error("❌ Failed to create reply:", error);
      throw error;
    }
  }

  /**
   * Get reply by ID
   */
  async getReplyById(
    id: string,
    options: {
      includeDeleted?: boolean;
      includeChildren?: boolean;
      includeVotes?: boolean;
      includeDocuments?: boolean;
      userId?: string; // For vote status
    } = {}
  ): Promise<Reply | null> {
    try {
      const whereClause: { id: string; isDeleted?: boolean } = { id };

      if (!options.includeDeleted) {
        whereClause.isDeleted = false;
      }

      const include: Prisma.ReplyInclude = {
        post: {
          select: {
            id: true,
            title: true,
            forumId: true,
          },
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            content: true,
            authorId: true,
            depth: true,
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      };

      if (options.includeChildren) {
        include.children = {
          where: { isDeleted: false },
          orderBy: [
            { score: "desc" },
            { createdAt: "asc" },
          ],
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            votes: options.userId ? {
              where: { userId: options.userId },
              select: { voteType: true },
            } : false,
          },
        };
      }

      if (options.includeVotes && options.userId) {
        include.votes = {
          where: { userId: options.userId },
          select: { voteType: true },
        };
      }

      if (options.includeDocuments) {
        include.documents = {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                fileName: true,
                originalFileName: true,
                fileSize: true,
                mimeType: true,
                type: true,
                status: true,
                uploadedBy: true,
                familyId: true,
                tags: true,
                filePath: true,
                duration: true,
                width: true,
                height: true,
                thumbnailPath: true,
                previewPath: true,
                metadata: true,
                isPublic: true,
                expiresAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { order: "asc" },
        };
      }

      const reply = await prisma.reply.findUnique({
        where: whereClause,
        include,
      });

      // Transform documents from junction table to Document array if included
      if (options.includeDocuments && reply?.documents) {
        const transformedReply = {
          ...reply,
          documents: reply.documents.map((rd: any) => rd.document)
        };
        return transformedReply as unknown as Reply;
      }

      return reply as Reply | null;
    } catch (error) {
      console.error("❌ Failed to get reply by ID:", error);
      throw error;
    }
  }

  /**
   * Get replies with filtering and pagination (threaded view)
   */
  async getReplies(
    filters: ReplyFilters = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: "createdAt" | "score" | "depth";
      sortOrder?: "asc" | "desc";
      includeChildren?: boolean;
      userId?: string; // For vote status
      threaded?: boolean; // Whether to return as threaded structure
    } = {}
  ): Promise<PaginatedResult<Reply>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = "createdAt",
        sortOrder = "asc",
        includeChildren = false,
        userId,
        threaded = true,
      } = options;

      // Build where clause
      const where: Prisma.ReplyWhereInput = {};

      if (filters.postId) where.postId = filters.postId;
      if (filters.authorId) where.authorId = filters.authorId;
      if (filters.parentId !== undefined) where.parentId = filters.parentId;
      if (filters.depth !== undefined) where.depth = filters.depth;
      if (filters.isDeleted !== undefined) where.isDeleted = filters.isDeleted;

      // Default to non-deleted replies
      if (filters.isDeleted === undefined) {
        where.isDeleted = false;
      }

      if (filters.createdAfter || filters.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
        if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
      }

      // For threaded view, only get top-level replies initially
      if (threaded && filters.parentId === undefined) {
        where.parentId = null;
      }

      // Include for relations
      const include: Prisma.ReplyInclude = {
        post: {
          select: {
            id: true,
            title: true,
            forumId: true,
          },
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            authorId: true,
          },
        },
      };

      if (includeChildren) {
        // Recursive children loading for threaded view
        include.children = {
          where: { isDeleted: false },
          orderBy: [
            { score: "desc" },
            { createdAt: "asc" },
          ],
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            children: {
              where: { isDeleted: false },
              orderBy: [
                { score: "desc" },
                { createdAt: "asc" },
              ],
              include: {
                author: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
                votes: userId ? {
                  where: { userId },
                  select: { voteType: true },
                } : false,
              },
            },
            votes: userId ? {
              where: { userId },
              select: { voteType: true },
            } : false,
          },
        };
      }

      if (userId) {
        include.votes = {
          where: { userId },
          select: { voteType: true },
        };
      }

      // Get total count
      const total = await prisma.reply.count({ where });

      // Build order by
      const orderBy: Prisma.ReplyOrderByWithRelationInput[] = [];

      if (threaded) {
        // For threaded view, order by depth first, then by score/date
        orderBy.push({ depth: "asc" });
      }

      if (sortBy === "createdAt") {
        orderBy.push({ createdAt: sortOrder });
      } else if (sortBy === "score") {
        orderBy.push({ score: sortOrder });
      } else if (sortBy === "depth") {
        orderBy.push({ depth: sortOrder });
      }

      // Add secondary sort for consistency
      if (sortBy !== "createdAt") {
        orderBy.push({ createdAt: "asc" });
      }

      // Get replies
      const replies = await prisma.reply.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: replies as unknown as Reply[],
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Failed to get replies:", error);
      throw error;
    }
  }

  /**
   * Get reply tree for a specific post (optimized for threading display)
   */
  async getReplyTree(postId: string, userId?: string): Promise<Reply[]> {
    try {
      const replies = await prisma.reply.findMany({
        where: {
          postId,
          isDeleted: false,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          votes: userId ? {
            where: { userId },
            select: { voteType: true },
          } : false,
        },
        orderBy: [
          { depth: "asc" },
          { score: "desc" },
          { createdAt: "asc" },
        ],
      });

      // Build threaded structure
      const replyMap = new Map<string, Reply>();
      const rootReplies: Reply[] = [];

      // First pass: Create map of all replies
      replies.forEach(reply => {
        const replyWithChildren = { ...reply, children: [] } as unknown as Reply;
        replyMap.set(reply.id, replyWithChildren);
      });

      // Second pass: Build parent-child relationships
      replies.forEach(reply => {
        const replyWithChildren = replyMap.get(reply.id)!;

        if (reply.parentId) {
          const parent = replyMap.get(reply.parentId);
          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(replyWithChildren);
          }
        } else {
          rootReplies.push(replyWithChildren);
        }
      });

      return rootReplies;
    } catch (error) {
      console.error("❌ Failed to get reply tree:", error);
      throw error;
    }
  }

  /**
   * Update reply
   */
  async updateReply(id: string, data: UpdateReplyInput): Promise<Reply> {
    try {
      // Check if reply exists
      const existingReply = await this.getReplyById(id);
      if (!existingReply) {
        throw new Error("Reply not found");
      }

      const updatedReply = await prisma.reply.update({
        where: { id },
        data: {
          ...(data.content && { content: data.content }),
          ...(data.attachments && { attachments: data.attachments }),
          ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonValue }),
          updatedAt: new Date(),
          editedAt: new Date(),
        },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              forumId: true,
            },
          },
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          parent: {
            select: {
              id: true,
              authorId: true,
            },
          },
        },
      });

      console.log("💬 Reply updated:", {
        id: updatedReply.id,
        postId: updatedReply.postId,
        changes: Object.keys(data),
      });

      return updatedReply as Reply;
    } catch (error) {
      console.error("❌ Failed to update reply:", error);
      throw error;
    }
  }

  /**
   * Soft delete reply
   */
  async deleteReply(id: string, deletedBy: string, deleteReason?: string): Promise<void> {
    try {
      const reply = await this.getReplyById(id);
      if (!reply) {
        throw new Error("Reply not found");
      }

      await prisma.reply.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
          deleteReason,
          updatedAt: new Date(),
        },
      });

      // Update post reply count
      await this.updatePostReplyCount(reply.postId);

      console.log("💬 Reply soft deleted:", { id, deletedBy, deleteReason });
    } catch (error) {
      console.error("❌ Failed to delete reply:", error);
      throw error;
    }
  }

  /**
   * Vote on reply (upvote/downvote)
   */
  async voteOnReply(data: CreateVoteInput): Promise<{ success: boolean; score: number }> {
    try {
      if (!data.replyId) {
        throw new Error("ReplyId is required for reply voting");
      }

      // Check if user already voted on this reply
      const existingVote = await prisma.vote.findUnique({
        where: {
          userId_replyId: {
            userId: data.userId,
            replyId: data.replyId,
          },
        },
      });

      let voteChange = 0;

      if (existingVote) {
        if (existingVote.voteType === data.voteType) {
          // Remove vote if clicking same vote type
          await prisma.vote.delete({
            where: {
              userId_replyId: {
                userId: data.userId,
                replyId: data.replyId,
              },
            },
          });

          voteChange = data.voteType === VoteType.UPVOTE ? -1 : 1;
        } else {
          // Change vote type
          await prisma.vote.update({
            where: {
              userId_replyId: {
                userId: data.userId,
                replyId: data.replyId,
              },
            },
            data: {
              voteType: data.voteType,
              updatedAt: new Date(),
            },
          });

          voteChange = data.voteType === VoteType.UPVOTE ? 2 : -2;
        }
      } else {
        // Create new vote
        await prisma.vote.create({
          data: {
            userId: data.userId,
            replyId: data.replyId,
            voteType: data.voteType,
          },
        });

        voteChange = data.voteType === VoteType.UPVOTE ? 1 : -1;
      }

      // Update reply vote counts
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (data.voteType === VoteType.UPVOTE) {
        if (existingVote?.voteType === VoteType.UPVOTE) {
          // Removing upvote
          updateData.upvoteCount = { decrement: 1 };
        } else if (existingVote?.voteType === VoteType.DOWNVOTE) {
          // Changing from downvote to upvote
          updateData.upvoteCount = { increment: 1 };
          updateData.downvoteCount = { decrement: 1 };
        } else {
          // New upvote
          updateData.upvoteCount = { increment: 1 };
        }
      } else {
        if (existingVote?.voteType === VoteType.DOWNVOTE) {
          // Removing downvote
          updateData.downvoteCount = { decrement: 1 };
        } else if (existingVote?.voteType === VoteType.UPVOTE) {
          // Changing from upvote to downvote
          updateData.downvoteCount = { increment: 1 };
          updateData.upvoteCount = { decrement: 1 };
        } else {
          // New downvote
          updateData.downvoteCount = { increment: 1 };
        }
      }

      // Calculate new score
      updateData.score = { increment: voteChange };

      const updatedReply = await prisma.reply.update({
        where: { id: data.replyId },
        data: updateData,
        select: { score: true },
      });

      console.log("🗳️ Reply vote:", {
        userId: data.userId,
        replyId: data.replyId,
        voteType: data.voteType,
        voteChange,
        newScore: updatedReply.score,
      });

      return {
        success: true,
        score: updatedReply.score,
      };
    } catch (error) {
      console.error("❌ Failed to vote on reply:", error);
      throw error;
    }
  }

  /**
   * Get reply thread (reply and all its descendants)
   */
  async getReplyThread(replyId: string, userId?: string): Promise<Reply | null> {
    try {
      const reply = await this.getReplyById(replyId, {
        includeChildren: true,
        includeVotes: true,
        userId,
      });

      return reply;
    } catch (error) {
      console.error("❌ Failed to get reply thread:", error);
      throw error;
    }
  }

  /**
   * Update post reply count (denormalized for performance)
   */
  private async updatePostReplyCount(postId: string): Promise<void> {
    try {
      const count = await prisma.reply.count({
        where: {
          postId,
          isDeleted: false,
        },
      });

      await prisma.post.update({
        where: { id: postId },
        data: { replyCount: count },
      });
    } catch (error) {
      console.error("❌ Failed to update post reply count:", error);
    }
  }

  /**
   * Update post last reply information
   */
  private async updatePostLastReply(postId: string, userId: string): Promise<void> {
    try {
      await prisma.post.update({
        where: { id: postId },
        data: {
          lastReplyAt: new Date(),
          lastReplyBy: userId,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("❌ Failed to update post last reply:", error);
    }
  }

  /**
   * Update forum activity
   */
  private async updateForumActivity(forumId: string): Promise<void> {
    try {
      await prisma.forum.update({
        where: { id: forumId },
        data: {
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      console.error("❌ Failed to update forum activity:", error);
    }
  }

  /**
   * Update member reply count
   */
  private async updateMemberReplyCount(forumId: string, userId: string): Promise<void> {
    try {
      // Get all replies by this user in this forum
      const count = await prisma.reply.count({
        where: {
          authorId: userId,
          isDeleted: false,
          post: {
            forumId,
            isDeleted: false,
          },
        },
      });

      await prisma.forumMember.update({
        where: {
          forumId_userId: {
            forumId,
            userId,
          },
        },
        data: { replyCount: count },
      });
    } catch (error) {
      console.error("❌ Failed to update member reply count:", error);
    }
  }
}