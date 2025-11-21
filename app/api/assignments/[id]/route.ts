import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ResourceRepository, AssignmentInput } from "@/lib/db/repositories/resource.repository";
import { prisma } from "@/lib/db/prisma";
import { AssignmentPriority, AssignmentStatus, UserRole } from "@prisma/client";

/**
 * GET /api/assignments/[id]
 *
 * Get single assignment details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🔍 [API /assignments/[id]] GET request received');
  try {
    // Check authentication
    const { userId } = await auth();
    console.log('🔑 [API /assignments/[id]] Auth check:', {
      hasUserId: !!userId,
      userId: userId?.substring(0, 8) + '...'
    });

    if (!userId) {
      console.error('🚫 [API /assignments/[id]] No user ID in auth');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get database user
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    // Get assignment details
    const assignment = await prisma.resourceAssignment.findUnique({
      where: { id },
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
        completedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Permission check: User must be assigned to it, be the assigner, or be ADMIN
    const canView =
      assignment.assignedTo === dbUser.id ||
      assignment.assignedBy === dbUser.id ||
      dbUser.role === "ADMIN";

    if (!canView) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    return NextResponse.json({ assignment });

  } catch (error) {
    console.error("Error fetching assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/assignments/[id]
 *
 * Update assignment details (status, priority, description, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🔄 [API /assignments/[id]] PATCH request received');
  try {
    // Check authentication
    const { userId } = await auth();
    console.log('🔑 [API /assignments/[id]] Auth check for PATCH:', {
      hasUserId: !!userId,
      userId: userId?.substring(0, 8) + '...'
    });

    if (!userId) {
      console.error('🚫 [API /assignments/[id]] No user ID in auth for PATCH');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get database user
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const {
      title,
      description,
      priority,
      status,
      dueDate,
      estimatedMinutes,
      tags,
      completionNotes,
    } = body;

    // Validate status if provided
    if (status && !Object.values(AssignmentStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (priority && !Object.values(AssignmentPriority).includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority value" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Partial<AssignmentInput> & {
      status?: AssignmentStatus;
      completionNotes?: string;
    } = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (estimatedMinutes !== undefined) updateData.estimatedMinutes = estimatedMinutes;
    if (tags !== undefined) updateData.tags = tags;
    if (completionNotes !== undefined) updateData.completionNotes = completionNotes;

    // Update assignment using repository
    const resourceRepository = new ResourceRepository(prisma);
    const updatedAssignment = await resourceRepository.updateAssignment(
      id,
      dbUser.id,
      updateData
    );

    return NextResponse.json({ assignment: updatedAssignment });

  } catch (error) {
    console.error("Error updating assignment:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === "Assignment not found") {
        return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
      }
      if (error.message === "Permission denied to update assignment") {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assignments/[id]
 *
 * Delete assignment (only by the assigner)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🗑️ [API /assignments/[id]] DELETE request received');
  try {
    // Check authentication
    const { userId } = await auth();
    console.log('🔑 [API /assignments/[id]] Auth check for DELETE:', {
      hasUserId: !!userId,
      userId: userId?.substring(0, 8) + '...'
    });

    if (!userId) {
      console.error('🚫 [API /assignments/[id]] No user ID in auth for DELETE');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get database user
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    // Delete assignment using repository
    const resourceRepository = new ResourceRepository(prisma);
    await resourceRepository.deleteAssignment(id, dbUser.id);

    return NextResponse.json({ message: "Assignment deleted successfully" });

  } catch (error) {
    console.error("Error deleting assignment:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === "Assignment not found") {
        return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
      }
      if (error.message === "Permission denied to delete assignment") {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}