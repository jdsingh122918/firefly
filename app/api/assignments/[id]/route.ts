import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NoteAssignmentRepository } from "@/lib/db/repositories/note-assignment.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NoteAssignmentStatus, AssignmentPriority, UserRole } from "@/lib/types";

const assignmentRepo = new NoteAssignmentRepository();
const userRepo = new UserRepository();
const notificationRepo = new NotificationRepository();

// Validation schema for updating assignments
const updateAssignmentSchema = z.object({
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

/**
 * GET /api/assignments/[id] - Get assignment details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("📋 GET /api/assignments/[id]");

    // 1. Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user details
    const user = await userRepo.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Extract assignmentId
    const { id: assignmentId } = await params;

    // 4. Get assignment with access control
    const assignment = await assignmentRepo.getAssignmentById(assignmentId, user.id, user.role);

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    console.log("✅ Found assignment:", {
      assignmentId,
      noteTitle: assignment.note?.title,
      status: assignment.status,
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("❌ Error fetching assignment:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("access denied")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch assignment" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/assignments/[id] - Update assignment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("📋 PATCH /api/assignments/[id]");

    // 1. Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user details
    const user = await userRepo.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Extract assignmentId
    const { id: assignmentId } = await params;

    // 4. Parse and validate request body
    const body = await request.json();
    const validatedData = updateAssignmentSchema.parse(body);

    console.log("✅ Updating assignment:", {
      assignmentId,
      updates: validatedData,
      updatedBy: user.id,
    });

    // 5. Get current assignment for notification context
    const currentAssignment = await assignmentRepo.getAssignmentById(assignmentId, user.id, user.role);
    if (!currentAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // 6. Update assignment through repository (handles access control and workflow validation)
    const updatedAssignment = await assignmentRepo.updateAssignment(
      assignmentId,
      user.id,
      validatedData,
      user.role
    );

    // 7. Send status change notification if status changed (async, non-blocking)
    if (validatedData.status && validatedData.status !== currentAssignment.status) {
      createStatusChangeNotification(
        updatedAssignment,
        currentAssignment.status,
        validatedData.status,
        user.id
      ).catch((error) => {
        console.error("❌ Failed to send status change notification:", error);
        // Don't fail the request if notification fails
      });
    }

    console.log("✅ Assignment updated successfully:", {
      assignmentId,
      oldStatus: currentAssignment.status,
      newStatus: validatedData.status,
    });

    return NextResponse.json({
      success: true,
      assignment: updatedAssignment,
      message: "Assignment updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating assignment:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // Handle domain-specific errors
    if (error instanceof Error) {
      // Access control errors
      if (error.message.includes("access denied") || error.message.includes("insufficient permissions")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      // Not found errors
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      // Workflow validation errors
      if (error.message.includes("Invalid status transition")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Other business logic errors
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Generic server error
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assignments/[id] - Delete assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("📋 DELETE /api/assignments/[id]");

    // 1. Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user details
    const user = await userRepo.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Extract assignmentId
    const { id: assignmentId } = await params;

    // 4. Get assignment for notification context
    const assignment = await assignmentRepo.getAssignmentById(assignmentId, user.id, user.role);
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    console.log("✅ Deleting assignment:", {
      assignmentId,
      noteTitle: assignment.note?.title,
      deletedBy: user.id,
    });

    // 5. Delete assignment through repository (handles access control)
    await assignmentRepo.deleteAssignment(assignmentId, user.id, user.role);

    // 6. Send deletion notification (async, non-blocking)
    createDeletionNotification(assignment, user.id).catch((error) => {
      console.error("❌ Failed to send deletion notification:", error);
      // Don't fail the request if notification fails
    });

    console.log("✅ Assignment deleted successfully:", assignmentId);

    return NextResponse.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting assignment:", error);

    if (error instanceof Error) {
      // Access control errors
      if (error.message.includes("access denied") || error.message.includes("Only the assigner")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      // Not found errors
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      // Other business logic errors
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Create notification for status change (async)
 */
async function createStatusChangeNotification(
  assignment: any,
  oldStatus: NoteAssignmentStatus,
  newStatus: NoteAssignmentStatus,
  changedBy: string
): Promise<void> {
  try {
    // Determine who to notify
    const notifyUserIds: string[] = [];

    // Notify assignee if changed by someone else
    if (assignment.assignedTo !== changedBy) {
      notifyUserIds.push(assignment.assignedTo);
    }

    // Notify assigner if changed by assignee
    if (assignment.assignedBy !== changedBy && assignment.assignedBy !== assignment.assignedTo) {
      notifyUserIds.push(assignment.assignedBy);
    }

    // Get changer details
    const changer = await userRepo.getUserById(changedBy);
    if (!changer) return;

    // Create notifications
    for (const userId of notifyUserIds) {
      const message = newStatus === NoteAssignmentStatus.COMPLETED
        ? `${changer.firstName || changer.email} completed the task: ${assignment.note?.title}`
        : `${changer.firstName || changer.email} changed task status from ${oldStatus} to ${newStatus}: ${assignment.note?.title}`;

      await notificationRepo.createNotification({
        userId,
        type: "FAMILY_ACTIVITY",
        title: "Task Status Updated",
        message,
        data: {
          assignmentId: assignment.id,
          noteId: assignment.noteId,
          oldStatus,
          newStatus,
          changedBy,
          activityType: "assignment_status_changed",
        },
        actionUrl: `/member/assignments/${assignment.id}`,
        isActionable: true,
      });
    }

    console.log("✅ Status change notification sent:", {
      assignmentId: assignment.id,
      oldStatus,
      newStatus,
      notifiedUsers: notifyUserIds,
    });
  } catch (error) {
    console.error("❌ Error creating status change notification:", error);
    // Don't throw - this is a background operation
  }
}

/**
 * Create notification for assignment deletion (async)
 */
async function createDeletionNotification(
  assignment: any,
  deletedBy: string
): Promise<void> {
  try {
    // Notify assignee if deleted by someone else
    if (assignment.assignedTo !== deletedBy) {
      const deleter = await userRepo.getUserById(deletedBy);
      if (!deleter) return;

      await notificationRepo.createNotification({
        userId: assignment.assignedTo,
        type: "FAMILY_ACTIVITY",
        title: "Task Assignment Cancelled",
        message: `${deleter.firstName || deleter.email} cancelled your task assignment: ${assignment.note?.title}`,
        data: {
          assignmentId: assignment.id,
          noteId: assignment.noteId,
          deletedBy,
          activityType: "assignment_deleted",
        },
        actionUrl: `/notes/${assignment.noteId}`,
        isActionable: false,
      });

      console.log("✅ Deletion notification sent:", {
        assignmentId: assignment.id,
        assigneeId: assignment.assignedTo,
      });
    }
  } catch (error) {
    console.error("❌ Error creating deletion notification:", error);
    // Don't throw - this is a background operation
  }
}