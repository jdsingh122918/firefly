import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  Forum,
  CreateForumInput,
  UpdateForumInput,
  ForumMembershipInput,
  ForumFilters,
  ForumStatistics,
  PaginatedResult,
  ForumVisibility,
} from "@/lib/types";

/**
 * Forum Repository - Manages forum CRUD operations and membership
 * Follows established patterns from DocumentRepository
 */
export class ForumRepository {
  /**
   * Create a new forum
   */
  async createForum(data: CreateForumInput): Promise<Forum> {
    try {
      // Validate required fields
      if (!data.title || !data.createdBy) {
        throw new Error("Missing required fields: title and createdBy are required");
      }

      // Generate URL-friendly slug
      const slug = this.generateSlug(data.title);

      // Check for slug uniqueness
      const existingForum = await prisma.forum.findUnique({
        where: { slug },
      });

      if (existingForum) {
        throw new Error(`Forum with slug '${slug}' already exists`);
      }

      // Validate family exists if familyId provided
      if (data.familyId) {
        const family = await prisma.family.findUnique({
          where: { id: data.familyId },
        });
        if (!family) {
          throw new Error(`Family with ID ${data.familyId} not found`);
        }
      }

      const forum = await prisma.forum.create({
        data: {
          title: data.title,
          description: data.description,
          slug,
          icon: data.icon,
          color: data.color,
          visibility: data.visibility || ForumVisibility.PUBLIC,
          familyId: data.familyId,
          allowedRoles: data.allowedRoles || [],
          createdBy: data.createdBy,
          moderators: [data.createdBy], // Creator is initial moderator
          rules: data.rules,
          settings: (data.settings || {}) as Prisma.InputJsonValue,
          lastActivityAt: new Date(),
        },
        include: {
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Add creator as forum member
      await this.addMember({
        forumId: forum.id,
        userId: data.createdBy,
        role: "admin",
        notifications: true,
      });

      console.log("🏛️ Forum created:", {
        id: forum.id,
        title: forum.title,
        slug: forum.slug,
        visibility: forum.visibility,
        createdBy: forum.createdBy,
      });

      return forum as Forum;
    } catch (error) {
      console.error("❌ Failed to create forum:", error);
      throw error;
    }
  }

  /**
   * Get forum by ID
   */
  async getForumById(
    id: string,
    options: {
      includeDeleted?: boolean;
      includePosts?: boolean;
      includeMembers?: boolean;
    } = {}
  ): Promise<Forum | null> {
    try {
      const whereClause: { id: string; isActive?: boolean } = { id };

      if (!options.includeDeleted) {
        whereClause.isActive = true;
      }

      const include: Prisma.ForumInclude = {
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      };

      if (options.includePosts) {
        include.posts = {
          where: { isDeleted: false },
          orderBy: { isPinned: "desc", lastReplyAt: "desc" },
          take: 10,
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

      if (options.includeMembers) {
        include.members = {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        };
      }

      const forum = await prisma.forum.findUnique({
        where: whereClause,
        include,
      });

      return forum as Forum | null;
    } catch (error) {
      console.error("❌ Failed to get forum by ID:", error);
      throw error;
    }
  }

  /**
   * Get forum by slug
   */
  async getForumBySlug(slug: string): Promise<Forum | null> {
    try {
      const forum = await prisma.forum.findUnique({
        where: { slug },
        include: {
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return forum as Forum | null;
    } catch (error) {
      console.error("❌ Failed to get forum by slug:", error);
      throw error;
    }
  }

  /**
   * Get forums with filtering and pagination
   */
  async getForums(
    filters: ForumFilters = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: "createdAt" | "lastActivityAt" | "title" | "postCount" | "memberCount";
      sortOrder?: "asc" | "desc";
      includeMembers?: boolean;
    } = {}
  ): Promise<PaginatedResult<Forum>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "lastActivityAt",
        sortOrder = "desc",
        includeMembers = false,
      } = options;

      // Build where clause
      const where: Prisma.ForumWhereInput = {};

      if (filters.visibility) where.visibility = filters.visibility;
      if (filters.familyId) where.familyId = filters.familyId;
      if (filters.createdBy) where.createdBy = filters.createdBy;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.isArchived !== undefined) where.isArchived = filters.isArchived;

      // Default to active, non-archived forums
      if (filters.isActive === undefined && filters.isArchived === undefined) {
        where.isActive = true;
        where.isArchived = false;
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        ];
      }

      // Include for relations
      const include: Prisma.ForumInclude = {
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      };

      if (includeMembers) {
        include.members = {
          take: 5, // Limit for performance
          include: {
            user: {
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

      // Get total count
      const total = await prisma.forum.count({ where });

      // Get forums
      const forums = await prisma.forum.findMany({
        where,
        include,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: forums as Forum[],
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Failed to get forums:", error);
      throw error;
    }
  }

  /**
   * Update forum
   */
  async updateForum(id: string, data: UpdateForumInput): Promise<Forum> {
    try {
      // Check if forum exists
      const existingForum = await this.getForumById(id);
      if (!existingForum) {
        throw new Error("Forum not found");
      }

      // Check slug uniqueness if title is being updated
      if (data.title && data.title !== existingForum.title) {
        const newSlug = this.generateSlug(data.title);
        const existingSlug = await prisma.forum.findUnique({
          where: { slug: newSlug },
        });

        if (existingSlug && existingSlug.id !== id) {
          throw new Error(`Forum with slug '${newSlug}' already exists`);
        }

        // Update slug if title changed
        (data as any).slug = newSlug;
      }

      const updatedForum = await prisma.forum.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.icon !== undefined && { icon: data.icon }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.visibility && { visibility: data.visibility }),
          ...(data.allowedRoles && { allowedRoles: data.allowedRoles }),
          ...(data.moderators && { moderators: data.moderators }),
          ...(data.rules !== undefined && { rules: data.rules }),
          ...(data.settings && { settings: data.settings as Prisma.InputJsonValue }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
          ...(data.title && { slug: this.generateSlug(data.title) }),
          updatedAt: new Date(),
        },
        include: {
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      console.log("🏛️ Forum updated:", {
        id: updatedForum.id,
        title: updatedForum.title,
        changes: Object.keys(data),
      });

      return updatedForum as Forum;
    } catch (error) {
      console.error("❌ Failed to update forum:", error);
      throw error;
    }
  }

  /**
   * Soft delete forum (mark as inactive)
   */
  async deleteForum(id: string): Promise<void> {
    try {
      await prisma.forum.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      console.log("🏛️ Forum soft deleted:", id);
    } catch (error) {
      console.error("❌ Failed to delete forum:", error);
      throw error;
    }
  }

  /**
   * Archive forum
   */
  async archiveForum(id: string): Promise<void> {
    try {
      await prisma.forum.update({
        where: { id },
        data: {
          isArchived: true,
          updatedAt: new Date(),
        },
      });

      console.log("📦 Forum archived:", id);
    } catch (error) {
      console.error("❌ Failed to archive forum:", error);
      throw error;
    }
  }

  /**
   * Add member to forum
   */
  async addMember(data: ForumMembershipInput): Promise<void> {
    try {
      // Check if user is already a member
      const existingMember = await prisma.forumMember.findUnique({
        where: {
          forumId_userId: {
            forumId: data.forumId,
            userId: data.userId,
          },
        },
      });

      if (existingMember) {
        throw new Error("User is already a member of this forum");
      }

      await prisma.forumMember.create({
        data: {
          forumId: data.forumId,
          userId: data.userId,
          role: data.role || "member",
          notifications: data.notifications ?? true,
          lastViewedAt: new Date(),
        },
      });

      // Update forum member count
      await this.updateMemberCount(data.forumId);

      console.log("👥 Forum member added:", {
        forumId: data.forumId,
        userId: data.userId,
        role: data.role || "member",
      });
    } catch (error) {
      console.error("❌ Failed to add forum member:", error);
      throw error;
    }
  }

  /**
   * Remove member from forum
   */
  async removeMember(forumId: string, userId: string): Promise<void> {
    try {
      await prisma.forumMember.delete({
        where: {
          forumId_userId: {
            forumId,
            userId,
          },
        },
      });

      // Update forum member count
      await this.updateMemberCount(forumId);

      console.log("👥 Forum member removed:", { forumId, userId });
    } catch (error) {
      console.error("❌ Failed to remove forum member:", error);
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(forumId: string, userId: string, role: string): Promise<void> {
    try {
      await prisma.forumMember.update({
        where: {
          forumId_userId: {
            forumId,
            userId,
          },
        },
        data: {
          role,
        },
      });

      console.log("👥 Forum member role updated:", { forumId, userId, role });
    } catch (error) {
      console.error("❌ Failed to update member role:", error);
      throw error;
    }
  }

  /**
   * Get forum members
   */
  async getForumMembers(forumId: string): Promise<any[]> {
    try {
      const members = await prisma.forumMember.findMany({
        where: { forumId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: [
          { role: "desc" }, // Admins and moderators first
          { joinedAt: "asc" }, // Then by join date
        ],
      });

      return members;
    } catch (error) {
      console.error("❌ Failed to get forum members:", error);
      throw error;
    }
  }

  /**
   * Check if user is member of forum
   */
  async isMember(forumId: string, userId: string): Promise<boolean> {
    try {
      const member = await prisma.forumMember.findUnique({
        where: {
          forumId_userId: {
            forumId,
            userId,
          },
        },
      });

      return !!member;
    } catch (error) {
      console.error("❌ Failed to check forum membership:", error);
      return false;
    }
  }

  /**
   * Get forums where user is a member
   */
  async getUserForums(userId: string): Promise<Forum[]> {
    try {
      const memberships = await prisma.forumMember.findMany({
        where: { userId },
        include: {
          forum: {
            include: {
              family: {
                select: {
                  id: true,
                  name: true,
                },
              },
              creator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          forum: {
            lastActivityAt: "desc",
          },
        },
      });

      return memberships.map((membership) => membership.forum) as Forum[];
    } catch (error) {
      console.error("❌ Failed to get user forums:", error);
      throw error;
    }
  }

  /**
   * Update forum activity timestamp
   */
  async updateActivity(forumId: string, lastPostBy?: string): Promise<void> {
    try {
      await prisma.forum.update({
        where: { id: forumId },
        data: {
          lastActivityAt: new Date(),
          ...(lastPostBy && { lastPostAt: new Date(), lastPostBy }),
        },
      });
    } catch (error) {
      console.error("❌ Failed to update forum activity:", error);
      throw error;
    }
  }

  /**
   * Update member counts (denormalized for performance)
   */
  private async updateMemberCount(forumId: string): Promise<void> {
    try {
      const memberCount = await prisma.forumMember.count({
        where: { forumId },
      });

      await prisma.forum.update({
        where: { id: forumId },
        data: { memberCount },
      });
    } catch (error) {
      console.error("❌ Failed to update member count:", error);
    }
  }

  /**
   * Get forum statistics
   */
  async getForumStatistics(): Promise<ForumStatistics> {
    try {
      const totalForums = await prisma.forum.count({
        where: { isActive: true },
      });

      const totalPosts = await prisma.post.count({
        where: { isDeleted: false },
      });

      const totalReplies = await prisma.reply.count({
        where: { isDeleted: false },
      });

      const totalMembers = await prisma.forumMember.count();

      const activeForums = await prisma.forum.count({
        where: {
          isActive: true,
          isArchived: false,
        },
      });

      // Recent activity counts
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const recentActivity = {
        last24h: await prisma.post.count({
          where: {
            createdAt: { gte: last24h },
            isDeleted: false,
          },
        }),
        last7d: await prisma.post.count({
          where: {
            createdAt: { gte: last7d },
            isDeleted: false,
          },
        }),
        last30d: await prisma.post.count({
          where: {
            createdAt: { gte: last30d },
            isDeleted: false,
          },
        }),
      };

      return {
        totalForums,
        totalPosts,
        totalReplies,
        totalMembers,
        activeForums,
        recentActivity,
        topContributors: [], // TODO: Implement top contributors query
      };
    } catch (error) {
      console.error("❌ Failed to get forum statistics:", error);
      throw error;
    }
  }

  // ====================================
  // ADMIN DASHBOARD STATS (Session 022)
  // ====================================

  /**
   * Get simplified forum statistics for admin dashboard
   */
  async getForumStats(): Promise<{
    totalForums: number;
    activeForums: number;
    totalPosts: number;
    totalReplies: number;
    postsThisMonth: number;
    forumsWithRecentActivity: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get all statistics in parallel for performance
      const [
        totalForums,
        activeForums,
        totalPosts,
        totalReplies,
        postsThisMonth,
        forumsWithRecentActivity,
      ] = await Promise.all([
        // Total forums (active only)
        prisma.forum.count({
          where: {
            isActive: true
          }
        }),

        // Active forums (not archived)
        prisma.forum.count({
          where: {
            isActive: true,
            isArchived: false
          }
        }),

        // Total posts (not deleted)
        prisma.post.count({
          where: { isDeleted: false }
        }),

        // Total replies (not deleted)
        prisma.reply.count({
          where: { isDeleted: false }
        }),

        // Posts created this month
        prisma.post.count({
          where: {
            isDeleted: false,
            createdAt: { gte: startOfMonth }
          }
        }),

        // Forums with activity in the last week
        prisma.forum.count({
          where: {
            isActive: true,
            lastActivityAt: { gte: lastWeek }
          }
        }),
      ]);

      const stats = {
        totalForums,
        activeForums,
        totalPosts,
        totalReplies,
        postsThisMonth,
        forumsWithRecentActivity,
      };

      console.log("📊 Forum statistics generated:", stats);
      return stats;
    } catch (error) {
      console.error("❌ Failed to get forum statistics:", error);
      throw error;
    }
  }

  /**
   * Generate URL-friendly slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .substring(0, 50); // Limit length
  }
}