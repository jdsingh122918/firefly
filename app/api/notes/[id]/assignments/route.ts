import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NoteAssignmentRepository } from "@/lib/db/repositories/note-assignment.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { AssignmentPriority, UserRole } from "@/lib/types";

const assignmentRepo = new NoteAssignmentRepository();
const userRepo = new UserRepository();
const notificationRepo = new NotificationRepository();

// Validation schema for creating assignments
const createAssignmentSchema = z.object({
  assignedTo: z.string().min(1, "Assignee is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

/**
 * POST /api/notes/[id]/assignments - Create assignment
 *
 * Creates a new assignment for a note with role-based access control
 * VOLUNTEER users can only assign to users in families they created
 * ADMIN users can assign to anyone
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("📋 POST /api/notes/[id]/assignments");

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

    // 3. Role check: Only ADMIN and VOLUNTEER can create assignments
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions. Only ADMIN and VOLUNTEER users can create assignments." },
        { status: 403 }
      );
    }

    // 4. Extract and validate noteId
    const { id: noteId } = await params;

    // 5. Parse and validate request body
    const body = await request.json();
    const validatedData = createAssignmentSchema.parse(body);

    console.log("✅ Creating assignment:", {
      noteId,
      assignedTo: validatedData.assignedTo,
      assignedBy: user.id,
      priority: validatedData.priority,
      userRole: user.role,
    });

    // 6. Create assignment through repository (handles access control)
    const assignment = await assignmentRepo.createAssignment(
      {
        noteId,
        assignedTo: validatedData.assignedTo,
        assignedBy: user.id,
        priority: validatedData.priority,
        dueDate: validatedData.dueDate,
        notes: validatedData.notes,
      },
      user.role
    );

    // 7. Send notification to assignee (async, non-blocking)
    createAssignmentNotification(assignment.id, assignment.assignedTo, user.id)
      .catch((error) => {
        console.error("❌ Failed to send assignment notification:", error);
        // Don't fail the request if notification fails
      });

    console.log("✅ Assignment created successfully:", assignment.id);

    return NextResponse.json(
      {
        success: true,
        assignment,
        message: "Assignment created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error creating assignment:", error);

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
      if (error.message.includes("family") || error.message.includes("VOLUNTEER")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      // Not found errors
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      // Conflict errors
      if (error.message.includes("already assigned")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      // Other business logic errors
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Generic server error
    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notes/[id]/assignments - Get assignments for a note
 *
 * Returns all assignments for a specific note with proper access control
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("📋 GET /api/notes/[id]/assignments");

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

    // 3. Extract noteId
    const { id: noteId } = await params;

    // 4. Get assignments through note repository (handles access control)
    const assignments = await assignmentRepo.getAssignmentsForUser(user.id, { noteId });

    console.log("✅ Found assignments for note:", {
      noteId,
      assignmentCount: assignments.items.length,
    });

    return NextResponse.json({
      assignments: assignments.items,
      total: assignments.total,
      message: `Found ${assignments.items.length} assignments`,
    });
  } catch (error) {
    console.error("❌ Error fetching note assignments:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("access denied")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Create notification for assignment (async)
 */
async function createAssignmentNotification(
  assignmentId: string,
  assigneeId: string,
  assignerId: string
): Promise<void> {
  try {
    // Get assignment details for notification
    const assignment = await assignmentRepo.getAssignmentById(assignmentId, assignerId, UserRole.ADMIN);
    if (!assignment) {
      throw new Error("Assignment not found for notification");
    }

    // Get assigner details
    const assigner = await userRepo.getUserById(assignerId);
    if (!assigner) {
      throw new Error("Assigner not found for notification");
    }

    // Create notification
    await notificationRepo.createNotification({
      userId: assigneeId,
      type: "FAMILY_ACTIVITY",
      title: "New Task Assignment",
      message: `${assigner.firstName || assigner.email} assigned you a task: ${assignment.note?.title}`,
      data: {
        assignmentId,
        noteId: assignment.noteId,
        assignedBy: assignerId,
        priority: assignment.priority,
        activityType: "assignment_created",
      },
      actionUrl: `/member/assignments/${assignmentId}`,
      isActionable: true,
    });

    console.log("✅ Assignment notification created:", {
      assignmentId,
      assigneeId,
      noteTitle: assignment.note?.title,
    });
  } catch (error) {
    console.error("❌ Error creating assignment notification:", error);
    // Don't throw - this is a background operation
  }
}