import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ContentType, NoteType, ResourceContentType, ResourceStatus, NoteVisibility, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { ContentRepository, ContentFilters, CreateContentInput } from '@/lib/db/repositories/content.repository';

/**
 * Unified Content API Endpoint
 *
 * This endpoint handles both NOTE and RESOURCE content types through
 * the unified Content model, providing a single API interface for
 * all content operations while preserving type-specific features.
 *
 * Supported operations:
 * - GET: Filter and paginate content with type awareness
 * - POST: Create new content (NOTE or RESOURCE)
 * - Backward compatible with existing note/resource APIs
 */

const contentRepository = new ContentRepository(prisma);

// GET /api/content - Filter and paginate content
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters: ContentFilters = parseContentFilters(searchParams);

    // Get content with options
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

    const result = await contentRepository.filter(
      filters,
      dbUserId, // Pass database ID instead of Clerk ID
      finalUserRole,
      options
    );

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        contentTypes: filters.contentType,
        totalContent: result.total,
        page: result.page,
        totalPages: result.totalPages
      }
    });

  } catch (error) {
    console.error('Content API GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/content - Create new content
export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST /api/content - Starting content creation');

    const { userId, sessionClaims } = await auth();
    console.log('📝 Auth result:', { userId: userId ? 'present' : 'missing', sessionClaims: sessionClaims ? 'present' : 'missing' });

    if (!userId) {
      console.error('❌ No userId from auth');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role and database ID with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;
    let dbUserId: string | undefined;

    console.log('📝 User role from session:', userRole);

    // Get user's database record for ID and role
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });

    console.log('📝 Database user:', dbUser);

    if (dbUser) {
      dbUserId = dbUser.id;
      if (!finalUserRole) finalUserRole = dbUser.role as UserRole;
    }

    console.log('📝 Final user details:', { finalUserRole, dbUserId });

    if (!finalUserRole) {
      console.error('❌ User role not found');
      return NextResponse.json({ error: 'User role not found' }, { status: 403 });
    }

    if (!dbUserId) {
      console.error('❌ User not found in database');
      return NextResponse.json({ error: 'User not found in database' }, { status: 403 });
    }

    // Parse request body
    console.log('📝 Parsing request body...');
    const body = await request.json();
    console.log('📝 Request body:', body);

    console.log('📝 Validating content input...');
    const contentData = validateCreateContentInput(body);
    console.log('📝 Validated content data:', contentData);

    // Create content
    console.log('📝 Creating content with repository...');
    const content = await contentRepository.create(
      contentData,
      dbUserId, // Pass database ID instead of Clerk ID
      finalUserRole
    );

    console.log('✅ Content created successfully:', { id: content.id, title: content.title });

    return NextResponse.json({
      success: true,
      data: content,
      message: `${contentData.contentType} created successfully`
    }, { status: 201 });

  } catch (error) {
    console.error('Content API POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function parseContentFilters(searchParams: URLSearchParams): ContentFilters {
  const filters: ContentFilters = {};

  // Content type filters
  const contentType = searchParams.get('contentType') || searchParams.get('type');
  if (contentType) {
    const types = contentType.split(',').map(t => t.trim().toUpperCase());
    filters.contentType = types.filter(t =>
      Object.values(ContentType).includes(t as ContentType)
    ) as ContentType[];
  }

  // Type-specific filters
  const noteType = searchParams.get('noteType');
  if (noteType) {
    const types = noteType.split(',').map(t => t.trim().toUpperCase());
    filters.noteType = types.filter(t =>
      Object.values(NoteType).includes(t as NoteType)
    ) as NoteType[];
  }

  const resourceType = searchParams.get('resourceType');
  if (resourceType) {
    const types = resourceType.split(',').map(t => t.trim().toUpperCase());
    filters.resourceType = types.filter(t =>
      Object.values(ResourceContentType).includes(t as ResourceContentType)
    ) as ResourceContentType[];
  }

  const status = searchParams.get('status');
  if (status) {
    const statuses = status.split(',').map(s => s.trim().toUpperCase());
    filters.status = statuses.filter(s =>
      Object.values(ResourceStatus).includes(s as ResourceStatus)
    ) as ResourceStatus[];
  }

  // Ownership and organization
  const createdBy = searchParams.get('createdBy');
  if (createdBy) filters.createdBy = createdBy;

  const familyId = searchParams.get('familyId');
  if (familyId) filters.familyId = familyId;

  const categoryId = searchParams.get('categoryId');
  if (categoryId) filters.categoryId = categoryId;

  const tags = searchParams.get('tags');
  if (tags) {
    filters.tags = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }

  // Healthcare-specific filters
  const healthcareCategories = searchParams.get('healthcareCategories');
  if (healthcareCategories) {
    filters.healthcareCategories = healthcareCategories.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }

  const healthcareTags = searchParams.get('healthcareTags');
  if (healthcareTags) {
    filters.healthcareTags = healthcareTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }

  const visibility = searchParams.get('visibility');
  if (visibility) {
    const visibilities = visibility.split(',').map(v => v.trim().toUpperCase());
    filters.visibility = visibilities.filter(v =>
      Object.values(NoteVisibility).includes(v as NoteVisibility)
    ) as NoteVisibility[];
  }

  // Search and feature flags
  const search = searchParams.get('search');
  if (search) filters.search = search;

  const hasAssignments = searchParams.get('hasAssignments');
  if (hasAssignments) filters.hasAssignments = hasAssignments === 'true';

  const hasCuration = searchParams.get('hasCuration');
  if (hasCuration) filters.hasCuration = hasCuration === 'true';

  const hasRatings = searchParams.get('hasRatings');
  if (hasRatings) filters.hasRatings = hasRatings === 'true';

  const featured = searchParams.get('featured');
  if (featured) filters.featured = featured === 'true';

  const verified = searchParams.get('verified');
  if (verified) filters.verified = verified === 'true';

  const minRating = searchParams.get('minRating');
  if (minRating) {
    const rating = parseFloat(minRating);
    if (!isNaN(rating) && rating >= 1 && rating <= 5) {
      filters.minRating = rating;
    }
  }

  // Pagination
  const page = searchParams.get('page');
  if (page) {
    const pageNum = parseInt(page, 10);
    if (!isNaN(pageNum) && pageNum > 0) {
      filters.page = pageNum;
    }
  }

  const limit = searchParams.get('limit');
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
      filters.limit = limitNum;
    }
  }

  // Sorting
  const sortBy = searchParams.get('sortBy');
  if (sortBy && ['createdAt', 'updatedAt', 'title', 'viewCount', 'rating'].includes(sortBy)) {
    filters.sortBy = sortBy as any;
  }

  const sortOrder = searchParams.get('sortOrder');
  if (sortOrder && ['asc', 'desc'].includes(sortOrder)) {
    filters.sortOrder = sortOrder as 'asc' | 'desc';
  }

  return filters;
}

function validateCreateContentInput(body: any): CreateContentInput {
  const { title, description, content, body: bodyContent, contentType } = body;

  // Validate required fields
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Title is required');
  }

  if (!contentType || !Object.values(ContentType).includes(contentType)) {
    throw new Error('Valid content type is required (NOTE or RESOURCE)');
  }

  // Validate type-specific requirements
  if (contentType === ContentType.NOTE) {
    const noteType = body.noteType;
    if (noteType && !Object.values(NoteType).includes(noteType)) {
      throw new Error('Invalid note type');
    }
  }

  if (contentType === ContentType.RESOURCE) {
    const resourceType = body.resourceType;
    if (!resourceType || !Object.values(ResourceContentType).includes(resourceType)) {
      throw new Error('Resource type is required for RESOURCE content');
    }
  }

  // Validate visibility
  const visibility = body.visibility;
  if (visibility && !Object.values(NoteVisibility).includes(visibility)) {
    throw new Error('Invalid visibility value');
  }

  // Validate arrays
  const tags = body.tags;
  if (tags && !Array.isArray(tags)) {
    throw new Error('Tags must be an array');
  }

  const targetAudience = body.targetAudience;
  if (targetAudience && !Array.isArray(targetAudience)) {
    throw new Error('Target audience must be an array');
  }

  // Validate URL for certain resource types
  if (contentType === ContentType.RESOURCE) {
    const resourceType = body.resourceType;
    if (['LINK', 'VIDEO'].includes(resourceType) && !body.url) {
      throw new Error('URL is required for LINK and VIDEO resources');
    }

    if (body.url && typeof body.url !== 'string') {
      throw new Error('URL must be a string');
    }
  }

  return {
    title: title.trim(),
    description: description?.trim(),
    body: bodyContent?.trim() || content?.trim(), // Support both 'body' and 'content' fields
    contentType,
    noteType: body.noteType,
    resourceType: body.resourceType,
    visibility,
    familyId: body.familyId || null, // Ensure empty strings become null
    categoryId: body.categoryId || null, // Ensure empty strings become null
    tags: tags?.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0),
    isPinned: body.isPinned,
    allowComments: body.allowComments,
    allowEditing: body.allowEditing,
    url: body.url,
    targetAudience: targetAudience?.filter((audience: any) => typeof audience === 'string'),
    externalMeta: body.externalMeta,
    hasAssignments: body.hasAssignments,
    hasCuration: body.hasCuration,
    hasRatings: body.hasRatings,
    hasSharing: body.hasSharing,
    documentIds: body.documentIds
  };
}