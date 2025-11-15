import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentEditPage from '@/components/content/content-edit-page';

/**
 * Volunteer Content Edit Page
 *
 * Allows VOLUNTEER users to edit content they have access to:
 * - Edit own created content
 * - Modify content metadata and description
 * - Update assignments for family-scoped content
 * - Manage document attachments
 */

const prisma = new PrismaClient();

interface VolunteerContentEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function VolunteerContentEditPageComponent({ params }: VolunteerContentEditPageProps) {
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

  // Fetch families created by this volunteer and available categories
  const [families, categories] = await Promise.all([
    prisma.family.findMany({
      where: { createdById: dbUserId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' }
    })
  ]);

  // Transform categories to handle null vs undefined for color
  const transformedCategories = categories.map(category => ({
    ...category,
    color: category.color ?? undefined
  }));

  return (
    <ContentEditPage
      contentId={id}
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      availableCategories={transformedCategories}
      showFamilySelector={true}
      showAssignmentManagement={true}
      showCurationControls={false}
      allowContentTypeChange={false} // Volunteers can't change content type after creation
    />
  );
}