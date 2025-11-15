import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentDetailPage from '@/components/content/content-detail-page';

/**
 * Admin Content Detail Page
 *
 * Displays detailed view of a specific content item for ADMIN users:
 * - Full content information and metadata
 * - Complete assignment management
 * - Document viewing and downloads
 * - Content rating and feedback
 * - Edit/delete access for all content
 * - Curation controls (approve/feature)
 */

const prisma = new PrismaClient();

interface AdminContentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminContentDetailPageComponent({ params }: AdminContentDetailPageProps) {
  const { id } = await params;
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/sign-in');
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

  if (finalUserRole !== UserRole.ADMIN) {
    redirect('/unauthorized');
  }

  if (!dbUserId) {
    redirect('/admin/debug'); // User needs to sync their account
  }

  // Fetch all families for assignment management (admins can manage all)
  const families = await prisma.family.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  return (
    <ContentDetailPage
      contentId={id}
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      showAssignmentManagement={true}
      showEditButton={true}
      showDeleteButton={true} // Admins can delete any content
      showCurationControls={true}
      allowRating={true}
    />
  );
}