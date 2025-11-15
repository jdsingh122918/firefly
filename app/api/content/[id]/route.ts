import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { ContentRepository, UpdateContentInput } from '@/lib/db/repositories/content.repository';

/**
 * Individual Content API Endpoint
 *
 * Handles operations for specific content items:
 * - GET: Retrieve single content item
 * - PUT: Update content item
 * - DELETE: Delete content item
 */

const prisma = new PrismaClient();
const contentRepository = new ContentRepository(prisma);

// GET /api/content/[id] - Get single content item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Parse options
    const searchParams = request.nextUrl.searchParams;
    const options = {
      includeCreator: searchParams.get('includeCreator') === 'true',
      includeFamily: searchParams.get('includeFamily') === 'true',
      includeCategory: searchParams.get('includeCategory') === 'true',
      includeDocuments: searchParams.get('includeDocuments') === 'true',
      includeShares: searchParams.get('includeShares') === 'true',
      includeAssignments: searchParams.get('includeAssignments') === 'true',
      includeStructuredTags: searchParams.get('includeStructuredTags') === 'true',
      includeRatings: searchParams.get('includeRatings') === 'true'
    };

    const content = await contentRepository.findById(id, dbUserId, finalUserRole, options);

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Increment view count (fire and forget)
    contentRepository.incrementViewCount(id).catch(console.error);

    return NextResponse.json({
      success: true,
      data: content
    });

  } catch (error) {
    console.error('Content GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/content/[id] - Update content item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Parse and validate request body
    const body = await request.json();
    const updateData = validateUpdateContentInput(body);

    // Update content using database user ID
    const content = await contentRepository.update(id, updateData, dbUserId, finalUserRole);

    return NextResponse.json({
      success: true,
      data: content,
      message: 'Content updated successfully'
    });

  } catch (error) {
    console.error('Content PUT error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to update content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/content/[id] - Delete content item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Delete content (soft delete)
    await contentRepository.delete(id, dbUserId, finalUserRole);

    return NextResponse.json({
      success: true,
      message: 'Content deleted successfully'
    });

  } catch (error) {
    console.error('Content DELETE error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to delete content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function validateUpdateContentInput(body: any): UpdateContentInput {
  const updateData: UpdateContentInput = {};

  // Basic fields
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      throw new Error('Title must be a non-empty string');
    }
    updateData.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      throw new Error('Description must be a string or null');
    }
    updateData.description = body.description?.trim();
  }

  if (body.body !== undefined || body.content !== undefined) {
    const content = body.body || body.content;
    if (content !== null && typeof content !== 'string') {
      throw new Error('Body/content must be a string or null');
    }
    updateData.body = content?.trim();
  }

  // Type-specific fields
  if (body.noteType !== undefined) {
    updateData.noteType = body.noteType;
  }

  if (body.resourceType !== undefined) {
    updateData.resourceType = body.resourceType;
  }

  // Organizational fields
  if (body.visibility !== undefined) {
    updateData.visibility = body.visibility;
  }

  if (body.familyId !== undefined) {
    updateData.familyId = body.familyId;
  }

  if (body.categoryId !== undefined) {
    updateData.categoryId = body.categoryId;
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      throw new Error('Tags must be an array');
    }
    updateData.tags = body.tags.filter(
      (tag: any) => typeof tag === 'string' && tag.trim().length > 0
    );
  }

  // NOTE-specific fields
  if (body.isPinned !== undefined) {
    updateData.isPinned = Boolean(body.isPinned);
  }

  if (body.allowComments !== undefined) {
    updateData.allowComments = Boolean(body.allowComments);
  }

  if (body.allowEditing !== undefined) {
    updateData.allowEditing = Boolean(body.allowEditing);
  }

  // RESOURCE-specific fields
  if (body.url !== undefined) {
    if (body.url !== null && typeof body.url !== 'string') {
      throw new Error('URL must be a string or null');
    }
    updateData.url = body.url;
  }

  if (body.targetAudience !== undefined) {
    if (!Array.isArray(body.targetAudience)) {
      throw new Error('Target audience must be an array');
    }
    updateData.targetAudience = body.targetAudience.filter(
      (audience: any) => typeof audience === 'string'
    );
  }

  if (body.externalMeta !== undefined) {
    updateData.externalMeta = body.externalMeta;
  }

  // Feature flags
  if (body.hasAssignments !== undefined) {
    updateData.hasAssignments = Boolean(body.hasAssignments);
  }

  if (body.hasCuration !== undefined) {
    updateData.hasCuration = Boolean(body.hasCuration);
  }

  if (body.hasRatings !== undefined) {
    updateData.hasRatings = Boolean(body.hasRatings);
  }

  if (body.hasSharing !== undefined) {
    updateData.hasSharing = Boolean(body.hasSharing);
  }

  return updateData;
}