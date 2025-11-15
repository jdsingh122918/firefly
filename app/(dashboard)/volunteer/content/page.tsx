import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentHubPage from '@/components/content/content-hub-page';

/**
 * Volunteer Content Hub Page
 *
 * Unified content management interface for VOLUNTEER users that provides:
 * - Combined view of Notes and Resources
 * - Family-scoped content management
 * - Assignment creation (family-restricted)
 * - Resource viewing and rating
 */

const prisma = new PrismaClient();

export default async function VolunteerContentPage() {
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

  // Fetch families created by this volunteer (using database ID) and available categories
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
    <ContentHubPage
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      availableCategories={transformedCategories}
      title="My Content"
      description="Manage notes and resources for your families. Create assignments and view community resources."
      showCurationQueue={false}
      showAllContent={false} // Family-scoped content only
      enableContentCreation={true}
      enableAssignmentManagement={true}
      enableCurationWorkflow={false} // Can't approve/feature content
    />
  );
}