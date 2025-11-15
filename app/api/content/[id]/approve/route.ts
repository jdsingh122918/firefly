import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { ContentRepository } from '@/lib/db/repositories/content.repository';

/**
 * Content Approval API Endpoint
 *
 * Handles approval operations for RESOURCE content:
 * - POST: Approve pending resource content
 *
 * Note: Only ADMIN users can approve content
 */

const prisma = new PrismaClient();
const contentRepository = new ContentRepository(prisma);

// POST /api/content/[id]/approve - Approve content
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

    // Approve content
    const content = await contentRepository.approveContent(
      contentId,
      userId,
      finalUserRole
    );

    return NextResponse.json({
      success: true,
      data: content,
      message: 'Content approved successfully'
    });

  } catch (error) {
    console.error('Content approval error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes('Only admins can approve')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to approve content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}