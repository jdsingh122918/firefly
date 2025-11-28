import { prisma } from "@/lib/db/prisma";
import {
  TemplateAssignment,
  CreateTemplateAssignmentInput,
  TemplateAssignmentFilters,
  TemplateAssignmentStatus,
  User,
  Resource,
} from "@/lib/types";
import { UserRole } from "@/lib/auth/roles";

export class TemplateAssignmentRepository {
  /**
   * Create template assignments for multiple members
   * Handles volunteer scoping and duplicate prevention
   */
  async createAssignments(
    data: CreateTemplateAssignmentInput,
    assignerRole: UserRole
  ): Promise<{ assigned: number; skipped: number; errors: string[] }> {
    const results = { assigned: 0, skipped: 0, errors: [] as string[] };

    // Validate resource exists and is a system-generated template
    const resource = await prisma.resource.findUnique({
      where: { id: data.resourceId },
      select: { id: true, title: true, isSystemGenerated: true },
    });

    if (!resource) {
      throw new Error("Resource not found");
    }

    if (!resource.isSystemGenerated) {
      throw new Error("Resource is not a system-generated template");
    }

    // For volunteers, filter to only members from their assigned families
    let accessibleMemberIds = data.assigneeIds;
    if (assignerRole === UserRole.VOLUNTEER) {
      const volunteerFamilies = await prisma.volunteerFamilyAssignment.findMany({
        where: { volunteerId: data.assignedBy, isActive: true },
        select: { familyId: true },
      });
      const familyIds = volunteerFamilies.map((vf) => vf.familyId);

      const accessibleMembers = await prisma.user.findMany({
        where: {
          id: { in: data.assigneeIds },
          familyId: { in: familyIds },
          role: UserRole.MEMBER,
        },
        select: { id: true },
      });
      accessibleMemberIds = accessibleMembers.map((m) => m.id);
    }

    // Create assignments using upsert for idempotency
    for (const memberId of accessibleMemberIds) {
      try {
        // Check if assignment already exists
        const existing = await prisma.templateAssignment.findUnique({
          where: {
            resourceId_assigneeId: {
              resourceId: data.resourceId,
              assigneeId: memberId,
            },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Create the template assignment
        await prisma.templateAssignment.create({
          data: {
            resourceId: data.resourceId,
            assigneeId: memberId,
            assignedBy: data.assignedBy,
            notes: data.notes,
            status: "pending",
          },
        });

        // Also create a draft ResourceFormResponse if it doesn't exist
        const existingFormResponse = await prisma.resourceFormResponse.findUnique({
          where: {
            resourceId_userId: {
              resourceId: data.resourceId,
              userId: memberId,
            },
          },
        });

        if (!existingFormResponse) {
          await prisma.resourceFormResponse.create({
            data: {
              resourceId: data.resourceId,
              userId: memberId,
              formData: {}, // Empty draft
            },
          });
        }

        results.assigned++;
      } catch (error) {
        results.errors.push(
          `Failed to assign to ${memberId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return results;
  }

  /**
   * Get a single assignment by ID
   */
  async getById(id: string): Promise<TemplateAssignment | null> {
    const assignment = await prisma.templateAssignment.findUnique({
      where: { id },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            description: true,
            resourceType: true,
            isSystemGenerated: true,
          },
        },
        assignee: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyId: true,
          },
        },
        assigner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return assignment ? this.transformAssignment(assignment) : null;
  }

  /**
   * Get assignments for a specific user (member's pending templates)
   */
  async getAssignmentsForUser(
    userId: string,
    status?: TemplateAssignmentStatus
  ): Promise<TemplateAssignment[]> {
    const assignments = await prisma.templateAssignment.findMany({
      where: {
        assigneeId: userId,
        ...(status && { status }),
      },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            description: true,
            resourceType: true,
            isSystemGenerated: true,
            externalMeta: true,
          },
        },
        assigner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return assignments.map(this.transformAssignment);
  }

  /**
   * Get all assignments for a specific resource/template
   */
  async getAssignmentsForResource(resourceId: string): Promise<TemplateAssignment[]> {
    const assignments = await prisma.templateAssignment.findMany({
      where: { resourceId },
      include: {
        assignee: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyId: true,
            family: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        assigner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return assignments.map(this.transformAssignment);
  }

  /**
   * Get assignments with filters
   */
  async filter(filters: TemplateAssignmentFilters): Promise<TemplateAssignment[]> {
    const assignments = await prisma.templateAssignment.findMany({
      where: {
        ...(filters.resourceId && { resourceId: filters.resourceId }),
        ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
        ...(filters.assignedBy && { assignedBy: filters.assignedBy }),
        ...(filters.status && { status: filters.status }),
      },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            description: true,
            resourceType: true,
            isSystemGenerated: true,
          },
        },
        assignee: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyId: true,
          },
        },
        assigner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return assignments.map(this.transformAssignment);
  }

  /**
   * Update assignment status
   */
  async updateStatus(
    id: string,
    status: TemplateAssignmentStatus,
    additionalData?: { startedAt?: Date; completedAt?: Date }
  ): Promise<TemplateAssignment> {
    const assignment = await prisma.templateAssignment.update({
      where: { id },
      data: {
        status,
        ...(additionalData?.startedAt && { startedAt: additionalData.startedAt }),
        ...(additionalData?.completedAt && { completedAt: additionalData.completedAt }),
      },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            description: true,
            resourceType: true,
            isSystemGenerated: true,
          },
        },
        assignee: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            familyId: true,
          },
        },
        assigner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return this.transformAssignment(assignment);
  }

  /**
   * Mark assignment as started when user opens the form
   */
  async markAsStarted(resourceId: string, userId: string): Promise<TemplateAssignment | null> {
    const assignment = await prisma.templateAssignment.findUnique({
      where: {
        resourceId_assigneeId: { resourceId, assigneeId: userId },
      },
    });

    if (!assignment || assignment.status !== "pending") {
      return null;
    }

    return this.updateStatus(assignment.id, "started", { startedAt: new Date() });
  }

  /**
   * Mark assignment as completed
   */
  async markAsCompleted(resourceId: string, userId: string): Promise<TemplateAssignment | null> {
    const assignment = await prisma.templateAssignment.findUnique({
      where: {
        resourceId_assigneeId: { resourceId, assigneeId: userId },
      },
    });

    if (!assignment) {
      return null;
    }

    return this.updateStatus(assignment.id, "completed", { completedAt: new Date() });
  }

  /**
   * Delete an assignment
   */
  async deleteAssignment(id: string): Promise<void> {
    await prisma.templateAssignment.delete({
      where: { id },
    });
  }

  /**
   * Get count of pending assignments for a user (for dashboard display)
   */
  async getPendingCount(userId: string): Promise<number> {
    return prisma.templateAssignment.count({
      where: {
        assigneeId: userId,
        status: "pending",
      },
    });
  }

  /**
   * Check if an assignment exists
   */
  async hasExistingAssignment(resourceId: string, assigneeId: string): Promise<boolean> {
    const assignment = await prisma.templateAssignment.findUnique({
      where: {
        resourceId_assigneeId: { resourceId, assigneeId },
      },
    });
    return !!assignment;
  }

  /**
   * Get members who can be assigned to a template
   * For Admin: all MEMBER users
   * For Volunteer: only members from their assigned families
   */
  async getAssignableMembers(
    resourceId: string,
    requesterId: string,
    requesterRole: UserRole,
    searchQuery?: string
  ): Promise<{
    members: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      familyId: string | null;
      familyName?: string;
      alreadyAssigned: boolean;
      completedAt?: Date | null;
    }>;
  }> {
    // Get all existing assignments for this resource
    const existingAssignments = await prisma.templateAssignment.findMany({
      where: { resourceId },
      select: { assigneeId: true, completedAt: true },
    });
    const assignmentMap = new Map(
      existingAssignments.map((a) => [a.assigneeId, a])
    );

    // Build the user query based on role
    let familyIds: string[] | undefined;
    if (requesterRole === UserRole.VOLUNTEER) {
      const volunteerFamilies = await prisma.volunteerFamilyAssignment.findMany({
        where: { volunteerId: requesterId, isActive: true },
        select: { familyId: true },
      });
      familyIds = volunteerFamilies.map((vf) => vf.familyId);
    }

    // Build search conditions
    const searchConditions = searchQuery
      ? {
          OR: [
            { firstName: { contains: searchQuery, mode: "insensitive" as const } },
            { lastName: { contains: searchQuery, mode: "insensitive" as const } },
            { email: { contains: searchQuery, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Query members
    const members = await prisma.user.findMany({
      where: {
        role: UserRole.MEMBER,
        ...(familyIds && { familyId: { in: familyIds } }),
        ...searchConditions,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        familyId: true,
        family: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // Format response with assignment status
    return {
      members: members.map((m) => {
        const assignment = assignmentMap.get(m.id);
        return {
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          familyId: m.familyId,
          familyName: m.family?.name,
          alreadyAssigned: !!assignment,
          completedAt: assignment?.completedAt || null,
        };
      }),
    };
  }

  /**
   * Transform Prisma result to TemplateAssignment type
   */
  private transformAssignment(assignment: any): TemplateAssignment {
    return {
      id: assignment.id,
      resourceId: assignment.resourceId,
      assigneeId: assignment.assigneeId,
      assignedBy: assignment.assignedBy,
      assignedAt: assignment.assignedAt,
      status: assignment.status as TemplateAssignmentStatus,
      startedAt: assignment.startedAt || undefined,
      completedAt: assignment.completedAt || undefined,
      notes: assignment.notes || undefined,
      resource: assignment.resource
        ? {
            id: assignment.resource.id,
            title: assignment.resource.title,
            description: assignment.resource.description,
            resourceType: assignment.resource.resourceType,
            visibility: "PUBLIC",
            tags: [],
            attachments: [],
            createdBy: "",
            sharedWith: [],
            hasCuration: false,
            hasRatings: false,
            hasSharing: false,
            isArchived: false,
            isDeleted: false,
            isVerified: false,
            targetAudience: [],
            viewCount: 0,
            downloadCount: 0,
            shareCount: 0,
            ratingCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : undefined,
      assignee: assignment.assignee
        ? {
            id: assignment.assignee.id,
            clerkId: assignment.assignee.clerkId || "",
            email: assignment.assignee.email,
            firstName: assignment.assignee.firstName,
            lastName: assignment.assignee.lastName,
            role: assignment.assignee.role,
            familyId: assignment.assignee.familyId,
            familyRole: null,
            createdById: null,
            phoneNumber: null,
            phoneVerified: false,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : undefined,
      assigner: assignment.assigner
        ? {
            id: assignment.assigner.id,
            clerkId: "",
            email: assignment.assigner.email,
            firstName: assignment.assigner.firstName,
            lastName: assignment.assigner.lastName,
            role: assignment.assigner.role,
            familyId: null,
            familyRole: null,
            createdById: null,
            phoneNumber: null,
            phoneVerified: false,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : undefined,
    };
  }
}
