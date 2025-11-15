import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  NoteAssignment,
  CreateNoteAssignmentInput,
  UpdateNoteAssignmentInput,
  NoteAssignmentFilters,
  PaginatedResult,
  NoteAssignmentStatus,
  AssignmentPriority,
  UserRole,
} from "@/lib/types";

/**
 * Note Assignment Repository - Manages task assignments for notes
 * Handles role-based access control for VOLUNTEER family restrictions
 *
 * Key Features:
 * - VOLUNTEER can only assign to users in families they created
 * - ADMIN has global assignment access
 * - Assignment workflow validation (ASSIGNED → IN_PROGRESS → COMPLETED)
 * - Comprehensive access control and validation
 */
export class NoteAssignmentRepository {
  /**
   * Create assignment with family-based access control
   */
  async createAssignment(
    data: CreateNoteAssignmentInput,
    assignerRole: UserRole
  ): Promise<NoteAssignment> {
    try {
      console.log("📋 Creating assignment:", {
        noteId: data.noteId,
        assignedTo: data.assignedTo,
        assignedBy: data.assignedBy,
        assignerRole,
      });

      // 1. Validate note exists and get family context
      const note = await prisma.note.findUnique({
        where: { id: data.noteId },
        include: {
          creator: { select: { id: true, familyId: true, role: true } },
          family: { select: { id: true, name: true, createdById: true } },
        },
      });

      if (!note) {
        throw new Error("Note not found");
      }

      // 2. Validate assignee exists
      const assignee = await prisma.user.findUnique({
        where: { id: data.assignedTo },
        select: {
          id: true,
          familyId: true,
          role: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (!assignee) {
        throw new Error("Assignee not found");
      }

      // 3. Get assigner details for access control
      const assigner = await prisma.user.findUnique({
        where: { id: data.assignedBy },
        select: { id: true, familyId: true, role: true },
      });

      if (!assigner) {
        throw new Error("Assigner not found");
      }

      // 4. CRITICAL: VOLUNTEER access control validation
      if (assignerRole === UserRole.VOLUNTEER) {
        // VOLUNTEER can only assign tasks to users in families they created
        if (!assignee.familyId) {
          throw new Error("Cannot assign to users without a family");
        }

        const assigneeFamily = await prisma.family.findUnique({
          where: { id: assignee.familyId },
          select: { id: true, createdById: true, name: true },
        });

        if (!assigneeFamily) {
          throw new Error("Assignee's family not found");
        }

        if (assigneeFamily.createdById !== data.assignedBy) {
          throw new Error(
            "VOLUNTEER can only assign tasks to users in families they created"
          );
        }

        console.log("✅ VOLUNTEER family access validated:", {
          volunteerId: data.assignedBy,
          familyId: assignee.familyId,
          familyCreator: assigneeFamily.createdById,
        });
      }

      // 5. Check for existing assignment (one per user per note)
      const existingAssignment = await prisma.noteAssignment.findUnique({
        where: {
          noteId_assignedTo: {
            noteId: data.noteId,
            assignedTo: data.assignedTo,
          },
        },
      });

      if (existingAssignment) {
        throw new Error("User is already assigned to this note");
      }

      // 6. Create assignment
      const assignment = await prisma.noteAssignment.create({
        data: {
          noteId: data.noteId,
          assignedTo: data.assignedTo,
          assignedBy: data.assignedBy,
          status: NoteAssignmentStatus.ASSIGNED,
          priority: data.priority || AssignmentPriority.MEDIUM,
          dueDate: data.dueDate,
          notes: data.notes,
        },
        include: {
          note: {
            select: {
              id: true,
              title: true,
              type: true,
              creator: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assigner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      console.log("✅ Assignment created successfully:", {
        assignmentId: assignment.id,
        noteTitle: assignment.note.title,
        assigneeName: `${assignment.assignee.firstName} ${assignment.assignee.lastName}`,
      });

      return this.transformAssignment(assignment);
    } catch (error) {
      console.error("❌ Error creating assignment:", error);
      throw error;
    }
  }

  /**
   * Update assignment status with workflow validation
   */
  async updateAssignment(
    assignmentId: string,
    userId: string,
    data: UpdateNoteAssignmentInput,
    userRole: UserRole
  ): Promise<NoteAssignment> {
    try {
      // 1. Get existing assignment with relations
      const assignment = await prisma.noteAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          assignee: { select: { id: true, familyId: true } },
          note: {
            include: {
              creator: { select: { id: true, familyId: true } },
            },
          },
        },
      });

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      // 2. Access control: who can update assignments?
      const canUpdate = this.canUserUpdateAssignment(
        assignment,
        userId,
        userRole
      );

      if (!canUpdate) {
        throw new Error("Access denied: insufficient permissions to update assignment");
      }

      // 3. VOLUNTEER family validation
      if (userRole === UserRole.VOLUNTEER) {
        await this.validateVolunteerFamilyAccess(userId, assignment.assignee.familyId);
      }

      // 4. Status workflow validation
      if (data.status && data.status !== assignment.status) {
        this.validateStatusTransition(assignment.status, data.status);
      }

      // 5. Update assignment
      const updateData: Prisma.NoteAssignmentUpdateInput = {
        ...(data.status && { status: data.status }),
        ...(data.priority && { priority: data.priority }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status === NoteAssignmentStatus.COMPLETED && {
          completedAt: new Date(),
        }),
        updatedAt: new Date(),
      };

      const updatedAssignment = await prisma.noteAssignment.update({
        where: { id: assignmentId },
        data: updateData,
        include: {
          note: {
            select: { id: true, title: true, type: true },
          },
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      console.log("✅ Assignment updated:", {
        assignmentId,
        oldStatus: assignment.status,
        newStatus: data.status,
        updatedBy: userId,
      });

      return this.transformAssignment(updatedAssignment);
    } catch (error) {
      console.error("❌ Error updating assignment:", error);
      throw error;
    }
  }

  /**
   * Get assignments for user with filtering and pagination
   */
  async getAssignmentsForUser(
    userId: string,
    filters: NoteAssignmentFilters = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<PaginatedResult<NoteAssignment>> {
    try {
      const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;

      // Build where clause
      const where: Prisma.NoteAssignmentWhereInput = {
        assignedTo: userId,
        ...(filters.noteId && { noteId: filters.noteId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.priority && { priority: filters.priority }),
      };

      // Date range filters
      if (filters.dueBefore || filters.dueAfter) {
        where.dueDate = {
          ...(filters.dueBefore && { lte: filters.dueBefore }),
          ...(filters.dueAfter && { gte: filters.dueAfter }),
        };
      }

      // Get total count
      const total = await prisma.noteAssignment.count({ where });

      // Get assignments with relations
      const assignments = await prisma.noteAssignment.findMany({
        where,
        include: {
          note: {
            select: {
              id: true,
              title: true,
              content: true,
              type: true,
              createdAt: true,
              creator: {
                select: { id: true, firstName: true, lastName: true },
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
        orderBy: this.buildOrderBy(sortBy, sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: assignments.map((a) => this.transformAssignment(a)),
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Error fetching user assignments:", error);
      throw error;
    }
  }

  /**
   * Get assignments created by user (for ADMIN/VOLUNTEER dashboard)
   */
  async getAssignmentsCreatedByUser(
    userId: string,
    userRole: UserRole,
    filters: NoteAssignmentFilters = {},
    options: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResult<NoteAssignment>> {
    try {
      const { page = 1, limit = 20 } = options;

      // Build where clause
      const where: Prisma.NoteAssignmentWhereInput = {
        assignedBy: userId,
        ...(filters.status && { status: filters.status }),
        ...(filters.priority && { priority: filters.priority }),
      };

      // VOLUNTEER family restriction
      if (userRole === UserRole.VOLUNTEER) {
        // Only show assignments to users in families created by this volunteer
        const volunteerFamilies = await prisma.family.findMany({
          where: { createdById: userId },
          select: { id: true },
        });

        const familyIds = volunteerFamilies.map((f) => f.id);

        where.assignee = {
          familyId: { in: familyIds },
        };
      }

      const total = await prisma.noteAssignment.count({ where });

      const assignments = await prisma.noteAssignment.findMany({
        where,
        include: {
          note: {
            select: { id: true, title: true, type: true },
          },
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [
          { status: "asc" }, // Active assignments first
          { priority: "desc" }, // High priority first
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: assignments.map((a) => this.transformAssignment(a)),
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Error fetching created assignments:", error);
      throw error;
    }
  }

  /**
   * Delete assignment with access control
   */
  async deleteAssignment(
    assignmentId: string,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    try {
      const assignment = await prisma.noteAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          assignee: { select: { familyId: true } },
        },
      });

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      // Access control: Only assigner or ADMIN can delete
      if (assignment.assignedBy !== userId && userRole !== UserRole.ADMIN) {
        throw new Error("Only the assigner or ADMIN can delete assignments");
      }

      // VOLUNTEER family check
      if (userRole === UserRole.VOLUNTEER) {
        await this.validateVolunteerFamilyAccess(userId, assignment.assignee.familyId);
      }

      await prisma.noteAssignment.delete({
        where: { id: assignmentId },
      });

      console.log("✅ Assignment deleted:", { assignmentId });
    } catch (error) {
      console.error("❌ Error deleting assignment:", error);
      throw error;
    }
  }

  /**
   * Get assignment by ID with access control
   */
  async getAssignmentById(
    id: string,
    userId: string,
    userRole: UserRole
  ): Promise<NoteAssignment | null> {
    try {
      const assignment = await prisma.noteAssignment.findUnique({
        where: { id },
        include: {
          note: {
            select: { id: true, title: true, type: true },
          },
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true, familyId: true },
          },
          assigner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!assignment) {
        return null;
      }

      // Access control check
      const canView = this.canUserViewAssignment(assignment, userId, userRole);
      if (!canView) {
        return null; // Security by obscurity
      }

      return this.transformAssignment(assignment);
    } catch (error) {
      console.error("❌ Error fetching assignment:", error);
      throw error;
    }
  }

  // ====================================
  // PRIVATE HELPER METHODS
  // ====================================

  /**
   * Check if user can view assignment
   */
  private canUserViewAssignment(
    assignment: any,
    userId: string,
    userRole: UserRole
  ): boolean {
    // ADMIN can view all assignments
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // User is assignee or assigner
    if (assignment.assignedTo === userId || assignment.assignedBy === userId) {
      return true;
    }

    // Note creator can view assignments on their notes
    if (assignment.note?.createdBy === userId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can update assignment
   */
  private canUserUpdateAssignment(
    assignment: any,
    userId: string,
    userRole: UserRole
  ): boolean {
    // ADMIN can update all assignments
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Assignee can update status of their own assignments
    if (assignment.assignedTo === userId) {
      return true;
    }

    // Assigner can update their assigned tasks
    if (assignment.assignedBy === userId) {
      return true;
    }

    // Note creator can update assignments on their notes
    if (assignment.note?.createdBy === userId) {
      return true;
    }

    return false;
  }

  /**
   * Validate VOLUNTEER family access
   */
  private async validateVolunteerFamilyAccess(
    volunteerId: string,
    familyId: string | null
  ): Promise<void> {
    if (!familyId) {
      throw new Error("Cannot access users without a family");
    }

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { createdById: true, name: true },
    });

    if (!family) {
      throw new Error("Family not found");
    }

    if (family.createdById !== volunteerId) {
      throw new Error("Access denied: family restriction");
    }
  }

  /**
   * Validate assignment status transition
   */
  private validateStatusTransition(
    currentStatus: NoteAssignmentStatus,
    newStatus: NoteAssignmentStatus
  ): void {
    const validTransitions: Record<NoteAssignmentStatus, NoteAssignmentStatus[]> = {
      [NoteAssignmentStatus.ASSIGNED]: [
        NoteAssignmentStatus.IN_PROGRESS,
        NoteAssignmentStatus.CANCELLED,
      ],
      [NoteAssignmentStatus.IN_PROGRESS]: [
        NoteAssignmentStatus.COMPLETED,
        NoteAssignmentStatus.ASSIGNED,
        NoteAssignmentStatus.CANCELLED,
      ],
      [NoteAssignmentStatus.COMPLETED]: [], // Terminal state
      [NoteAssignmentStatus.CANCELLED]: [], // Terminal state
    };

    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Build order by clause for queries
   */
  private buildOrderBy(
    sortBy: string,
    sortOrder: "asc" | "desc"
  ): Prisma.NoteAssignmentOrderByWithRelationInput[] {
    const orderBy: Prisma.NoteAssignmentOrderByWithRelationInput[] = [];

    // Always put priority assignments first, then sort by requested field
    orderBy.push({ priority: "desc" });

    if (sortBy === "dueDate") {
      orderBy.push({ dueDate: sortOrder });
    } else if (sortBy === "status") {
      orderBy.push({ status: sortOrder });
    } else if (sortBy === "priority") {
      // Priority already handled above
    } else {
      // Default to createdAt
      orderBy.push({ createdAt: sortOrder });
    }

    return orderBy;
  }

  /**
   * Transform Prisma assignment to API assignment type
   */
  private transformAssignment(assignment: any): NoteAssignment {
    return {
      id: assignment.id,
      noteId: assignment.noteId,
      assignedTo: assignment.assignedTo,
      assignedBy: assignment.assignedBy,
      status: assignment.status,
      priority: assignment.priority,
      dueDate: assignment.dueDate,
      completedAt: assignment.completedAt,
      notes: assignment.notes,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      note: assignment.note
        ? {
            id: assignment.note.id,
            title: assignment.note.title,
            type: assignment.note.type,
            creator: assignment.note.creator,
          }
        : undefined,
      assignee: assignment.assignee
        ? ({
            id: assignment.assignee.id,
            firstName: assignment.assignee.firstName,
            lastName: assignment.assignee.lastName,
            email: assignment.assignee.email,
            familyId: assignment.assignee.familyId,
          } as any)
        : undefined,
      assigner: assignment.assigner
        ? ({
            id: assignment.assigner.id,
            firstName: assignment.assigner.firstName,
            lastName: assignment.assigner.lastName,
            email: assignment.assigner.email,
          } as any)
        : undefined,
    };
  }
}