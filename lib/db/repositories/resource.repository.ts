import {
  PrismaClient,
  Resource,
  ResourceType,
  ResourceStatus,
  ResourceVisibility,
  UserRole,
  ResourceAssignment,
  ResourceDocument,
  ResourceShare,
  ResourceTag,
  ResourceRating,
  ResourceFormResponse,
  AssignmentPriority,
  AssignmentStatus,
} from "@prisma/client";

/**
 * Unified Resource Repository
 *
 * This repository handles all resource operations for the unified Resource system,
 * supporting all types of resources with optional features enabled via feature flags.
 *
 * Key Features:
 * - Assignment System: Complete task management workflow (enabled via hasAssignments)
 * - Curation Workflow: Approval, featuring, rating system (enabled via hasCuration)
 * - Sharing System: Advanced sharing capabilities (enabled via hasSharing)
 * - Rating System: Community ratings and reviews (enabled via hasRatings)
 * - Role-based Access Control: ADMIN/VOLUNTEER/MEMBER permissions
 * - Family-scoped Restrictions: VOLUNTEER can only assign to their families
 */

export interface ResourceFilters {
  resourceType?: ResourceType[];
  status?: ResourceStatus[];
  createdBy?: string;
  familyId?: string;
  visibility?: ResourceVisibility[];
  categoryId?: string;
  tags?: string[];
  healthcareCategories?: string[];
  healthcareTags?: string[];
  search?: string;
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
  featured?: boolean;
  verified?: boolean;
  minRating?: number;
  // Template filtering
  isTemplate?: boolean;
  templateType?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "title" | "viewCount" | "rating";
  sortOrder?: "asc" | "desc";
}

export interface CreateResourceInput {
  title: string;
  description?: string;
  body?: string;
  resourceType: ResourceType;
  visibility?: ResourceVisibility;
  familyId?: string;
  categoryId?: string;
  tags?: string[];
  attachments?: string[];
  createdBy: string;
  sharedWith?: string[];

  // Resource-specific fields
  url?: string;
  targetAudience?: string[];
  externalMeta?: any;
  submittedBy?: string;

  // Approval fields
  approvedBy?: string;
  approvedAt?: Date;

  // Feature flags
  hasAssignments?: boolean;
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;

  // Document attachments
  documentIds?: string[];
}

export interface UpdateResourceInput extends Partial<CreateResourceInput> {
  isArchived?: boolean;
  isDeleted?: boolean;
}

export interface ResourceOptions {
  includeDocuments?: boolean;
  includeShares?: boolean;
  includeAssignments?: boolean;
  includeStructuredTags?: boolean;
  includeRatings?: boolean;
  includeFormResponses?: boolean;
  includeCreator?: boolean;
  includeFamily?: boolean;
  includeCategory?: boolean;
  includeSubmitter?: boolean;
  includeApprover?: boolean;
}

export interface PaginatedResources {
  resources: Resource[];
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

export interface AssignmentFilters {
  status?: AssignmentStatus[];
  priority?: AssignmentPriority[];
  assignedTo?: string;
  assignedBy?: string;
  dueDate?: Date;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "title" | "dueDate" | "priority";
  sortOrder?: "asc" | "desc";
}

export interface AssignmentStats {
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

class ResourceRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create new resource with unified features
   */
  async create(
    data: CreateResourceInput,
    userId: string,
    userRole: UserRole,
  ): Promise<Resource> {
    // Validate user permissions
    await this.validateCreatePermissions(data, userId, userRole);

    // Set defaults based on resource type
    const resourceData = this.prepareResourceData(data, userId, userRole);

    try {
      return await this.prisma.$transaction(async (prisma) => {
        // Create the resource
        const resource = await prisma.resource.create({
          data: resourceData,
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            family: {
              select: { id: true, name: true },
            },
            category: {
              select: { id: true, name: true, color: true },
            },
          },
        });

        // Link documents if provided
        if (data.documentIds && data.documentIds.length > 0) {
          const documentAttachments = data.documentIds.map(
            (documentId, index) => ({
              resourceId: resource.id,
              documentId,
              source: "UPLOAD" as const,
              order: index,
              createdBy: userId,
            }),
          );

          await prisma.resourceDocument.createMany({
            data: documentAttachments,
          });

          // Fetch resource with documents included
          return await prisma.resource.findUniqueOrThrow({
            where: { id: resource.id },
            include: {
              creator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              family: {
                select: { id: true, name: true },
              },
              category: {
                select: { id: true, name: true, color: true },
              },
              documents: {
                include: {
                  document: {
                    select: {
                      id: true,
                      title: true,
                      fileName: true,
                      fileSize: true,
                      mimeType: true,
                      type: true,
                      filePath: true,
                    },
                  },
                },
                orderBy: { order: "asc" },
              },
            },
          });
        }

        return resource;
      });
    } catch (error) {
      throw new Error(`Failed to create resource: ${error}`);
    }
  }

  /**
   * Find content by ID with role-based access control
   */
  async findById(
    id: string,
    userId: string,
    userRole: UserRole,
    options: ResourceOptions = {},
  ): Promise<Resource | null> {
    const include = this.buildIncludeClause(options);

    const content = await this.prisma.resource.findUnique({
      where: { id },
      include,
    });

    if (!content) {
      return null;
    }

    // Check access permissions
    const hasAccess = await this.checkResourceAccess(content, userId, userRole);
    if (!hasAccess) {
      return null;
    }

    return content;
  }

  /**
   * Filter and paginate resources with role-based access
   */
  async filter(
    filters: ResourceFilters,
    userId: string,
    userRole: UserRole,
    options: ResourceOptions = {},
  ): Promise<PaginatedResources> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    const where = await this.buildWhereClause(filters, userId, userRole);
    const orderBy = this.buildOrderByClause(filters);
    const include = this.buildIncludeClause(options);

    const [resources, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        include,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.resource.count({ where }),
    ]);

    return {
      resources,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update resource with permission checks
   */
  async update(
    id: string,
    data: UpdateResourceInput,
    userId: string,
    userRole: UserRole,
  ): Promise<Resource & {
    creator: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
    family: { id: string; name: string } | null;
    submitter: { id: string; firstName: string | null; lastName: string | null; email: string; role: UserRole } | null;
    approver: { id: string; firstName: string | null; lastName: string | null; email: string; role: UserRole } | null;
  }> {
    // Check if content exists and user has permission
    const existingContent = await this.findById(id, userId, userRole);
    if (!existingContent) {
      throw new Error("Content not found or access denied");
    }

    // Validate update permissions
    await this.validateUpdatePermissions(existingContent, userId, userRole);

    // Prepare update data
    const updateData = { ...data };

    try {
      return await this.prisma.resource.update({
        where: { id },
        data: updateData,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          family: {
            select: { id: true, name: true },
          },
          submitter: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to update content: ${error}`);
    }
  }

  /**
   * Soft delete content
   */
  async delete(id: string, userId: string, userRole: UserRole): Promise<void> {
    const content = await this.findById(id, userId, userRole);
    if (!content) {
      throw new Error("Content not found or access denied");
    }

    await this.validateDeletePermissions(content, userId, userRole);

    await this.prisma.resource.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.resource.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });
  }

  // ========================================
  // ASSIGNMENT SYSTEM (NOTE content only)
  // ========================================

  /**
   * Create assignment for NOTE resource
   */
  async createAssignment(
    resourceId: string,
    assignmentData: AssignmentInput,
    assignerId: string,
    assignerRole: UserRole,
  ): Promise<ResourceAssignment> {
    const resource = await this.findById(resourceId, assignerId, assignerRole);
    if (!resource) {
      throw new Error("Resource not found");
    }

    // Validate assignment permissions (VOLUNTEER family-scoped restriction)
    await this.validateAssignmentPermissions(
      assignmentData.assignedTo,
      assignerId,
      assignerRole,
    );

    try {
      const assignment = await this.prisma.resourceAssignment.create({
        data: {
          ...assignmentData,
          resourceId,
          assignedBy: assignerId,
          status: AssignmentStatus.ASSIGNED,
        },
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Update resource to enable assignments flag
      await this.prisma.resource.update({
        where: { id: resourceId },
        data: { hasAssignments: true },
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
    completionNotes?: string,
  ): Promise<ResourceAssignment> {
    const assignment = await this.prisma.resourceAssignment.findUnique({
      where: { id: assignmentId },
      include: { resource: true },
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Validate user can update this assignment
    const canUpdate =
      assignment.assignedTo === userId || assignment.assignedBy === userId;

    if (!canUpdate) {
      throw new Error("Permission denied to update assignment");
    }

    const updateData: any = { status };

    if (status === AssignmentStatus.COMPLETED) {
      updateData.completedAt = new Date();
      updateData.completedBy = userId;
      if (completionNotes) {
        updateData.completionNotes = completionNotes;
      }
    }

    return await this.prisma.resourceAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        resource: {
          select: { id: true, title: true },
        },
      },
    });
  }

  /**
   * Get assignments for user
   */
  async getAssignedTasks(
    userId: string,
    status?: AssignmentStatus[],
  ): Promise<ResourceAssignment[]> {
    const where: any = { assignedTo: userId };

    if (status && status.length > 0) {
      where.status = { in: status };
    }

    return await this.prisma.resourceAssignment.findMany({
      where,
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            resourceType: true,
            family: {
              select: { id: true, name: true },
            },
          },
        },
        assigner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Get assignments for user with pagination and stats
   */
  async getAssignmentsForUser(
    userId: string,
    filters: AssignmentFilters,
  ): Promise<{ assignments: ResourceAssignment[]; stats: AssignmentStats; pagination: PaginationResult }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { assignedTo: userId };

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }
    if (filters.priority && filters.priority.length > 0) {
      where.priority = { in: filters.priority };
    }
    if (filters.dueDate) {
      where.dueDate = { lte: filters.dueDate };
    }
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Build order by
    const orderBy: any = {};
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || "desc";
    } else {
      // Default ordering
      orderBy.priority = "desc";
      orderBy.dueDate = "asc";
      orderBy.createdAt = "desc";
    }

    try {
      // Get assignments with pagination
      const [assignments, totalCount] = await Promise.all([
        this.prisma.resourceAssignment.findMany({
          where,
          skip,
          take: limit,
          include: {
            resource: {
              select: {
                id: true,
                title: true,
                resourceType: true,
                family: {
                  select: { id: true, name: true },
                },
              },
            },
            assigner: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy,
        }),
        this.prisma.resourceAssignment.count({ where }),
      ]);

      // Calculate stats
      const stats = await this.calculateAssignmentStats(userId, "assigned");

      const pagination: PaginationResult = {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };

      return { assignments, stats, pagination };
    } catch (error) {
      throw new Error(`Failed to fetch assignments for user: ${error}`);
    }
  }

  /**
   * Get assignments created by user (with VOLUNTEER family restrictions)
   */
  async getAssignmentsCreatedByUser(
    userId: string,
    userRole: UserRole,
    filters: AssignmentFilters,
  ): Promise<{ assignments: ResourceAssignment[]; stats: AssignmentStats; pagination: PaginationResult }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { assignedBy: userId };

    // VOLUNTEER restriction: only see assignments for families they created
    if (userRole === UserRole.VOLUNTEER) {
      const families = await this.prisma.family.findMany({
        where: { createdById: userId },
        select: { id: true },
      });
      const familyIds = families.map(f => f.id);

      where.resource = {
        familyId: { in: familyIds },
      };
    }

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }
    if (filters.priority && filters.priority.length > 0) {
      where.priority = { in: filters.priority };
    }
    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }
    if (filters.dueDate) {
      where.dueDate = { lte: filters.dueDate };
    }
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Build order by
    const orderBy: any = {};
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || "desc";
    } else {
      // Default ordering
      orderBy.priority = "desc";
      orderBy.dueDate = "asc";
      orderBy.createdAt = "desc";
    }

    try {
      // Get assignments with pagination
      const [assignments, totalCount] = await Promise.all([
        this.prisma.resourceAssignment.findMany({
          where,
          skip,
          take: limit,
          include: {
            resource: {
              select: {
                id: true,
                title: true,
                resourceType: true,
                family: {
                  select: { id: true, name: true },
                },
              },
            },
            assignee: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy,
        }),
        this.prisma.resourceAssignment.count({ where }),
      ]);

      // Calculate stats
      const stats = await this.calculateAssignmentStats(userId, "created");

      const pagination: PaginationResult = {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };

      return { assignments, stats, pagination };
    } catch (error) {
      throw new Error(`Failed to fetch assignments created by user: ${error}`);
    }
  }

  /**
   * Update assignment details
   */
  async updateAssignment(
    assignmentId: string,
    userId: string,
    updateData: Partial<AssignmentInput> & {
      status?: AssignmentStatus;
      completionNotes?: string;
    },
  ): Promise<ResourceAssignment> {
    try {
      const assignment = await this.prisma.resourceAssignment.findUnique({
        where: { id: assignmentId },
        include: { resource: true },
      });

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      // Permission check: User must be assigned to it or be the assigner
      const canUpdate =
        assignment.assignedTo === userId ||
        assignment.assignedBy === userId;

      if (!canUpdate) {
        throw new Error("Permission denied to update assignment");
      }

      // If completing assignment, set completion details
      const updatePayload: any = { ...updateData };
      if (updateData.status === AssignmentStatus.COMPLETED) {
        updatePayload.completedAt = new Date();
        updatePayload.completedBy = userId;
      }

      return await this.prisma.resourceAssignment.update({
        where: { id: assignmentId },
        data: updatePayload,
        include: {
          resource: {
            select: {
              id: true,
              title: true,
              resourceType: true,
              family: {
                select: { id: true, name: true },
              },
            },
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to update assignment: ${error}`);
    }
  }

  /**
   * Delete assignment
   */
  async deleteAssignment(assignmentId: string, userId: string): Promise<void> {
    try {
      const assignment = await this.prisma.resourceAssignment.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      // Permission check: Only the assigner can delete
      if (assignment.assignedBy !== userId) {
        throw new Error("Permission denied to delete assignment");
      }

      await this.prisma.resourceAssignment.delete({
        where: { id: assignmentId },
      });
    } catch (error) {
      throw new Error(`Failed to delete assignment: ${error}`);
    }
  }

  /**
   * Calculate assignment statistics
   */
  private async calculateAssignmentStats(
    userId: string,
    type: "assigned" | "created",
  ): Promise<AssignmentStats> {
    const where: any = type === "assigned"
      ? { assignedTo: userId }
      : { assignedBy: userId };

    try {
      const [assigned, inProgress, completed, overdueCount] = await Promise.all([
        this.prisma.resourceAssignment.count({
          where: { ...where, status: AssignmentStatus.ASSIGNED },
        }),
        this.prisma.resourceAssignment.count({
          where: { ...where, status: AssignmentStatus.IN_PROGRESS },
        }),
        this.prisma.resourceAssignment.count({
          where: { ...where, status: AssignmentStatus.COMPLETED },
        }),
        this.prisma.resourceAssignment.count({
          where: {
            ...where,
            status: { in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS] },
            dueDate: { lt: new Date() },
          },
        }),
      ]);

      return {
        assigned,
        inProgress,
        completed,
        overdue: overdueCount,
      };
    } catch (error) {
      throw new Error(`Failed to calculate assignment stats: ${error}`);
    }
  }

  // ========================================
  // TEMPLATE WORKFLOW METHODS
  // ========================================

  /**
   * Start working with a template - creates auto-assignment and returns template info
   * This implements the hybrid workflow: auto-assignment + form responses
   */
  async startWorkingWithTemplate(
    templateId: string,
    userId: string,
    userRole: UserRole
  ): Promise<{
    template: Resource;
    assignment: ResourceAssignment;
    existingFormResponse?: ResourceFormResponse;
  }> {
    // Verify template exists and is actually a template
    const template = await this.findById(templateId, userId, userRole);
    if (!template) {
      throw new Error("Template not found or access denied");
    }

    // Verify this is actually a template
    const externalMeta = template.externalMeta as any;
    const isTemplate = externalMeta?.isTemplate === true ||
      (template.visibility === ResourceVisibility.PUBLIC &&
       template.hasAssignments &&
       template.status === ResourceStatus.APPROVED &&
       template.tags.includes("advance-directives"));

    if (!isTemplate) {
      throw new Error("Resource is not a template");
    }

    try {
      return await this.prisma.$transaction(async (prisma) => {
        // Check if user already has an assignment for this template
        let existingAssignment = await prisma.resourceAssignment.findFirst({
          where: {
            resourceId: templateId,
            assignedTo: userId,
            status: { in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS] }
          }
        });

        // Create assignment if one doesn't exist
        if (!existingAssignment) {
          existingAssignment = await prisma.resourceAssignment.create({
            data: {
              resourceId: templateId,
              title: `Complete ${template.title}`,
              description: `Work on advance directive template: ${template.title}`,
              assignedTo: userId,
              assignedBy: userId, // Self-assigned when starting template
              status: AssignmentStatus.IN_PROGRESS,
              priority: AssignmentPriority.MEDIUM,
              tags: ["advance-directives", "template", "self-assigned"]
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
        } else {
          // Update existing assignment to IN_PROGRESS if it was just ASSIGNED
          if (existingAssignment.status === AssignmentStatus.ASSIGNED) {
            existingAssignment = await prisma.resourceAssignment.update({
              where: { id: existingAssignment.id },
              data: { status: AssignmentStatus.IN_PROGRESS },
              include: {
                assignee: {
                  select: { id: true, firstName: true, lastName: true, email: true }
                },
                assigner: {
                  select: { id: true, firstName: true, lastName: true, email: true }
                }
              }
            });
          }
        }

        // Check for existing form response
        const existingFormResponse = await prisma.resourceFormResponse.findUnique({
          where: {
            resourceId_userId: {
              resourceId: templateId,
              userId: userId
            }
          }
        });

        // Increment view count for template
        await prisma.resource.update({
          where: { id: templateId },
          data: { viewCount: { increment: 1 } }
        });

        return {
          template,
          assignment: existingAssignment,
          existingFormResponse: existingFormResponse || undefined
        };
      });
    } catch (error) {
      throw new Error(`Failed to start working with template: ${error}`);
    }
  }

  /**
   * Get all advance directive templates available to user
   */
  async getAdvanceDirectiveTemplates(
    userId: string,
    userRole: UserRole,
    options?: {
      includeCreator?: boolean;
      includeFormResponses?: boolean;
      includeAssignments?: boolean;
    }
  ): Promise<Resource[]> {
    try {
      const include: any = {};

      if (options?.includeCreator) {
        include.creator = {
          select: { id: true, firstName: true, lastName: true, email: true }
        };
      }

      if (options?.includeFormResponses) {
        include.formResponses = {
          where: { userId },
          select: {
            id: true,
            formData: true,
            completedAt: true,
            updatedAt: true
          }
        };
      }

      if (options?.includeAssignments) {
        include.assignments = {
          where: { assignedTo: userId },
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true
          }
        };
      }

      return await this.prisma.resource.findMany({
        where: {
          AND: [
            { isDeleted: false },
            {
              OR: [
                // Note: JSON path filtering not supported, will rely on hasAssignments filter instead
                {
                  AND: [
                    { visibility: ResourceVisibility.PUBLIC },
                    { hasAssignments: true },
                    { tags: { hasSome: ["advance-directives"] } },
                    { status: ResourceStatus.APPROVED }
                  ]
                }
              ]
            }
          ]
        },
        include,
        orderBy: [
          { title: "asc" }
        ]
      });
    } catch (error) {
      throw new Error(`Failed to get advance directive templates: ${error}`);
    }
  }

  /**
   * Complete template assignment and mark form as completed
   */
  async completeTemplateAssignment(
    templateId: string,
    userId: string,
    userRole: UserRole,
    completionNotes?: string
  ): Promise<{ assignment: ResourceAssignment; formResponse?: ResourceFormResponse }> {
    try {
      return await this.prisma.$transaction(async (prisma) => {
        // Find the assignment
        const assignment = await prisma.resourceAssignment.findFirst({
          where: {
            resourceId: templateId,
            assignedTo: userId,
            status: { in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS] }
          }
        });

        if (!assignment) {
          throw new Error("No active assignment found for this template");
        }

        // Update assignment to completed
        const completedAssignment = await prisma.resourceAssignment.update({
          where: { id: assignment.id },
          data: {
            status: AssignmentStatus.COMPLETED,
            completedAt: new Date(),
            completedBy: userId,
            completionNotes: completionNotes || "Template form completed"
          },
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true, email: true }
            },
            resource: {
              select: { id: true, title: true }
            }
          }
        });

        // Update form response to mark as completed
        const formResponse = await prisma.resourceFormResponse.findUnique({
          where: {
            resourceId_userId: {
              resourceId: templateId,
              userId: userId
            }
          }
        });

        let updatedFormResponse;
        if (formResponse) {
          updatedFormResponse = await prisma.resourceFormResponse.update({
            where: { id: formResponse.id },
            data: { completedAt: new Date() }
          });
        }

        return {
          assignment: completedAssignment,
          formResponse: updatedFormResponse
        };
      });
    } catch (error) {
      throw new Error(`Failed to complete template assignment: ${error}`);
    }
  }

  // ========================================
  // CURATION SYSTEM (RESOURCE content only)
  // ========================================

  /**
   * Get resources awaiting curation (RESOURCE only)
   */
  async getCurationQueue(
    adminId: string,
    adminRole: UserRole,
  ): Promise<Resource[]> {
    if (adminRole !== UserRole.ADMIN) {
      throw new Error("Only admins can access curation queue");
    }

    return await this.prisma.resource.findMany({
      where: {
        status: ResourceStatus.PENDING,
        hasCuration: true,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        family: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Approve resource content
   */
  async approveContent(
    resourceId: string,
    approverId: string,
    approverRole: UserRole,
  ): Promise<Resource> {
    if (approverRole !== UserRole.ADMIN) {
      throw new Error("Only admins can approve content");
    }

    const resource = await this.findById(resourceId, approverId, approverRole);
    if (!resource) {
      throw new Error("Resource not found");
    }

    return await this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        status: ResourceStatus.APPROVED,
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Feature resource content
   */
  async featureContent(
    resourceId: string,
    featurerId: string,
    featurerRole: UserRole,
  ): Promise<Resource> {
    if (featurerRole !== UserRole.ADMIN) {
      throw new Error("Only admins can feature content");
    }

    const resource = await this.findById(resourceId, featurerId, featurerRole);
    if (!resource) {
      throw new Error("Resource not found");
    }

    return await this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        status: ResourceStatus.FEATURED,
        featuredBy: featurerId,
        featuredAt: new Date(),
      },
    });
  }

  // ========================================
  // RATING SYSTEM (RESOURCE content only)
  // ========================================

  /**
   * Add or update rating for RESOURCE content
   */
  async rateContent(
    resourceId: string,
    userId: string,
    rating: number,
    review?: string,
    isHelpful?: boolean,
  ): Promise<{ resourceRating: ResourceRating; newRating: number; success: boolean }> {
    const content = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!content) {
      throw new Error("Resource not found");
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    try {
      // Use transaction to ensure atomicity between rating upsert and recalculation
      return await this.prisma.$transaction(async (tx) => {
        // Upsert rating
        const resourceRating = await tx.resourceRating.upsert({
          where: {
            resourceId_userId: {
              resourceId: resourceId,
              userId,
            },
          },
          create: {
            resourceId: resourceId,
            userId,
            rating,
            review,
            isHelpful,
          },
          update: {
            rating,
            review,
            isHelpful,
            updatedAt: new Date(),
          },
        });

        // Recalculate average rating within the same transaction
        await this.recalculateRating(resourceId, tx);

        // Get the updated resource to return the new average rating
        const updatedResource = await tx.resource.findUnique({
          where: { id: resourceId },
          select: { rating: true },
        });

        return {
          resourceRating,
          newRating: updatedResource?.rating || 0,
          success: true,
        };
      });
    } catch (error) {
      throw new Error(`Failed to rate content: ${error}`);
    }
  }

  /**
   * Recalculate average rating for content
   */
  private async recalculateRating(resourceId: string, tx?: any): Promise<void> {
    const client = tx || this.prisma;

    const ratings = await client.resourceRating.findMany({
      where: { resourceId: resourceId },
    });

    if (ratings.length === 0) {
      await client.resource.update({
        where: { id: resourceId },
        data: {
          rating: null,
          ratingCount: 0,
        },
      });
      return;
    }

    const totalRating = ratings.reduce(
      (sum: number, r: any) => sum + r.rating,
      0,
    );
    const averageRating = totalRating / ratings.length;

    await client.resource.update({
      where: { id: resourceId },
      data: {
        rating: Math.round(averageRating * 100) / 100, // Round to 2 decimal places
        ratingCount: ratings.length,
        hasRatings: true,
      },
    });
  }

  // ========================================
  // DOCUMENT MANAGEMENT (Unified)
  // ========================================

  /**
   * Attach document to resource
   */
  async attachDocument(
    resourceId: string,
    documentId: string,
    attachedBy: string,
    order: number = 0,
    isMain: boolean = false,
  ): Promise<ResourceDocument> {
    return await this.prisma.resourceDocument.create({
      data: {
        resourceId,
        documentId,
        createdBy: attachedBy,
        order,
        isMain,
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            type: true,
          },
        },
      },
    });
  }

  /**
   * Remove document from resource
   */
  async detachDocument(
    resourceId: string,
    documentId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    const resource = await this.findById(resourceId, userId, userRole);
    if (!resource) {
      throw new Error("Resource not found or access denied");
    }

    await this.prisma.resourceDocument.deleteMany({
      where: {
        resourceId,
        documentId,
      },
    });
  }

  // ========================================
  // SHARING MANAGEMENT (Unified)
  // ========================================

  /**
   * Share resource with user
   */
  async shareContent(
    resourceId: string,
    sharedBy: string,
    userId: string,
    permissions: {
      canEdit?: boolean;
      canComment?: boolean;
      canShare?: boolean;
    } = {},
  ): Promise<ResourceShare> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new Error("Resource not found");
    }

    const shareData: any = {
      resourceId,
      sharedBy,
      userId,
    };

    // TODO: Implement permission levels for different resource types if needed
    // For now, sharing gives basic access to the resource

    return await this.prisma.resourceShare.create({
      data: shareData,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private prepareResourceData(
    data: CreateResourceInput,
    userId: string,
    userRole: UserRole,
  ) {
    const baseData = {
      title: data.title,
      description: data.description,
      body: data.body,
      resourceType: data.resourceType,
      visibility: data.visibility || ResourceVisibility.PRIVATE,
      familyId: data.familyId,
      categoryId: data.categoryId,
      tags: data.tags || [],
      createdBy: userId,
      hasAssignments: data.hasAssignments || false,
      hasSharing: data.hasSharing || false,
    };

    // Unified resource setup - auto-approve for ADMIN users
    const isAutoApproved = userRole === UserRole.ADMIN;

    return {
      ...baseData,
      url: data.url,
      targetAudience: data.targetAudience || [],
      externalMeta: data.externalMeta,
      submittedBy: userId,
      hasCuration: data.hasCuration !== undefined ? data.hasCuration : !isAutoApproved,
      hasRatings: data.hasRatings !== undefined ? data.hasRatings : true,
      status: isAutoApproved
        ? ResourceStatus.APPROVED
        : ResourceStatus.PENDING,
      approvedBy: isAutoApproved ? userId : undefined,
      approvedAt: isAutoApproved ? new Date() : undefined,
    };
  }

  private async validateCreatePermissions(
    data: CreateResourceInput,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    // All users can create resources
    // Members' resources require curation by default (unless explicitly disabled)
    if (userRole === UserRole.MEMBER && data.hasCuration === undefined) {
      data.hasCuration = true;
    }
  }

  private async validateUpdatePermissions(
    resource: Resource,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    // ADMIN can update anything
    if (userRole === UserRole.ADMIN) {
      return;
    }

    // Creator can update their own resource
    if (resource.createdBy === userId) {
      return;
    }

    // Check if user has edit permissions through sharing
    const share = await this.prisma.resourceShare.findFirst({
      where: {
        resourceId: resource.id,
        userId,
      },
    });
    if (share) {
      // If resource is shared with the user, they can edit it
      return;
    }

    throw new Error("Permission denied to update resource");
  }

  private async validateDeletePermissions(
    resource: Resource,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    // ADMIN can delete anything
    if (userRole === UserRole.ADMIN) {
      return;
    }

    // Creator can delete their own resource
    if (resource.createdBy === userId) {
      return;
    }

    throw new Error("Permission denied to delete resource");
  }

  private async validateAssignmentPermissions(
    assigneeId: string,
    assignerId: string,
    assignerRole: UserRole,
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
          include: { createdFamilies: true },
        }),
        this.prisma.user.findUnique({
          where: { id: assigneeId },
        }),
      ]);

      if (!assigner || !assignee) {
        throw new Error("User not found");
      }

      // Check if assignee is in a family created by this volunteer
      const canAssign = assigner.createdFamilies.some(
        (family) => family.id === assignee.familyId,
      );

      if (!canAssign) {
        throw new Error(
          "VOLUNTEER can only assign tasks to users in families they created",
        );
      }
      return;
    }

    // MEMBER cannot assign tasks
    throw new Error("Permission denied to create assignments");
  }

  private async checkResourceAccess(
    resource: Resource,
    userId: string,
    userRole: UserRole,
  ): Promise<boolean> {
    // ADMIN has access to everything
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Creator has access to their resource
    if (resource.createdBy === userId) {
      return true;
    }

    // Check visibility
    if (resource.visibility === ResourceVisibility.PUBLIC) {
      return true;
    }

    if (resource.visibility === ResourceVisibility.FAMILY && resource.familyId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.familyId === resource.familyId) {
        return true;
      }
    }

    if (resource.visibility === ResourceVisibility.SHARED) {
      const share = await this.prisma.resourceShare.findFirst({
        where: {
          resourceId: resource.id,
          userId,
        },
      });
      if (share) {
        return true;
      }
    }

    return false;
  }

  private async buildWhereClause(
    filters: ResourceFilters,
    userId: string,
    userRole: UserRole,
  ) {
    const where: any = {
      isDeleted: false,
    };

    // Resource type filter
    if (filters.resourceType && filters.resourceType.length > 0) {
      where.resourceType = { in: filters.resourceType };
    }

    // Additional resource type filters (removed duplicate resourceType filter)

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
    if (
      filters.healthcareCategories &&
      filters.healthcareCategories.length > 0
    ) {
      // Import healthcare categories to get their associated tags
      const { HEALTHCARE_CATEGORIES } = await import(
        "@/lib/data/healthcare-tags"
      );

      // Expand healthcare categories into their constituent tags
      const categoryTags: string[] = [];
      for (const categoryName of filters.healthcareCategories) {
        const category = HEALTHCARE_CATEGORIES.find(
          (cat) => cat.name === categoryName,
        );
        if (category) {
          categoryTags.push(...category.tags);
        }
      }

      // Healthcare category tags are stored as regular tags
      if (categoryTags.length > 0) {
        where.tags = {
          ...where.tags,
          hasSome: [...(where.tags?.hasSome || []), ...categoryTags],
        };
      }
    }

    if (filters.healthcareTags && filters.healthcareTags.length > 0) {
      // Healthcare tags are also stored as regular tags
      where.tags = {
        ...where.tags,
        hasSome: [...(where.tags?.hasSome || []), ...filters.healthcareTags],
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

    // Template filtering
    if (filters.isTemplate !== undefined) {
      if (filters.isTemplate) {
        // Filter for templates: resources with isTemplate metadata and specific characteristics
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              {
                externalMeta: {
                  path: ["isTemplate"],
                  equals: true
                }
              },
              {
                AND: [
                  { visibility: ResourceVisibility.PUBLIC },
                  { hasAssignments: true },
                  { tags: { hasSome: ["advance-directives"] } },
                  { status: ResourceStatus.APPROVED }
                ]
              }
            ]
          }
        ];
      } else {
        // Filter for non-templates
        where.AND = [
          ...(where.AND || []),
          {
            NOT: {
              externalMeta: {
                path: ["isTemplate"],
                equals: true
              }
            }
          }
        ];
      }
    }

    if (filters.templateType) {
      // Filter by specific template type (e.g., "advance-directive")
      where.externalMeta = {
        path: ["templateType"],
        equals: filters.templateType
      };
    }

    // Search
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { body: { contains: filters.search, mode: "insensitive" } },
        { tags: { hasSome: [filters.search] } },
      ];
    }

    // Visibility and access control
    if (userRole !== UserRole.ADMIN) {
      where.OR = [
        { createdBy: userId }, // Own content
        { visibility: ResourceVisibility.PUBLIC }, // Public content
        {
          AND: [
            { visibility: ResourceVisibility.FAMILY },
            {
              family: {
                members: {
                  some: { id: userId },
                },
              },
            },
          ],
        }, // Family content
        {
          AND: [
            { visibility: ResourceVisibility.SHARED },
            {
              shares: {
                some: { userId },
              },
            },
          ],
        }, // Shared content
      ];
    }

    return where;
  }

  private buildOrderByClause(filters: ResourceFilters) {
    const sortBy = filters.sortBy || "createdAt";
    const sortOrder = filters.sortOrder || "desc";

    return { [sortBy]: sortOrder };
  }

  private buildIncludeClause(options: ResourceOptions) {
    const include: any = {};

    if (options.includeCreator) {
      include.creator = {
        select: { id: true, firstName: true, lastName: true, email: true },
      };
    }

    if (options.includeFamily) {
      include.family = {
        select: { id: true, name: true },
      };
    }

    if (options.includeCategory) {
      include.category = {
        select: { id: true, name: true, color: true, icon: true },
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
              filePath: true,
            },
          },
        },
        orderBy: { order: "asc" },
      };
    }

    if (options.includeShares) {
      include.shares = {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      };
    }

    if (options.includeAssignments) {
      include.assignments = {
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
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
              categoryId: true,
            },
          },
        },
      };
    }

    if (options.includeRatings) {
      include.ratings = {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      };
    }

    if (options.includeSubmitter) {
      include.submitter = {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      };
    }

    if (options.includeApprover) {
      include.approver = {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      };
    }

    return include;
  }

  /**
   * Form Response Management Methods
   * Handles interactive form data for advance directive and assessment content
   */

  /**
   * Save or update form response for content
   */
  async saveFormResponse(
    resourceId: string,
    userId: string,
    formData: any,
    isComplete: boolean = false,
  ) {
    try {
      const data = {
        resourceId: resourceId,
        userId,
        formData,
        completedAt: isComplete ? new Date() : null,
        updatedAt: new Date(),
      };

      // Use upsert to handle both create and update
      const response = await this.prisma.resourceFormResponse.upsert({
        where: {
          resourceId_userId: {
            resourceId: resourceId,
            userId,
          },
        },
        create: data,
        update: data,
        include: {
          resource: {
            select: {
              id: true,
              title: true,
              hasAssignments: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Update assignment completion if form is complete and resource has assignments
      if (isComplete && response.resource.hasAssignments) {
        await this.updateAssignmentCompletionFromForm(resourceId, userId);
      }

      return response;
    } catch (error) {
      console.error("Error saving form response:", error);
      throw new Error(
        `Failed to save form response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get form response for specific user and content
   */
  async getFormResponse(resourceId: string, userId: string) {
    try {
      return await this.prisma.resourceFormResponse.findUnique({
        where: {
          resourceId_userId: {
            resourceId: resourceId,
            userId,
          },
        },
        include: {
          resource: {
            select: {
              id: true,
              title: true,
              description: true,
              hasAssignments: true,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error fetching form response:", error);
      throw new Error(
        `Failed to fetch form response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get all form responses for a specific content (admin/volunteer view)
   */
  async getContentFormResponses(
    resourceId: string,
    userRole: UserRole,
    requesterId: string,
    options: {
      completed?: boolean;
      includeUser?: boolean;
    } = {},
  ) {
    try {
      // Build where clause with role-based filtering
      const where: any = { resourceId };

      if (options.completed !== undefined) {
        where.completedAt = options.completed ? { not: null } : null;
      }

      // VOLUNTEER role restriction: only see responses from families they created
      if (userRole === UserRole.VOLUNTEER) {
        const familyIds = await this.getUserCreatedFamilyIds(requesterId);
        where.user = {
          familyId: { in: familyIds },
        };
      }

      return await this.prisma.resourceFormResponse.findMany({
        where,
        include: {
          user: options.includeUser
            ? {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  familyId: true,
                },
              }
            : false,
          resource: {
            select: {
              id: true,
              title: true,
              description: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    } catch (error) {
      console.error("Error fetching content form responses:", error);
      throw new Error(
        `Failed to fetch content form responses: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get user's form responses (member view)
   */
  async getUserFormResponses(
    userId: string,
    options: {
      completed?: boolean;
      resourceType?: ResourceType[];
      tags?: string[];
    } = {},
  ) {
    try {
      const where: any = { userId };

      if (options.completed !== undefined) {
        where.completedAt = options.completed ? { not: null } : null;
      }

      // Filter by resource type or tags if specified
      if (options.resourceType?.length || options.tags?.length) {
        where.resource = {};

        if (options.resourceType?.length) {
          where.resource.resourceType = { in: options.resourceType };
        }

        if (options.tags?.length) {
          where.resource.tags = { hasSome: options.tags };
        }
      }

      return await this.prisma.resourceFormResponse.findMany({
        where,
        include: {
          resource: {
            select: {
              id: true,
              title: true,
              description: true,
              resourceType: true,
              tags: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    } catch (error) {
      console.error("Error fetching user form responses:", error);
      throw new Error(
        `Failed to fetch user form responses: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete form response
   */
  async deleteFormResponse(resourceId: string, userId: string) {
    try {
      return await this.prisma.resourceFormResponse.delete({
        where: {
          resourceId_userId: {
            resourceId: resourceId,
            userId,
          },
        },
      });
    } catch (error) {
      console.error("Error deleting form response:", error);
      throw new Error(
        `Failed to delete form response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get form completion statistics for content
   */
  async getFormCompletionStats(
    resourceId: string,
    userRole: UserRole,
    requesterId: string,
  ) {
    try {
      let whereClause: any = { resourceId };

      // VOLUNTEER role restriction
      if (userRole === UserRole.VOLUNTEER) {
        const familyIds = await this.getUserCreatedFamilyIds(requesterId);
        whereClause.user = {
          familyId: { in: familyIds },
        };
      }

      const [total, completed, inProgress] = await Promise.all([
        this.prisma.resourceFormResponse.count({ where: whereClause }),
        this.prisma.resourceFormResponse.count({
          where: { ...whereClause, completedAt: { not: null } },
        }),
        this.prisma.resourceFormResponse.count({
          where: { ...whereClause, completedAt: null },
        }),
      ]);

      return {
        total,
        completed,
        inProgress,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    } catch (error) {
      console.error("Error fetching form completion stats:", error);
      throw new Error(
        `Failed to fetch form completion stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get family IDs created by a volunteer user
   * Private helper method for volunteer family-scoped restrictions
   */
  private async getUserCreatedFamilyIds(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdFamilies: {
          select: { id: true },
        },
      },
    });

    return user?.createdFamilies.map((family) => family.id) || [];
  }

  /**
   * Auto-complete assignment when form is completed
   * Private helper method
   */
  private async updateAssignmentCompletionFromForm(
    resourceId: string,
    userId: string,
  ) {
    try {
      // Find active assignment for this content and user
      const assignment = await this.prisma.resourceAssignment.findFirst({
        where: {
          resourceId: resourceId,
          assignedTo: userId,
          status: {
            in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS],
          },
        },
      });

      if (assignment) {
        await this.prisma.resourceAssignment.update({
          where: { id: assignment.id },
          data: {
            status: AssignmentStatus.COMPLETED,
            completedAt: new Date(),
            completedBy: userId,
            completionNotes: "Form completed automatically",
          },
        });
      }
    } catch (error) {
      console.error("Error updating assignment completion:", error);
      // Don't throw error here - form save should succeed even if assignment update fails
    }
  }

  /**
   * Get content with form completion status for user
   */
  async getContentWithFormStatus(
    resourceId: string,
    userId: string,
    userRole: UserRole,
    requesterId?: string,
  ) {
    try {
      // Get content with basic info
      const content = await this.findById(resourceId, userId, userRole);

      if (!content) {
        throw new Error("Content not found");
      }

      // Get form response if exists
      const formResponse = await this.getFormResponse(resourceId, userId);

      return {
        ...content,
        formResponse: formResponse
          ? {
              id: formResponse.id,
              formData: formResponse.formData,
              completedAt: formResponse.completedAt,
              updatedAt: formResponse.updatedAt,
              isComplete: Boolean(formResponse.completedAt),
            }
          : null,
        hasFormResponse: Boolean(formResponse),
        isFormComplete: Boolean(formResponse?.completedAt),
      };
    } catch (error) {
      console.error("Error fetching content with form status:", error);
      throw new Error(
        `Failed to fetch content with form status: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export { ResourceRepository };
