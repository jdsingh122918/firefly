import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentDetailPage from '@/components/content/content-detail-page';

/**
 * Member Content Detail Page
 *
 * Displays detailed view of a specific content item for MEMBER users:
 * - Content information and metadata (view-only for most content)
 * - Document viewing and downloads
 * - Content rating and feedback
 * - Edit access for own content only
 * - Limited assignment viewing
 */

const prisma = new PrismaClient();

interface MemberContentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberContentDetailPageComponent({ params }: MemberContentDetailPageProps) {
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

  if (finalUserRole !== UserRole.MEMBER) {
    redirect('/unauthorized');
  }

  if (!dbUserId) {
    redirect('/admin/debug'); // User needs to sync their account
  }

  // Members don't create families, so empty array for assignment management
  const families: Array<{ id: string; name: string }> = [];

  return (
    <ContentDetailPage
      contentId={id}
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      showAssignmentManagement={false} // Members can't manage assignments
      showEditButton={true} // Will be restricted to own content in component
      showDeleteButton={false} // Members can't delete content
      showCurationControls={false}
      allowRating={true}
    />
  );
}