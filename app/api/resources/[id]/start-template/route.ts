import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { TemplateAssignmentRepository } from "@/lib/db/repositories/template-assignment.repository";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const templateAssignmentRepository = new TemplateAssignmentRepository();
const resourceRepository = new ResourceRepository(prisma);

/**
 * POST /api/resources/[id]/start-template
 * Start working on an assigned template
 * - Verifies the user has an assignment for this resource
 * - Marks the assignment as "started" if currently "pending"
 * - Returns the assignment details
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resourceId } = await params;
    const { userId: clerkUserId, sessionClaims } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's database record
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

    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || dbUser.role;

    // Verify resource exists and is a template
    const resource = await resourceRepository.findById(
      resourceId,
      dbUser.id,
      userRole as UserRole
    );

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found or access denied" },
        { status: 404 }
      );
    }

    // Check if resource is a system-generated template
    const externalMeta = resource.externalMeta as { systemGenerated?: boolean; formSchema?: object } | null;
    if (!externalMeta?.systemGenerated || !externalMeta?.formSchema) {
      return NextResponse.json(
        { error: "This resource is not a fillable template" },
        { status: 400 }
      );
    }

    // Check if user has an assignment for this template
    const hasAssignment = await templateAssignmentRepository.hasExistingAssignment(
      resourceId,
      dbUser.id
    );

    if (!hasAssignment) {
      return NextResponse.json(
        { error: "You don't have an assignment for this template. Please contact your care coordinator." },
        { status: 403 }
      );
    }

    // Mark the assignment as started (if pending)
    const assignment = await templateAssignmentRepository.markAsStarted(
      resourceId,
      dbUser.id
    );

    // If assignment was already started or completed, just get the current status
    const currentAssignment = assignment || await prisma.templateAssignment.findUnique({
      where: {
        resourceId_assigneeId: {
          resourceId,
          assigneeId: dbUser.id,
        },
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!currentAssignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        assignmentId: currentAssignment.id,
        status: currentAssignment.status,
        startedAt: currentAssignment.startedAt,
        completedAt: currentAssignment.completedAt,
        resourceId: resourceId,
        resourceTitle: resource.title,
      },
    });
  } catch (error) {
    console.error("Error starting template workflow:", error);
    return NextResponse.json(
      { error: "Failed to start template workflow" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/resources/[id]/start-template
 * Check if user has an assignment for this template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resourceId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's database record
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    // Check for assignment
    const assignment = await prisma.templateAssignment.findUnique({
      where: {
        resourceId_assigneeId: {
          resourceId,
          assigneeId: dbUser.id,
        },
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        assignedAt: true,
        notes: true,
      },
    });

    return NextResponse.json({
      success: true,
      hasAssignment: !!assignment,
      assignment: assignment ? {
        id: assignment.id,
        status: assignment.status,
        startedAt: assignment.startedAt,
        completedAt: assignment.completedAt,
        assignedAt: assignment.assignedAt,
        notes: assignment.notes,
      } : null,
    });
  } catch (error) {
    console.error("Error checking template assignment:", error);
    return NextResponse.json(
      { error: "Failed to check template assignment" },
      { status: 500 }
    );
  }
}
