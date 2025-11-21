import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { ResourceRepository } from '@/lib/db/repositories/resource.repository';

/**
 * Resource Feature API Endpoint
 *
 * Handles featuring operations for resource content:
 * - POST: Feature approved resource content
 *
 * Note: Only ADMIN users can feature resources
 */

const prisma = new PrismaClient();
const resourceRepository = new ResourceRepository(prisma);

// POST /api/resources/[id]/feature - Feature resource
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resourceId } = await params;
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

    // Feature resource
    const resource = await resourceRepository.featureContent(
      resourceId,
      userId,
      finalUserRole
    );

    return NextResponse.json({
      success: true,
      data: resource,
      message: 'Resource featured successfully'
    });

  } catch (error) {
    console.error('Resource feature error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes('Only admins can feature')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to feature resource', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}