import {
  PrismaClient,
  Content,
  ContentType,
  NoteType,
  ResourceContentType,
  ResourceStatus,
  NoteVisibility,
  UserRole,
  ContentAssignment,
  ContentDocument,
  ContentShare,
  ContentTag,
  ContentRating,
  AssignmentPriority,
  AssignmentStatus
} from '@prisma/client';

/**
 * Unified Content Repository - Consolidates Notes and Resources
 *
 * This repository handles all content operations for both NOTE and RESOURCE types,
 * preserving the unique features of each while eliminating code duplication.
 *
 * Key Features Preserved:
 * - Assignment System (NOTE only): Complete task management workflow
 * - Curation Workflow (RESOURCE only): Approval, featuring, rating system
 * - Role-based Access Control: ADMIN/VOLUNTEER/MEMBER permissions
 * - Family-scoped Restrictions: VOLUNTEER can only assign to their families
 */

export interface ContentFilters {
  contentType?: ContentType[];
  noteType?: NoteType[];
  resourceType?: ResourceContentType[];
  status?: ResourceStatus[];
  createdBy?: string;
  familyId?: string;
  visibility?: NoteVisibility[];
  categoryId?: string;
  tags?: string[];
  healthcareCategories?: string[];
  healthcareTags?: string[];
  search?: string;
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  featured?: boolean;
  verified?: boolean;
  minRating?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'viewCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateContentInput {
  title: string;
  description?: string;
  body?: string;
  contentType: ContentType;
  noteType?: NoteType;
  resourceType?: ResourceContentType;
  visibility?: NoteVisibility;
  familyId?: string;
  categoryId?: string;
  tags?: string[];

  // NOTE-specific fields
  isPinned?: boolean;
  allowComments?: boolean;
  allowEditing?: boolean;

  // RESOURCE-specific fields
  url?: string;
  targetAudience?: string[];
  externalMeta?: any;

  // Feature flags
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
}

export interface UpdateContentInput extends Partial<CreateContentInput> {
  lastEditedBy?: string;
}

export interface ContentOptions {
  includeDocuments?: boolean;
  includeShares?: boolean;
  includeAssignments?: boolean;
  includeStructuredTags?: boolean;
  includeRatings?: boolean;
  includeCreator?: boolean;
  includeFamily?: boolean;
  includeCategory?: boolean;
}

export interface PaginatedContent {
  content: Content[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AssignmentInput {
  title: string;
  description?: string;
  priority?: AssignmentPriority;
  assignedTo: string;
  dueDate?: Date;
  estimatedMinutes?: number;
  tags?: string[];
}

class ContentRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create new content (NOTE or RESOURCE)
   */
  async create(
    data: CreateContentInput,
    userId: string,
    userRole: UserRole
  ): Promise<Content> {
    // Validate user permissions
    await this.validateCreatePermissions(data, userId, userRole);

    // Set defaults based on content type
    const contentData = this.prepareContentData(data, userId, userRole);

    try {
      return await this.prisma.content.create({
        data: contentData,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          family: {
            select: { id: true, name: true }
          },
          category: {
            select: { id: true, name: true, color: true }
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to create content: ${error}`);
    }
  }

  /**
   * Find content by ID with role-based access control
   */
  async findById(
    id: string,
    userId: string,
    userRole: UserRole,
    options: ContentOptions = {}
  ): Promise<Content | null> {
    const include = this.buildIncludeClause(options);

    const content = await this.prisma.content.findUnique({
      where: { id },
      include
    });

    if (!content) {
      return null;
    }

    // Check access permissions
    const hasAccess = await this.checkContentAccess(content, userId, userRole);
    if (!hasAccess) {
      return null;
    }

    return content;
  }

  /**
   * Filter and paginate content with role-based access
   */
  async filter(
    filters: ContentFilters,
    userId: string,
    userRole: UserRole,
    options: ContentOptions = {}
  ): Promise<PaginatedContent> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    const where = await this.buildWhereClause(filters, userId, userRole);
    const orderBy = this.buildOrderByClause(filters);
    const include = this.buildIncludeClause(options);

    const [content, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        include,
        orderBy,
        skip: offset,
        take: limit
      }),
      this.prisma.content.count({ where })
    ]);

    return {
      content,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Update content with permission checks
   */
  async update(
    id: string,
    data: UpdateContentInput,
    userId: string,
    userRole: UserRole
  ): Promise<Content> {
    // Check if content exists and user has permission
    const existingContent = await this.findById(id, userId, userRole);
    if (!existingContent) {
      throw new Error('Content not found or access denied');
    }

    // Validate update permissions
    await this.validateUpdatePermissions(existingContent, userId, userRole);

    // Track edits for NOTE content
    const updateData = { ...data };
    if (existingContent.contentType === ContentType.NOTE) {
      updateData.lastEditedBy = userId;
    }

    try {
      return await this.prisma.content.update({
        where: { id },
        data: updateData,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          family: {
            select: { id: true, name: true }
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to update content: ${error}`);
    }
  }

  /**
   * Soft delete content
   */
  async delete(
    id: string,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    const content = await this.findById(id, userId, userRole);
    if (!content) {
      throw new Error('Content not found or access denied');
    }

    await this.validateDeletePermissions(content, userId, userRole);

    await this.prisma.content.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.content.update({
      where: { id },
      data: {
        viewCount: { increment: 1 }
      }
    });
  }

  // ========================================
  // ASSIGNMENT SYSTEM (NOTE content only)
  // ========================================

  /**
   * Create assignment for NOTE content
   */
  async createAssignment(
    contentId: string,
    assignmentData: AssignmentInput,
    assignerId: string,
    assignerRole: UserRole
  ): Promise<ContentAssignment> {
    const content = await this.findById(contentId, assignerId, assignerRole);
    if (!content || content.contentType !== ContentType.NOTE) {
      throw new Error('Content not found or not a NOTE');
    }

    // Validate assignment permissions (VOLUNTEER family-scoped restriction)
    await this.validateAssignmentPermissions(
      assignmentData.assignedTo,
      assignerId,
      assignerRole
    );

    try {
      const assignment = await this.prisma.contentAssignment.create({
        data: {
          ...assignmentData,
          contentId,
          assignedBy: assignerId,
          status: AssignmentStatus.ASSIGNED
        },
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        }
      });

      // Update content to enable assignments flag
      await this.prisma.content.update({
        where: { id: contentId },
        data: { hasAssignments: true }
      });

      return assignment;
    } catch (error) {
      throw new Error(`Failed to create assignment: ${error}`);
    }
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(
    assignmentId: string,
    status: AssignmentStatus,
    userId: string,
    completionNotes?: string
  ): Promise<ContentAssignment> {
    const assignment = await this.prisma.contentAssignment.findUnique({
      where: { id: assignmentId },
      include: { content: true }
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Validate user can update this assignment
    const canUpdate = assignment.assignedTo === userId ||
                     assignment.assignedBy === userId;

    if (!canUpdate) {
      throw new Error('Permission denied to update assignment');
    }

    const updateData: any = { status };

    if (status === AssignmentStatus.COMPLETED) {
      updateData.completedAt = new Date();
      updateData.completedBy = userId;
      if (completionNotes) {
        updateData.completionNotes = completionNotes;
      }
    }

    return await this.prisma.contentAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        content: {
          select: { id: true, title: true }
        }
      }
    });
  }

  /**
   * Get assignments for user
   */
  async getAssignedTasks(
    userId: string,
    status?: AssignmentStatus[]
  ): Promise<ContentAssignment[]> {
    const where: any = { assignedTo: userId };

    if (status && status.length > 0) {
      where.status = { in: status };
    }

    return await this.prisma.contentAssignment.findMany({
      where,
      include: {
        content: {
          select: {
            id: true,
            title: true,
            contentType: true,
            family: {
              select: { id: true, name: true }
            }
          }
        },
        assigner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  // ========================================
  // CURATION SYSTEM (RESOURCE content only)
  // ========================================

  /**
   * Get content awaiting curation (RESOURCE only)
   */
  async getCurationQueue(
    adminId: string,
    adminRole: UserRole
  ): Promise<Content[]> {
    if (adminRole !== UserRole.ADMIN) {
      throw new Error('Only admins can access curation queue');
    }

    return await this.prisma.content.findMany({
      where: {
        contentType: ContentType.RESOURCE,
        status: ResourceStatus.PENDING,
        hasCuration: true
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        family: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Approve resource content
   */
  async approveContent(
    contentId: string,
    approverId: string,
    approverRole: UserRole
  ): Promise<Content> {
    if (approverRole !== UserRole.ADMIN) {
      throw new Error('Only admins can approve content');
    }

    const content = await this.findById(contentId, approverId, approverRole);
    if (!content || content.contentType !== ContentType.RESOURCE) {
      throw new Error('Content not found or not a RESOURCE');
    }

    return await this.prisma.content.update({
      where: { id: contentId },
      data: {
        status: ResourceStatus.APPROVED,
        approvedBy: approverId,
        approvedAt: new Date()
      }
    });
  }

  /**
   * Feature resource content
   */
  async featureContent(
    contentId: string,
    featurerId: string,
    featurerRole: UserRole
  ): Promise<Content> {
    if (featurerRole !== UserRole.ADMIN) {
      throw new Error('Only admins can feature content');
    }

    const content = await this.findById(contentId, featurerId, featurerRole);
    if (!content || content.contentType !== ContentType.RESOURCE) {
      throw new Error('Content not found or not a RESOURCE');
    }

    return await this.prisma.content.update({
      where: { id: contentId },
      data: {
        status: ResourceStatus.FEATURED,
        featuredBy: featurerId,
        featuredAt: new Date()
      }
    });
  }

  // ========================================
  // RATING SYSTEM (RESOURCE content only)
  // ========================================

  /**
   * Add or update rating for RESOURCE content
   */
  async rateContent(
    contentId: string,
    userId: string,
    rating: number,
    review?: string,
    isHelpful?: boolean
  ): Promise<ContentRating> {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!content || content.contentType !== ContentType.RESOURCE) {
      throw new Error('Content not found or not ratable');
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    try {
      // Upsert rating
      const contentRating = await this.prisma.contentRating.upsert({
        where: {
          contentId_userId: {
            contentId,
            userId
          }
        },
        create: {
          contentId,
          userId,
          rating,
          review,
          isHelpful
        },
        update: {
          rating,
          review,
          isHelpful,
          updatedAt: new Date()
        }
      });

      // Recalculate average rating
      await this.recalculateRating(contentId);

      return contentRating;
    } catch (error) {
      throw new Error(`Failed to rate content: ${error}`);
    }
  }

  /**
   * Recalculate average rating for content
   */
  private async recalculateRating(contentId: string): Promise<void> {
    const ratings = await this.prisma.contentRating.findMany({
      where: { contentId }
    });

    if (ratings.length === 0) {
      await this.prisma.content.update({
        where: { id: contentId },
        data: {
          rating: null,
          ratingCount: 0
        }
      });
      return;
    }

    const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / ratings.length;

    await this.prisma.content.update({
      where: { id: contentId },
      data: {
        rating: Math.round(averageRating * 100) / 100, // Round to 2 decimal places
        ratingCount: ratings.length,
        hasRatings: true
      }
    });
  }

  // ========================================
  // DOCUMENT MANAGEMENT (Unified)
  // ========================================

  /**
   * Attach document to content
   */
  async attachDocument(
    contentId: string,
    documentId: string,
    attachedBy: string,
    order: number = 0,
    isMain: boolean = false
  ): Promise<ContentDocument> {
    return await this.prisma.contentDocument.create({
      data: {
        contentId,
        documentId,
        createdBy: attachedBy,
        order,
        isMain
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            type: true
          }
        }
      }
    });
  }

  /**
   * Remove document from content
   */
  async detachDocument(
    contentId: string,
    documentId: string,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    const content = await this.findById(contentId, userId, userRole);
    if (!content) {
      throw new Error('Content not found or access denied');
    }

    await this.prisma.contentDocument.deleteMany({
      where: {
        contentId,
        documentId
      }
    });
  }

  // ========================================
  // SHARING MANAGEMENT (Unified)
  // ========================================

  /**
   * Share content with user
   */
  async shareContent(
    contentId: string,
    sharedBy: string,
    userId: string,
    permissions: {
      canEdit?: boolean;
      canComment?: boolean;
      canShare?: boolean;
    } = {}
  ): Promise<ContentShare> {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!content) {
      throw new Error('Content not found');
    }

    const shareData: any = {
      contentId,
      sharedBy,
      userId
    };

    // Add NOTE-style permissions if it's a NOTE
    if (content.contentType === ContentType.NOTE) {
      shareData.canEdit = permissions.canEdit || false;
      shareData.canComment = permissions.canComment || true;
      shareData.canShare = permissions.canShare || false;
    }

    return await this.prisma.contentShare.create({
      data: shareData,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private prepareContentData(
    data: CreateContentInput,
    userId: string,
    userRole: UserRole
  ) {
    const baseData = {
      title: data.title,
      description: data.description,
      body: data.body,
      contentType: data.contentType,
      visibility: data.visibility || NoteVisibility.PRIVATE,
      familyId: data.familyId,
      categoryId: data.categoryId,
      tags: data.tags || [],
      createdBy: userId,
      hasAssignments: data.hasAssignments || false,
      hasSharing: data.hasSharing || false
    };

    // NOTE-specific setup
    if (data.contentType === ContentType.NOTE) {
      return {
        ...baseData,
        noteType: data.noteType || NoteType.TEXT,
        isPinned: data.isPinned || false,
        allowComments: data.allowComments || false,
        allowEditing: data.allowEditing || false
      };
    }

    // RESOURCE-specific setup
    if (data.contentType === ContentType.RESOURCE) {
      const isAutoApproved = userRole === UserRole.ADMIN;

      return {
        ...baseData,
        resourceType: data.resourceType,
        url: data.url,
        targetAudience: data.targetAudience || [],
        externalMeta: data.externalMeta,
        submittedBy: userId,
        hasCuration: !isAutoApproved, // Auto-approve for ADMIN
        hasRatings: data.hasRatings || true,
        status: isAutoApproved ? ResourceStatus.APPROVED : ResourceStatus.PENDING,
        approvedBy: isAutoApproved ? userId : undefined,
        approvedAt: isAutoApproved ? new Date() : undefined
      };
    }

    return baseData;
  }

  private async validateCreatePermissions(
    data: CreateContentInput,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    // All users can create NOTE content
    if (data.contentType === ContentType.NOTE) {
      return;
    }

    // RESOURCE content creation permissions
    if (data.contentType === ContentType.RESOURCE) {
      if (userRole === UserRole.MEMBER) {
        throw new Error('Members cannot submit resources');
      }
      return;
    }

    throw new Error('Invalid content type');
  }

  private async validateUpdatePermissions(
    content: Content,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    // ADMIN can update anything
    if (userRole === UserRole.ADMIN) {
      return;
    }

    // Creator can update their own content
    if (content.createdBy === userId) {
      return;
    }

    // NOTE: Check if user has edit permissions
    if (content.contentType === ContentType.NOTE && content.allowEditing) {
      const share = await this.prisma.contentShare.findFirst({
        where: {
          contentId: content.id,
          userId,
          canEdit: true
        }
      });
      if (share) {
        return;
      }
    }

    throw new Error('Permission denied to update content');
  }

  private async validateDeletePermissions(
    content: Content,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    // ADMIN can delete anything
    if (userRole === UserRole.ADMIN) {
      return;
    }

    // Creator can delete their own content
    if (content.createdBy === userId) {
      return;
    }

    throw new Error('Permission denied to delete content');
  }

  private async validateAssignmentPermissions(
    assigneeId: string,
    assignerId: string,
    assignerRole: UserRole
  ): Promise<void> {
    // ADMIN can assign to anyone
    if (assignerRole === UserRole.ADMIN) {
      return;
    }

    // VOLUNTEER family-scoped restriction
    if (assignerRole === UserRole.VOLUNTEER) {
      const [assigner, assignee] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: assignerId },
          include: { createdFamilies: true }
        }),
        this.prisma.user.findUnique({
          where: { id: assigneeId }
        })
      ]);

      if (!assigner || !assignee) {
        throw new Error('User not found');
      }

      // Check if assignee is in a family created by this volunteer
      const canAssign = assigner.createdFamilies.some(
        family => family.id === assignee.familyId
      );

      if (!canAssign) {
        throw new Error('VOLUNTEER can only assign tasks to users in families they created');
      }
      return;
    }

    // MEMBER cannot assign tasks
    throw new Error('Permission denied to create assignments');
  }

  private async checkContentAccess(
    content: Content,
    userId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // ADMIN has access to everything
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Creator has access to their content
    if (content.createdBy === userId) {
      return true;
    }

    // Check visibility
    if (content.visibility === NoteVisibility.PUBLIC) {
      return true;
    }

    if (content.visibility === NoteVisibility.FAMILY && content.familyId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      if (user?.familyId === content.familyId) {
        return true;
      }
    }

    if (content.visibility === NoteVisibility.SHARED) {
      const share = await this.prisma.contentShare.findFirst({
        where: {
          contentId: content.id,
          userId
        }
      });
      if (share) {
        return true;
      }
    }

    return false;
  }

  private async buildWhereClause(
    filters: ContentFilters,
    userId: string,
    userRole: UserRole
  ) {
    const where: any = {
      isDeleted: false
    };

    // Content type filter
    if (filters.contentType && filters.contentType.length > 0) {
      where.contentType = { in: filters.contentType };
    }

    // Type-specific filters
    if (filters.noteType && filters.noteType.length > 0) {
      where.noteType = { in: filters.noteType };
    }

    if (filters.resourceType && filters.resourceType.length > 0) {
      where.resourceType = { in: filters.resourceType };
    }

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    // Ownership filters
    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    if (filters.familyId) {
      where.familyId = filters.familyId;
    }

    // Organizational filters
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Healthcare-specific filtering (using regular tags field)
    if (filters.healthcareCategories && filters.healthcareCategories.length > 0) {
      // Import healthcare categories to get their associated tags
      const { HEALTHCARE_CATEGORIES } = await import('@/lib/data/healthcare-tags');

      // Expand healthcare categories into their constituent tags
      const categoryTags: string[] = [];
      for (const categoryName of filters.healthcareCategories) {
        const category = HEALTHCARE_CATEGORIES.find(cat => cat.name === categoryName);
        if (category) {
          categoryTags.push(...category.tags);
        }
      }

      // Healthcare category tags are stored as regular tags
      if (categoryTags.length > 0) {
        where.tags = {
          ...where.tags,
          hasSome: [...(where.tags?.hasSome || []), ...categoryTags]
        };
      }
    }

    if (filters.healthcareTags && filters.healthcareTags.length > 0) {
      // Healthcare tags are also stored as regular tags
      where.tags = {
        ...where.tags,
        hasSome: [...(where.tags?.hasSome || []), ...filters.healthcareTags]
      };
    }

    // Feature flags
    if (filters.hasAssignments !== undefined) {
      where.hasAssignments = filters.hasAssignments;
    }

    if (filters.hasCuration !== undefined) {
      where.hasCuration = filters.hasCuration;
    }

    if (filters.hasRatings !== undefined) {
      where.hasRatings = filters.hasRatings;
    }

    // Resource-specific filters
    if (filters.featured) {
      where.status = ResourceStatus.FEATURED;
    }

    if (filters.verified) {
      where.isVerified = true;
    }

    if (filters.minRating) {
      where.rating = { gte: filters.minRating };
    }

    // Search
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { body: { contains: filters.search, mode: 'insensitive' } },
        { tags: { hasSome: [filters.search] } }
      ];
    }

    // Visibility and access control
    if (userRole !== UserRole.ADMIN) {
      where.OR = [
        { createdBy: userId }, // Own content
        { visibility: NoteVisibility.PUBLIC }, // Public content
        {
          AND: [
            { visibility: NoteVisibility.FAMILY },
            {
              family: {
                members: {
                  some: { id: userId }
                }
              }
            }
          ]
        }, // Family content
        {
          AND: [
            { visibility: NoteVisibility.SHARED },
            {
              shares: {
                some: { userId }
              }
            }
          ]
        } // Shared content
      ];
    }

    return where;
  }

  private buildOrderByClause(filters: ContentFilters) {
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    return { [sortBy]: sortOrder };
  }

  private buildIncludeClause(options: ContentOptions) {
    const include: any = {};

    if (options.includeCreator) {
      include.creator = {
        select: { id: true, firstName: true, lastName: true, email: true }
      };
    }

    if (options.includeFamily) {
      include.family = {
        select: { id: true, name: true }
      };
    }

    if (options.includeCategory) {
      include.category = {
        select: { id: true, name: true, color: true, icon: true }
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
              fileSize: true,
              mimeType: true,
              type: true,
              filePath: true
            }
          }
        },
        orderBy: { order: 'asc' }
      };
    }

    if (options.includeShares) {
      include.shares = {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        }
      };
    }

    if (options.includeAssignments) {
      include.assignments = {
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      };
    }

    if (options.includeStructuredTags) {
      include.structuredTags = {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
              categoryId: true
            }
          }
        }
      };
    }

    if (options.includeRatings) {
      include.ratings = {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      };
    }

    return include;
  }
}

export { ContentRepository };