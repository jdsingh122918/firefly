import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { ContentRepository } from '@/lib/db/repositories/content.repository';

/**
 * Content Rating API Endpoint
 *
 * Handles rating operations for RESOURCE content:
 * - POST: Add or update rating for content
 *
 * Note: Only RESOURCE content supports ratings
 */

const prisma = new PrismaClient();
const contentRepository = new ContentRepository(prisma);

// POST /api/content/[id]/rate - Rate content
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
    const { rating, review, isHelpful } = validateRatingInput(body);

    // Create or update rating
    const contentRating = await contentRepository.rateContent(
      contentId,
      userId,
      rating,
      review,
      isHelpful
    );

    return NextResponse.json({
      success: true,
      data: contentRating,
      message: 'Rating submitted successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Rating POST error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes('not ratable')) {
      return NextResponse.json({ error: 'This content type does not support ratings' }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes('Rating must be between')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to submit rating', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function validateRatingInput(body: any) {
  const { rating, review, isHelpful } = body;

  // Validate required fields
  if (!rating || typeof rating !== 'number') {
    throw new Error('Rating is required and must be a number');
  }

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Validate optional fields
  if (review !== undefined && typeof review !== 'string') {
    throw new Error('Review must be a string');
  }

  if (isHelpful !== undefined && typeof isHelpful !== 'boolean') {
    throw new Error('IsHelpful must be a boolean');
  }

  return {
    rating: Math.round(rating), // Ensure integer rating
    review: review?.trim(),
    isHelpful
  };
}