import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { ResourceRepository } from '@/lib/db/repositories/resource.repository';

/**
 * Template Workflow API Endpoint
 *
 * This endpoint handles the "Start Working" functionality for advance directive templates.
 * It implements the hybrid workflow: auto-assignment + form responses (no personal copies).
 *
 * When a user starts working with a template:
 * 1. Creates or finds existing assignment for progress tracking
 * 2. Returns template with form schema for interactive forms
 * 3. Returns any existing form response data for recovery
 */

const resourceRepository = new ResourceRepository(prisma);

// POST /api/resources/[id]/start-template - Start working with template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: templateId } = await params;
    console.log(`🚀 POST /api/resources/${templateId}/start-template - Starting template workflow`);

    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role and database ID with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;
    let dbUserId: string | undefined;

    // Get user's database record for ID and role
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });

    if (dbUser) {
      dbUserId = dbUser.id;
      if (!finalUserRole) finalUserRole = dbUser.role as UserRole;
    }

    if (!finalUserRole) {
      return NextResponse.json({ error: 'User role not found' }, { status: 403 });
    }

    if (!dbUserId) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 403 });
    }

    console.log(`📋 User starting template: ${finalUserRole} user ${dbUserId}`);

    // Start working with template using repository
    const result = await resourceRepository.startWorkingWithTemplate(
      templateId,
      dbUserId,
      finalUserRole
    );

    console.log(`✅ Template workflow started:`, {
      templateTitle: result.template.title,
      assignmentId: result.assignment.id,
      hasExistingResponse: !!result.existingFormResponse
    });

    return NextResponse.json({
      success: true,
      data: {
        template: {
          id: result.template.id,
          title: result.template.title,
          description: result.template.description,
          body: result.template.body,
          tags: result.template.tags,
          formSchema: (result.template.externalMeta as any)?.formSchema,
          viewCount: result.template.viewCount
        },
        assignment: {
          id: result.assignment.id,
          title: result.assignment.title,
          status: result.assignment.status,
          priority: result.assignment.priority,
          createdAt: result.assignment.createdAt,
          tags: result.assignment.tags
        },
        existingFormResponse: result.existingFormResponse ? {
          id: result.existingFormResponse.id,
          formData: result.existingFormResponse.formData,
          completedAt: result.existingFormResponse.completedAt,
          updatedAt: result.existingFormResponse.updatedAt
        } : undefined
      },
      message: 'Template workflow started successfully'
    }, { status: 200 });

  } catch (error) {
    console.error(`❌ Template workflow start error:`, error);

    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('not a template')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to start template workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/resources/[id]/start-template - Get template info and user's progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: templateId } = await params;
    console.log(`📋 GET /api/resources/${templateId}/start-template - Getting template info`);

    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role and database ID with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;
    let dbUserId: string | undefined;

    // Get user's database record for ID and role
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });

    if (dbUser) {
      dbUserId = dbUser.id;
      if (!finalUserRole) finalUserRole = dbUser.role as UserRole;
    }

    if (!finalUserRole) {
      return NextResponse.json({ error: 'User role not found' }, { status: 403 });
    }

    if (!dbUserId) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 403 });
    }

    // Get template and user's current progress
    const template = await resourceRepository.findById(templateId, dbUserId, finalUserRole);
    if (!template) {
      return NextResponse.json({ error: 'Template not found or access denied' }, { status: 404 });
    }

    // Verify this is actually a template
    const externalMeta = template.externalMeta as any;
    const isTemplate = externalMeta?.isTemplate === true ||
      (template.visibility === 'PUBLIC' &&
       template.hasAssignments &&
       template.status === 'APPROVED' &&
       template.tags.includes("advance-directives"));

    if (!isTemplate) {
      return NextResponse.json({ error: 'Resource is not a template' }, { status: 400 });
    }

    // Get user's existing assignment
    const existingAssignment = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId: templateId,
        assignedTo: dbUserId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] }
      }
    });

    // Get user's existing form response
    const existingFormResponse = await prisma.resourceFormResponse.findUnique({
      where: {
        resourceId_userId: {
          resourceId: templateId,
          userId: dbUserId
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        template: {
          id: template.id,
          title: template.title,
          description: template.description,
          body: template.body,
          tags: template.tags,
          formSchema: externalMeta?.formSchema,
          viewCount: template.viewCount
        },
        currentAssignment: existingAssignment ? {
          id: existingAssignment.id,
          title: existingAssignment.title,
          status: existingAssignment.status,
          priority: existingAssignment.priority,
          createdAt: existingAssignment.createdAt,
          completedAt: existingAssignment.completedAt
        } : undefined,
        existingFormResponse: existingFormResponse ? {
          id: existingFormResponse.id,
          formData: existingFormResponse.formData,
          completedAt: existingFormResponse.completedAt,
          updatedAt: existingFormResponse.updatedAt
        } : undefined,
        hasStarted: !!existingAssignment,
        isCompleted: existingAssignment?.status === 'COMPLETED'
      }
    });

  } catch (error) {
    console.error(`❌ Template info fetch error:`, error);
    return NextResponse.json(
      { error: 'Failed to get template info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}