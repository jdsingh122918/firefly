import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  Post,
  CreatePostInput,
  UpdatePostInput,
  CreateVoteInput,
  PostFilters,
  PostStatistics,
  PaginatedResult,
  PostType,
  VoteType,
} from "@/lib/types";

/**
 * Post Repository - Manages post CRUD operations, voting, and attachments
 * Includes Reddit-like voting system and multimedia attachment support
 */
export class PostRepository {
  /**
   * Create a new post
   */
  async createPost(data: CreatePostInput): Promise<Post> {
    try {
      // Validate required fields
      if (!data.title || !data.content || !data.forumId || !data.authorId) {
        throw new Error("Missing required fields: title, content, forumId, and authorId are required");
      }

      // Verify forum exists and is active
      const forum = await prisma.forum.findUnique({
        where: { id: data.forumId },
        select: { id: true, isActive: true, isArchived: true },
      });

      if (!forum || !forum.isActive || forum.isArchived) {
        throw new Error("Forum not found or not accessible");
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
            forumId: data.forumId,
            userId: data.authorId,
          },
        },
      });

      if (!membership) {
        throw new Error("Author is not a member of this forum");
      }

      // Generate URL-friendly slug
      const slug = await this.generateUniqueSlug(data.title, data.forumId);

      // Verify category exists if provided
      if (data.categoryId) {
        const category = await prisma.forumCategory.findUnique({
          where: { id: data.categoryId },
          select: { id: true, forumId: true, isActive: true },
        });

        if (!category || category.forumId !== data.forumId || !category.isActive) {
          throw new Error("Category not found or not in this forum");
        }
      }

      const post = await prisma.post.create({
        data: {
          title: data.title,
          content: data.content,
          slug,
          forumId: data.forumId,
          categoryId: data.categoryId,
          authorId: data.authorId,
          type: data.type || PostType.DISCUSSION,
          attachments: data.attachments || [],
          tags: data.tags || [],
          metadata: (data.metadata || {}) as Prisma.InputJsonValue,
          lastReplyAt: new Date(), // Set to creation time initially
        },
        include: {
          forum: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
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
        },
      });

      // Create document attachments if provided
      if (data.documentIds && data.documentIds.length > 0) {
        try {
          const documentAttachments = data.documentIds.map((documentId, index) => ({
            postId: post.id,
            documentId,
            order: index,
          }));

          await prisma.postDocument.createMany({
            data: documentAttachments,
          });

          console.log("📎 Document attachments created for post:", {
            postId: post.id,
            documentCount: data.documentIds.length,
            documentIds: data.documentIds,
          });
        } catch (error) {
          console.error("❌ Failed to create document attachments for post:", error);
          // Don't fail the entire post creation if documents fail to attach
          // The post was created successfully, just log the error
        }
      }

      // Update forum activity and post count
      await Promise.all([
        this.updateForumActivity(data.forumId, data.authorId),
        this.updateForumPostCount(data.forumId),
        this.updateCategoryPostCount(data.categoryId),
        this.updateMemberPostCount(data.forumId, data.authorId),
      ]);

      console.log("📝 Post created:", {
        id: post.id,
        title: post.title,
        slug: post.slug,
        forumId: post.forumId,
        authorId: post.authorId,
      });

      return post as Post;
    } catch (error) {
      console.error("❌ Failed to create post:", error);
      throw error;
    }
  }

  /**
   * Get post by ID
   */
  async getPostById(
    id: string,
    options: {
      includeDeleted?: boolean;
      includeReplies?: boolean;
      includeVotes?: boolean;
      includeDocuments?: boolean;
      userId?: string; // For vote status
    } = {}
  ): Promise<Post | null> {
    try {
      const whereClause: { id: string; isDeleted?: boolean } = { id };

      if (!options.includeDeleted) {
        whereClause.isDeleted = false;
      }

      const include: Prisma.PostInclude = {
        forum: {
          select: {
            id: true,
            title: true,
            slug: true,
            visibility: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
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
      };

      if (options.includeReplies) {
        include.replies = {
          where: { isDeleted: false },
          orderBy: [
            { depth: "asc" },
            { score: "desc" },
            { createdAt: "asc" },
          ],
          take: 50,
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

      const post = await prisma.post.findUnique({
        where: whereClause,
        include,
      });

      // Update view count
      if (post) {
        await this.incrementViewCount(id);
      }

      // Transform documents from junction table to Document array if included
      if (options.includeDocuments && post?.documents) {
        const transformedPost = {
          ...post,
          documents: post.documents.map((pd: any) => pd.document)
        };
        return transformedPost as unknown as Post;
      }

      return post as Post | null;
    } catch (error) {
      console.error("❌ Failed to get post by ID:", error);
      throw error;
    }
  }

  /**
   * Get post by slug within forum
   */
  async getPostBySlug(forumSlug: string, postSlug: string): Promise<Post | null> {
    try {
      const post = await prisma.post.findFirst({
        where: {
          slug: postSlug,
          forum: {
            slug: forumSlug,
          },
          isDeleted: false,
        },
        include: {
          forum: {
            select: {
              id: true,
              title: true,
              slug: true,
              visibility: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
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
        },
      });

      // Update view count
      if (post) {
        await this.incrementViewCount(post.id);
      }

      return post as Post | null;
    } catch (error) {
      console.error("❌ Failed to get post by slug:", error);
      throw error;
    }
  }

  /**
   * Get posts with filtering and pagination
   */
  async getPosts(
    filters: PostFilters = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: "createdAt" | "lastReplyAt" | "score" | "viewCount" | "replyCount";
      sortOrder?: "asc" | "desc";
      includeReplies?: boolean;
      userId?: string; // For vote status
    } = {}
  ): Promise<PaginatedResult<Post>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "lastReplyAt",
        sortOrder = "desc",
        includeReplies = false,
        userId,
      } = options;

      // Build where clause
      const where: Prisma.PostWhereInput = {};

      if (filters.forumId) where.forumId = filters.forumId;
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.authorId) where.authorId = filters.authorId;
      if (filters.type) where.type = filters.type;
      if (filters.isPinned !== undefined) where.isPinned = filters.isPinned;
      if (filters.isLocked !== undefined) where.isLocked = filters.isLocked;
      if (filters.isDeleted !== undefined) where.isDeleted = filters.isDeleted;

      // Default to non-deleted posts
      if (filters.isDeleted === undefined) {
        where.isDeleted = false;
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { content: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        ];
      }

      if (filters.createdAfter || filters.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
        if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
      }

      // Include for relations
      const include: Prisma.PostInclude = {
        forum: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
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
      };

      if (includeReplies) {
        include.replies = {
          where: { isDeleted: false },
          take: 3,
          orderBy: { score: "desc" },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
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
      const total = await prisma.post.count({ where });

      // Build order by - pinned posts first within each sort
      const orderBy: Prisma.PostOrderByWithRelationInput[] = [
        { isPinned: "desc" }, // Pinned posts first
      ];

      if (sortBy === "createdAt") {
        orderBy.push({ createdAt: sortOrder });
      } else if (sortBy === "lastReplyAt") {
        orderBy.push({ lastReplyAt: sortOrder });
      } else if (sortBy === "score") {
        orderBy.push({ score: sortOrder });
      } else if (sortBy === "viewCount") {
        orderBy.push({ viewCount: sortOrder });
      } else if (sortBy === "replyCount") {
        orderBy.push({ replyCount: sortOrder });
      }

      // Get posts
      const posts = await prisma.post.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: posts as unknown as Post[],
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Failed to get posts:", error);
      throw error;
    }
  }

  /**
   * Update post
   */
  async updatePost(id: string, data: UpdatePostInput): Promise<Post> {
    try {
      // Check if post exists
      const existingPost = await this.getPostById(id);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      // Check if title changed and generate new slug if needed
      let slug = existingPost.slug;
      if (data.title && data.title !== existingPost.title) {
        slug = await this.generateUniqueSlug(data.title, existingPost.forumId);
      }

      // Verify category if being updated
      if (data.categoryId && data.categoryId !== existingPost.categoryId) {
        const category = await prisma.forumCategory.findUnique({
          where: { id: data.categoryId },
          select: { id: true, forumId: true, isActive: true },
        });

        if (!category || category.forumId !== existingPost.forumId || !category.isActive) {
          throw new Error("Category not found or not in this forum");
        }
      }

      const updatedPost = await prisma.post.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title, slug }),
          ...(data.content && { content: data.content }),
          ...(data.type && { type: data.type }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.attachments && { attachments: data.attachments }),
          ...(data.tags && { tags: data.tags }),
          ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonValue }),
          ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
          ...(data.isLocked !== undefined && { isLocked: data.isLocked }),
          updatedAt: new Date(),
          editedAt: new Date(),
        },
        include: {
          forum: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
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
        },
      });

      // Update category post counts if category changed
      if (data.categoryId !== undefined) {
        await Promise.all([
          this.updateCategoryPostCount(existingPost.categoryId),
          this.updateCategoryPostCount(data.categoryId),
        ]);
      }

      console.log("📝 Post updated:", {
        id: updatedPost.id,
        title: updatedPost.title,
        changes: Object.keys(data),
      });

      return updatedPost as Post;
    } catch (error) {
      console.error("❌ Failed to update post:", error);
      throw error;
    }
  }

  /**
   * Soft delete post
   */
  async deletePost(id: string, deletedBy: string, deleteReason?: string): Promise<void> {
    try {
      const post = await this.getPostById(id);
      if (!post) {
        throw new Error("Post not found");
      }

      await prisma.post.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
          deleteReason,
          updatedAt: new Date(),
        },
      });

      // Update counts
      await Promise.all([
        this.updateForumPostCount(post.forumId),
        this.updateCategoryPostCount(post.categoryId),
      ]);

      console.log("📝 Post soft deleted:", { id, deletedBy, deleteReason });
    } catch (error) {
      console.error("❌ Failed to delete post:", error);
      throw error;
    }
  }

  /**
   * Vote on post (upvote/downvote)
   */
  async voteOnPost(data: CreateVoteInput): Promise<{ success: boolean; score: number }> {
    try {
      if (!data.postId) {
        throw new Error("PostId is required for post voting");
      }

      // Check if user already voted on this post
      const existingVote = await prisma.vote.findUnique({
        where: {
          userId_postId: {
            userId: data.userId,
            postId: data.postId,
          },
        },
      });

      let voteChange = 0;

      if (existingVote) {
        if (existingVote.voteType === data.voteType) {
          // Remove vote if clicking same vote type
          await prisma.vote.delete({
            where: {
              userId_postId: {
                userId: data.userId,
                postId: data.postId,
              },
            },
          });

          voteChange = data.voteType === VoteType.UPVOTE ? -1 : 1;
        } else {
          // Change vote type
          await prisma.vote.update({
            where: {
              userId_postId: {
                userId: data.userId,
                postId: data.postId,
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
            postId: data.postId,
            voteType: data.voteType,
          },
        });

        voteChange = data.voteType === VoteType.UPVOTE ? 1 : -1;
      }

      // Update post vote counts
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

      const updatedPost = await prisma.post.update({
        where: { id: data.postId },
        data: updateData,
        select: { score: true },
      });

      console.log("🗳️ Post vote:", {
        userId: data.userId,
        postId: data.postId,
        voteType: data.voteType,
        voteChange,
        newScore: updatedPost.score,
      });

      return {
        success: true,
        score: updatedPost.score,
      };
    } catch (error) {
      console.error("❌ Failed to vote on post:", error);
      throw error;
    }
  }

  /**
   * Get post statistics
   */
  async getPostStatistics(postId: string): Promise<PostStatistics> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          viewCount: true,
          replyCount: true,
          upvoteCount: true,
          downvoteCount: true,
          score: true,
          createdAt: true,
        },
      });

      if (!post) {
        throw new Error("Post not found");
      }

      // Calculate engagement rate (simplified)
      const totalVotes = post.upvoteCount + post.downvoteCount;
      const engagementRate = post.viewCount > 0 ?
        (totalVotes + post.replyCount) / post.viewCount : 0;

      return {
        viewCount: post.viewCount,
        replyCount: post.replyCount,
        upvoteCount: post.upvoteCount,
        downvoteCount: post.downvoteCount,
        score: post.score,
        engagementRate: Math.round(engagementRate * 100) / 100,
      };
    } catch (error) {
      console.error("❌ Failed to get post statistics:", error);
      throw error;
    }
  }

  /**
   * Increment view count
   */
  private async incrementViewCount(postId: string): Promise<void> {
    try {
      await prisma.post.update({
        where: { id: postId },
        data: {
          viewCount: { increment: 1 },
        },
      });
    } catch (error) {
      console.error("❌ Failed to increment view count:", error);
    }
  }

  /**
   * Update forum activity and counts
   */
  private async updateForumActivity(forumId: string, lastPostBy: string): Promise<void> {
    try {
      await prisma.forum.update({
        where: { id: forumId },
        data: {
          lastActivityAt: new Date(),
          lastPostAt: new Date(),
          lastPostBy,
        },
      });
    } catch (error) {
      console.error("❌ Failed to update forum activity:", error);
    }
  }

  /**
   * Update denormalized forum post count
   */
  private async updateForumPostCount(forumId: string): Promise<void> {
    try {
      const count = await prisma.post.count({
        where: {
          forumId,
          isDeleted: false,
        },
      });

      await prisma.forum.update({
        where: { id: forumId },
        data: { postCount: count },
      });
    } catch (error) {
      console.error("❌ Failed to update forum post count:", error);
    }
  }

  /**
   * Update category post count
   */
  private async updateCategoryPostCount(categoryId?: string): Promise<void> {
    if (!categoryId) return;

    try {
      const count = await prisma.post.count({
        where: {
          categoryId,
          isDeleted: false,
        },
      });

      await prisma.forumCategory.update({
        where: { id: categoryId },
        data: { postCount: count },
      });
    } catch (error) {
      console.error("❌ Failed to update category post count:", error);
    }
  }

  /**
   * Update member post count
   */
  private async updateMemberPostCount(forumId: string, userId: string): Promise<void> {
    try {
      const count = await prisma.post.count({
        where: {
          forumId,
          authorId: userId,
          isDeleted: false,
        },
      });

      await prisma.forumMember.update({
        where: {
          forumId_userId: {
            forumId,
            userId,
          },
        },
        data: { postCount: count },
      });
    } catch (error) {
      console.error("❌ Failed to update member post count:", error);
    }
  }

  /**
   * Generate unique slug for post within forum
   */
  private async generateUniqueSlug(title: string, forumId: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existingPost = await prisma.post.findFirst({
        where: {
          slug,
          forumId,
        },
      });

      if (!existingPost) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;

      // Prevent infinite loop
      if (counter > 100) {
        throw new Error("Unable to generate unique slug");
      }
    }
  }
}