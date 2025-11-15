import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentDetailPage from '@/components/content/content-detail-page';

/**
 * Volunteer Content Detail Page
 *
 * Displays detailed view of a specific content item for VOLUNTEER users:
 * - Full content information and metadata
 * - Assignment management (family-restricted)
 * - Document viewing and downloads
 * - Content rating and feedback
 * - Edit access for own content
 */

const prisma = new PrismaClient();

interface VolunteerContentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function VolunteerContentDetailPageComponent({ params }: VolunteerContentDetailPageProps) {
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

  if (finalUserRole !== UserRole.VOLUNTEER) {
    redirect('/unauthorized');
  }

  if (!dbUserId) {
    redirect('/admin/debug'); // User needs to sync their account
  }

  // Fetch families created by this volunteer for assignment management
  const families = await prisma.family.findMany({
    where: { createdById: dbUserId },
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
      showDeleteButton={false} // Volunteers can't delete content they didn't create
      showCurationControls={false}
      allowRating={true}
    />
  );
}