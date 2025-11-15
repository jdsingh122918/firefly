import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { NoteAssignmentRepository } from "@/lib/db/repositories/note-assignment.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NoteAssignmentStatus, AssignmentPriority, UserRole } from "@/lib/types";

const assignmentRepo = new NoteAssignmentRepository();
const userRepo = new UserRepository();

/**
 * GET /api/assignments - Get user's assignments dashboard
 *
 * Returns assignments assigned to the user or created by the user (for ADMIN/VOLUNTEER)
 * Supports filtering by status, priority, and due date
 * Includes pagination and sorting
 */
export async function GET(request: NextRequest) {
  try {
    console.log("📋 GET /api/assignments");

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

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);

    // Filter parameters
    const status = searchParams.get("status") as NoteAssignmentStatus | null;
    const priority = searchParams.get("priority") as AssignmentPriority | null;
    const dueBefore = searchParams.get("dueBefore");
    const dueAfter = searchParams.get("dueAfter");
    const view = searchParams.get("view") || "assigned"; // "assigned" | "created"

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    // Validate enum values
    if (status && !Object.values(NoteAssignmentStatus).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400 }
      );
    }

    if (priority && !Object.values(AssignmentPriority).includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority: ${priority}` },
        { status: 400 }
      );
    }

    // Build filter object
    const filters: any = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (dueBefore) filters.dueBefore = new Date(dueBefore);
    if (dueAfter) filters.dueAfter = new Date(dueAfter);

    console.log("✅ Fetching assignments:", {
      userId: user.id,
      userRole: user.role,
      view,
      filters,
      page,
      limit,
    });

    let assignments;

    // 4. Fetch assignments based on view
    if (view === "created" && (user.role === UserRole.ADMIN || user.role === UserRole.VOLUNTEER)) {
      // Get assignments created by user (for ADMIN/VOLUNTEER dashboard)
      assignments = await assignmentRepo.getAssignmentsCreatedByUser(
        user.id,
        user.role,
        filters,
        { page, limit }
      );
    } else {
      // Get assignments assigned to user
      assignments = await assignmentRepo.getAssignmentsForUser(
        user.id,
        filters,
        { page, limit, sortBy, sortOrder }
      );
    }

    // 5. Get summary statistics
    const stats = await getAssignmentStats(user.id, user.role, view);

    console.log("✅ Found assignments:", {
      total: assignments.total,
      page: assignments.page,
      assignmentCount: assignments.items.length,
      view,
    });

    return NextResponse.json({
      assignments: assignments.items,
      pagination: {
        page: assignments.page,
        limit: assignments.limit,
        total: assignments.total,
        hasNextPage: assignments.hasNextPage,
        hasPrevPage: assignments.hasPrevPage,
        totalPages: Math.ceil(assignments.total / assignments.limit),
      },
      stats,
      filters: {
        status,
        priority,
        dueBefore,
        dueAfter,
        view,
        sortBy,
        sortOrder,
      },
      message: `Found ${assignments.items.length} assignments`,
    });
  } catch (error) {
    console.error("❌ Error fetching assignments:", error);

    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes("Invalid date")) {
        return NextResponse.json(
          { error: "Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)" },
          { status: 400 }
        );
      }

      if (error.message.includes("access denied")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
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
 * Get assignment statistics for dashboard
 */
async function getAssignmentStats(
  userId: string,
  userRole: UserRole,
  view: string
): Promise<{
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
  created?: number; // Only for ADMIN/VOLUNTEER
}> {
  try {
    const now = new Date();

    if (view === "created" && (userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER)) {
      // Stats for assignments created by user
      const created = await assignmentRepo.getAssignmentsCreatedByUser(
        userId,
        userRole,
        {},
        { page: 1, limit: 1000 } // Large limit for stats calculation (consider using count query for >1000)
      );

      const stats = {
        assigned: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        created: created.total,
      };

      // Count by status
      created.items.forEach((assignment) => {
        switch (assignment.status) {
          case NoteAssignmentStatus.ASSIGNED:
            stats.assigned++;
            break;
          case NoteAssignmentStatus.IN_PROGRESS:
            stats.inProgress++;
            break;
          case NoteAssignmentStatus.COMPLETED:
            stats.completed++;
            break;
        }

        // Check for overdue
        if (
          assignment.dueDate &&
          assignment.dueDate < now &&
          assignment.status !== NoteAssignmentStatus.COMPLETED &&
          assignment.status !== NoteAssignmentStatus.CANCELLED
        ) {
          stats.overdue++;
        }
      });

      return stats;
    } else {
      // Stats for assignments assigned to user
      const assigned = await assignmentRepo.getAssignmentsForUser(
        userId,
        {},
        { page: 1, limit: 1000 } // Get all for counting
      );

      const stats = {
        assigned: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
      };

      // Count by status
      assigned.items.forEach((assignment) => {
        switch (assignment.status) {
          case NoteAssignmentStatus.ASSIGNED:
            stats.assigned++;
            break;
          case NoteAssignmentStatus.IN_PROGRESS:
            stats.inProgress++;
            break;
          case NoteAssignmentStatus.COMPLETED:
            stats.completed++;
            break;
        }

        // Check for overdue
        if (
          assignment.dueDate &&
          assignment.dueDate < now &&
          assignment.status !== NoteAssignmentStatus.COMPLETED &&
          assignment.status !== NoteAssignmentStatus.CANCELLED
        ) {
          stats.overdue++;
        }
      });

      return stats;
    }
  } catch (error) {
    console.error("❌ Error calculating assignment stats:", error);

    // Return empty stats on error
    return {
      assigned: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    };
  }
}