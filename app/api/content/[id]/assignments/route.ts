import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient, UserRole, AssignmentPriority } from '@prisma/client';
import { ContentRepository, AssignmentInput } from '@/lib/db/repositories/content.repository';

/**
 * Content Assignment API Endpoints
 *
 * Handles assignment operations for NOTE content:
 * - POST: Create new assignment for content
 * - GET: List assignments for content
 *
 * Note: Only NOTE content supports assignments
 */

const prisma = new PrismaClient();
const contentRepository = new ContentRepository(prisma);

// POST /api/content/[id]/assignments - Create assignment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contentId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;

    if (!userRole) {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      });
      if (dbUser?.role) finalUserRole = dbUser.role as UserRole;
    }

    if (!finalUserRole) {
      return NextResponse.json({ error: 'User role not found' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const assignmentData = validateAssignmentInput(body);

    // Create assignment
    const assignment = await contentRepository.createAssignment(
      contentId,
      assignmentData,
      userId,
      finalUserRole
    );

    return NextResponse.json({
      success: true,
      data: assignment,
      message: 'Assignment created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Assignment POST error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof Error && error.message.includes('VOLUNTEER can only assign')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to create assignment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/content/[id]/assignments - List assignments for content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contentId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;

    if (!userRole) {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      });
      if (dbUser?.role) finalUserRole = dbUser.role as UserRole;
    }

    if (!finalUserRole) {
      return NextResponse.json({ error: 'User role not found' }, { status: 403 });
    }

    // Check if content exists and user has access
    const content = await contentRepository.findById(contentId, userId, finalUserRole);
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Get assignments for this content
    const assignments = await prisma.contentAssignment.findMany({
      where: { contentId },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true }
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

    return NextResponse.json({
      success: true,
      data: assignments
    });

  } catch (error) {
    console.error('Assignment GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function validateAssignmentInput(body: any): AssignmentInput {
  const { title, description, assignedTo, priority, dueDate, estimatedMinutes, tags } = body;

  // Validate required fields
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Assignment title is required');
  }

  if (!assignedTo || typeof assignedTo !== 'string') {
    throw new Error('AssignedTo user ID is required');
  }

  // Validate optional fields
  if (description !== undefined && typeof description !== 'string') {
    throw new Error('Description must be a string');
  }

  if (priority !== undefined && !Object.values(AssignmentPriority).includes(priority)) {
    throw new Error('Invalid priority value');
  }

  if (dueDate !== undefined) {
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid due date format');
    }
  }

  if (estimatedMinutes !== undefined) {
    const minutes = parseInt(estimatedMinutes, 10);
    if (isNaN(minutes) || minutes < 0) {
      throw new Error('Estimated minutes must be a non-negative number');
    }
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    throw new Error('Tags must be an array');
  }

  return {
    title: title.trim(),
    description: description?.trim(),
    assignedTo,
    priority: priority || AssignmentPriority.MEDIUM,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
    tags: tags?.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0) || []
  };
}