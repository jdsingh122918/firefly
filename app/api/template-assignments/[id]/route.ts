import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { TemplateAssignmentRepository } from "@/lib/db/repositories/template-assignment.repository";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const templateAssignmentRepository = new TemplateAssignmentRepository();

/**
 * GET /api/template-assignments/[id]
 * Get a specific template assignment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    const assignment = await templateAssignmentRepository.getById(assignmentId);

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Check permissions: user can only view their own assignments unless admin/volunteer
    if (
      assignment.assigneeId !== dbUser.id &&
      dbUser.role !== "ADMIN" &&
      dbUser.role !== "VOLUNTEER"
    ) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error("Error fetching template assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch template assignment" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/template-assignments/[id]
 * Update a template assignment (status, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, startedAt, completedAt } = body;

    // Get the assignment first to check ownership
    const existingAssignment = await prisma.templateAssignment.findUnique({
      where: { id: assignmentId },
      select: { assigneeId: true, status: true },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Check permissions: user can update their own assignments, or admin/volunteer can update any
    if (
      existingAssignment.assigneeId !== dbUser.id &&
      dbUser.role !== "ADMIN" &&
      dbUser.role !== "VOLUNTEER"
    ) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Validate status transitions
    const validStatuses = ["pending", "started", "completed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Update the assignment
    const updateData: {
      status?: string;
      startedAt?: Date;
      completedAt?: Date;
    } = {};

    if (status) {
      updateData.status = status;
    }

    if (startedAt) {
      updateData.startedAt = new Date(startedAt);
    }

    if (completedAt) {
      updateData.completedAt = new Date(completedAt);
    }

    // Auto-set timestamps based on status
    if (status === "started" && !updateData.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === "completed" && !updateData.completedAt) {
      updateData.completedAt = new Date();
    }

    const updatedAssignment = await prisma.templateAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        resource: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      assignment: {
        id: updatedAssignment.id,
        status: updatedAssignment.status,
        startedAt: updatedAssignment.startedAt,
        completedAt: updatedAssignment.completedAt,
        resourceId: updatedAssignment.resourceId,
        resourceTitle: updatedAssignment.resource.title,
      },
    });
  } catch (error) {
    console.error("Error updating template assignment:", error);
    return NextResponse.json(
      { error: "Failed to update template assignment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/template-assignments/[id]
 * Delete a template assignment (Admin/Volunteer only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    // Only Admin and Volunteer can delete assignments
    if (dbUser.role !== "ADMIN" && dbUser.role !== "VOLUNTEER") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    await templateAssignmentRepository.deleteAssignment(assignmentId);

    return NextResponse.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting template assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete template assignment" },
      { status: 500 }
    );
  }
}
