import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  Resource,
  CreateResourceInput,
  UpdateResourceInput,
  CreateResourceRatingInput,
  ShareResourceInput,
  ResourceFilters,
  ResourceStatistics,
  PaginatedResult,
  ResourceContentType,
  ResourceStatus,
  NoteVisibility,
} from "@/lib/types";

/**
 * Resource Repository - Manages curated library with ratings, reviews, and sharing
 * Supports content curation workflow, access control, and analytics
 */
export class ResourceRepository {
  /**
   * Create a new resource
   */
  async createResource(data: CreateResourceInput): Promise<Resource> {
    try {
      // Validate required fields
      if (!data.title || !data.submittedBy || !data.contentType) {
        throw new Error("Missing required fields: title, submittedBy, and contentType are required");
      }

      // Verify submitter exists
      const submitter = await prisma.user.findUnique({
        where: { id: data.submittedBy },
        select: { id: true, familyId: true, role: true },
      });

      if (!submitter) {
        throw new Error("Submitter not found");
      }

      // Validate family if provided
      if (data.familyId) {
        const family = await prisma.family.findUnique({
          where: { id: data.familyId },
          select: { id: true },
        });

        if (!family) {
          throw new Error(`Family with ID ${data.familyId} not found`);
        }
      }

      // Validate category if provided
      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
          select: { id: true, isActive: true },
        });

        if (!category || !category.isActive) {
          throw new Error("Category not found or not active");
        }
      }

      // Validate URL for link-type resources
      if (data.contentType === ResourceContentType.LINK && !data.url) {
        throw new Error("URL is required for link-type resources");
      }

      // Auto-approve for admin users, pending for others
      const status = submitter.role === "ADMIN" ? ResourceStatus.APPROVED : ResourceStatus.PENDING;

      const resource = await prisma.resource.create({
        data: {
          title: data.title,
          description: data.description,
          contentType: data.contentType,
          url: data.url,
          content: data.content,
          attachments: data.attachments || [],
          categoryId: data.categoryId,
          tags: data.tags || [],
          visibility: data.visibility || NoteVisibility.PUBLIC,
          familyId: data.familyId || submitter.familyId,
          targetAudience: data.targetAudience || [],
          status,
          submittedBy: data.submittedBy,
          approvedBy: status === ResourceStatus.APPROVED ? data.submittedBy : undefined,
          approvedAt: status === ResourceStatus.APPROVED ? new Date() : undefined,
          externalMeta: (data.externalMeta || {}) as Prisma.InputJsonValue,
          isVerified: submitter.role === "ADMIN",
          lastVerifiedAt: submitter.role === "ADMIN" ? new Date() : undefined,
        },
        include: {
          submitter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            },
          },
        },
      });

      console.log("📚 Resource created:", {
        id: resource.id,
        title: resource.title,
        contentType: resource.contentType,
        status: resource.status,
        submittedBy: resource.submittedBy,
      });

      return resource as Resource;
    } catch (error) {
      console.error("❌ Failed to create resource:", error);
      throw error;
    }
  }

  /**
   * Get resource by ID with access control
   */
  async getResourceById(
    id: string,
    userId?: string,
    options: {
      includeDeleted?: boolean;
      includeRatings?: boolean;
      includeDocuments?: boolean;
      includeShares?: boolean;
    } = {}
  ): Promise<Resource | null> {
    try {
      const include: Prisma.ResourceInclude = {
        submitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      };

      if (options.includeRatings) {
        include.ratings = {
          take: 10,
          orderBy: { createdAt: "desc" },
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
          orderBy: [
            { isMain: "desc" }, // Main documents first
            { order: "asc" },
          ],
        };
      }

      if (options.includeShares) {
        include.shares = {
          take: 10,
          orderBy: { sharedAt: "desc" },
          include: {
            sharer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            recipient: {
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

      const resource = await prisma.resource.findUnique({
        where: { id },
        include,
      });

      if (!resource) {
        return null;
      }

      // Check access permissions
      if (userId && !this.canUserAccessResource(resource, userId)) {
        throw new Error("Access denied to this resource");
      }

      // Update view count
      if (userId) {
        await this.incrementViewCount(id);
      }

      // Transform documents from junction table to Document array if included
      if (options.includeDocuments && resource.documents) {
        const transformedResource = {
          ...resource,
          documents: resource.documents.map((rd: any) => rd.document)
        };
        return transformedResource as unknown as Resource;
      }

      return resource as unknown as Resource;
    } catch (error) {
      console.error("❌ Failed to get resource by ID:", error);
      throw error;
    }
  }

  /**
   * Get resources with filtering and pagination
   */
  async getResources(
    filters: ResourceFilters = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: "createdAt" | "viewCount" | "rating" | "title" | "downloadCount";
      sortOrder?: "asc" | "desc";
      includeRatings?: boolean;
      userId?: string; // For access control
    } = {}
  ): Promise<PaginatedResult<Resource>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
        includeRatings = false,
        userId,
      } = options;

      // Build where clause with access control
      const where: Prisma.ResourceWhereInput = {};

      // Access control: only approved resources unless user has special access
      if (!this.hasAdminAccess(userId)) {
        where.status = ResourceStatus.APPROVED;
      }

      // Apply filters
      if (filters.submittedBy) where.submittedBy = filters.submittedBy;
      if (filters.familyId) where.familyId = filters.familyId;
      if (filters.contentType) where.contentType = filters.contentType;
      if (filters.status) where.status = filters.status;
      if (filters.visibility) where.visibility = filters.visibility;
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.targetAudience && filters.targetAudience.length > 0) {
        where.targetAudience = { hasSome: filters.targetAudience };
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { content: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        ];
      }

      if (filters.ratingMin !== undefined || filters.ratingMax !== undefined) {
        where.rating = {};
        if (filters.ratingMin !== undefined) where.rating.gte = filters.ratingMin;
        if (filters.ratingMax !== undefined) where.rating.lte = filters.ratingMax;
      }

      if (filters.createdAfter || filters.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
        if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
      }

      // Include for relations
      const include: Prisma.ResourceInclude = {
        submitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      };

      if (includeRatings) {
        include.ratings = {
          take: 3, // Limited for performance
          orderBy: { rating: "desc" },
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
      const total = await prisma.resource.count({ where });

      // Build order by - featured resources first
      const orderBy: Prisma.ResourceOrderByWithRelationInput[] = [
        { status: "desc" }, // Featured first
      ];

      if (sortBy === "rating") {
        orderBy.push({ rating: sortOrder }, { ratingCount: "desc" });
      } else if (sortBy === "viewCount") {
        orderBy.push({ viewCount: sortOrder });
      } else if (sortBy === "downloadCount") {
        orderBy.push({ downloadCount: sortOrder });
      } else if (sortBy === "title") {
        orderBy.push({ title: sortOrder });
      } else {
        orderBy.push({ createdAt: sortOrder });
      }

      // Get resources
      const resources = await prisma.resource.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: resources as unknown as Resource[],
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Failed to get resources:", error);
      throw error;
    }
  }

  /**
   * Update resource
   */
  async updateResource(id: string, data: UpdateResourceInput, userId: string): Promise<Resource> {
    try {
      // Check if resource exists and user has edit permissions
      const existingResource = await this.getResourceById(id, userId);
      if (!existingResource) {
        throw new Error("Resource not found");
      }

      if (!this.canUserEditResource(existingResource, userId)) {
        throw new Error("Access denied to edit this resource");
      }

      // Validate category if being updated
      if (data.categoryId && data.categoryId !== existingResource.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
          select: { id: true, isActive: true },
        });

        if (!category || !category.isActive) {
          throw new Error("Category not found or not active");
        }
      }

      // If status is being updated to approved, set approval info
      const updateData: any = {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.contentType && { contentType: data.contentType }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.attachments && { attachments: data.attachments }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.tags && { tags: data.tags }),
        ...(data.visibility && { visibility: data.visibility }),
        ...(data.targetAudience && { targetAudience: data.targetAudience }),
        ...(data.externalMeta && { externalMeta: data.externalMeta as Prisma.InputJsonValue }),
        updatedAt: new Date(),
      };

      if (data.status) {
        updateData.status = data.status;
        if (data.status === ResourceStatus.APPROVED) {
          updateData.approvedBy = userId;
          updateData.approvedAt = new Date();
        } else if (data.status === ResourceStatus.FEATURED) {
          updateData.featuredBy = userId;
          updateData.featuredAt = new Date();
        }
      }

      if (data.isVerified !== undefined) {
        updateData.isVerified = data.isVerified;
        if (data.isVerified) {
          updateData.lastVerifiedAt = new Date();
        }
      }

      const updatedResource = await prisma.resource.update({
        where: { id },
        data: updateData,
        include: {
          submitter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      console.log("📚 Resource updated:", {
        id: updatedResource.id,
        title: updatedResource.title,
        changes: Object.keys(data),
        updatedBy: userId,
      });

      return updatedResource as Resource;
    } catch (error) {
      console.error("❌ Failed to update resource:", error);
      throw error;
    }
  }

  /**
   * Delete resource (only submitter or admin can delete)
   */
  async deleteResource(id: string, userId: string): Promise<void> {
    try {
      const resource = await this.getResourceById(id, userId);
      if (!resource) {
        throw new Error("Resource not found");
      }

      // Only submitter or admin can delete
      if (resource.submittedBy !== userId && !this.hasAdminAccess(userId)) {
        throw new Error("Only the submitter or admin can delete this resource");
      }

      await prisma.resource.delete({
        where: { id },
      });

      console.log("📚 Resource deleted:", { id, deletedBy: userId });
    } catch (error) {
      console.error("❌ Failed to delete resource:", error);
      throw error;
    }
  }

  /**
   * Rate a resource
   */
  async rateResource(data: CreateResourceRatingInput): Promise<{ success: boolean; newRating: number }> {
    try {
      // Validate rating value
      if (data.rating < 1 || data.rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }

      // Check if resource exists
      const resource = await this.getResourceById(data.resourceId, data.userId);
      if (!resource) {
        throw new Error("Resource not found");
      }

      // Check if user already rated this resource
      const existingRating = await prisma.resourceRating.findUnique({
        where: {
          resourceId_userId: {
            resourceId: data.resourceId,
            userId: data.userId,
          },
        },
      });

      if (existingRating) {
        // Update existing rating
        await prisma.resourceRating.update({
          where: {
            resourceId_userId: {
              resourceId: data.resourceId,
              userId: data.userId,
            },
          },
          data: {
            rating: data.rating,
            review: data.review,
            isHelpful: data.isHelpful,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new rating
        await prisma.resourceRating.create({
          data: {
            resourceId: data.resourceId,
            userId: data.userId,
            rating: data.rating,
            review: data.review,
            isHelpful: data.isHelpful,
          },
        });
      }

      // Recalculate resource rating
      const ratings = await prisma.resourceRating.findMany({
        where: { resourceId: data.resourceId },
        select: { rating: true },
      });

      const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = ratings.length > 0 ? totalRating / ratings.length : 0;

      // Update resource with new rating
      await prisma.resource.update({
        where: { id: data.resourceId },
        data: {
          rating: Math.round(averageRating * 100) / 100, // Round to 2 decimal places
          ratingCount: ratings.length,
          updatedAt: new Date(),
        },
      });

      console.log("⭐ Resource rated:", {
        resourceId: data.resourceId,
        userId: data.userId,
        rating: data.rating,
        newAverage: averageRating,
      });

      return {
        success: true,
        newRating: Math.round(averageRating * 100) / 100,
      };
    } catch (error) {
      console.error("❌ Failed to rate resource:", error);
      throw error;
    }
  }

  /**
   * Share a resource
   */
  async shareResource(data: ShareResourceInput): Promise<void> {
    try {
      // Check if resource exists
      const resource = await this.getResourceById(data.resourceId, data.sharedBy);
      if (!resource) {
        throw new Error("Resource not found");
      }

      // Validate recipient if specified
      if (data.sharedWith) {
        const recipient = await prisma.user.findUnique({
          where: { id: data.sharedWith },
          select: { id: true },
        });

        if (!recipient) {
          throw new Error("Recipient not found");
        }
      }

      // Record the share
      await prisma.resourceShare.create({
        data: {
          resourceId: data.resourceId,
          sharedBy: data.sharedBy,
          sharedWith: data.sharedWith,
          shareMethod: data.shareMethod,
          shareData: (data.shareData || {}) as Prisma.InputJsonValue,
        },
      });

      // Increment share count
      await prisma.resource.update({
        where: { id: data.resourceId },
        data: {
          shareCount: { increment: 1 },
        },
      });

      console.log("📚 Resource shared:", {
        resourceId: data.resourceId,
        sharedBy: data.sharedBy,
        sharedWith: data.sharedWith,
        shareMethod: data.shareMethod,
      });
    } catch (error) {
      console.error("❌ Failed to share resource:", error);
      throw error;
    }
  }

  /**
   * Get resource statistics
   */
  async getResourceStatistics(): Promise<ResourceStatistics> {
    try {
      const totalResources = await prisma.resource.count();
      const approvedResources = await prisma.resource.count({
        where: { status: ResourceStatus.APPROVED },
      });
      const featuredResources = await prisma.resource.count({
        where: { status: ResourceStatus.FEATURED },
      });
      const pendingResources = await prisma.resource.count({
        where: { status: ResourceStatus.PENDING },
      });
      const totalRatings = await prisma.resourceRating.count();
      const totalShares = await prisma.resourceShare.count();

      // Get average rating
      const avgRatingResult = await prisma.resourceRating.aggregate({
        _avg: { rating: true },
      });
      const averageRating = avgRatingResult._avg.rating || 0;

      // Get top categories
      const categoryStats = await prisma.resource.groupBy({
        by: ['categoryId'],
        _count: { categoryId: true },
        where: {
          status: ResourceStatus.APPROVED,
          categoryId: { not: null }
        },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 10,
      });

      return {
        totalResources,
        approvedResources,
        featuredResources,
        pendingResources,
        totalRatings,
        totalShares,
        averageRating: Math.round(averageRating * 100) / 100,
        topCategories: categoryStats.map(stat => ({
          categoryId: stat.categoryId!,
          count: stat._count.categoryId,
        })),
      };
    } catch (error) {
      console.error("❌ Failed to get resource statistics:", error);
      throw error;
    }
  }

  /**
   * Increment view count
   */
  private async incrementViewCount(resourceId: string): Promise<void> {
    try {
      await prisma.resource.update({
        where: { id: resourceId },
        data: {
          viewCount: { increment: 1 },
        },
      });
    } catch (error) {
      console.error("❌ Failed to increment view count:", error);
    }
  }

  /**
   * Check if user can access resource
   */
  private canUserAccessResource(resource: any, userId: string): boolean {
    // Submitter can always access
    if (resource.submittedBy === userId) {
      return true;
    }

    // Check visibility
    if (resource.visibility === NoteVisibility.PUBLIC) {
      return true;
    }

    // Family visibility - would need user's familyId to check
    // This would be validated in the query level

    return true; // For now, allow access (implement proper access control as needed)
  }

  /**
   * Check if user can edit resource
   */
  private canUserEditResource(resource: any, userId: string): boolean {
    // Submitter can always edit (unless approved/featured)
    if (resource.submittedBy === userId &&
        ![ResourceStatus.APPROVED, ResourceStatus.FEATURED].includes(resource.status)) {
      return true;
    }

    // Admin can edit any resource
    return this.hasAdminAccess(userId);
  }

  /**
   * Check if user has admin access
   */
  private hasAdminAccess(userId?: string): boolean {
    // TODO: Implement proper admin check by querying user role
    // For now, return false
    return false;
  }
}