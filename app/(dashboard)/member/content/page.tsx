import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentHubPage from '@/components/content/content-hub-page';

/**
 * Member Content Hub Page
 *
 * Unified content interface for MEMBER users that provides:
 * - Personal notes management
 * - Resource library access
 * - Assignment viewing and completion
 * - Limited content creation (notes only)
 */

const prisma = new PrismaClient();

export default async function MemberContentPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Get user role with dual-path pattern
  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
  let finalUserRole = userRole;

  if (!userRole) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true, familyId: true }
    });
    if (dbUser?.role) finalUserRole = dbUser.role as UserRole;
  }

  if (finalUserRole !== UserRole.MEMBER) {
    redirect('/unauthorized');
  }

  // Get user's family and available categories
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      familyId: true,
      family: {
        select: { id: true, name: true }
      }
    }
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' }
  });

  // Transform categories to handle null vs undefined for color
  const transformedCategories = categories.map(category => ({
    ...category,
    color: category.color ?? undefined
  }));

  const families = user?.family ? [user.family] : [];

  return (
    <ContentHubPage
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      availableCategories={transformedCategories}
      title="My Content & Resources"
      description="Manage your personal notes and access community resources. View and complete your assignments."
      showCurationQueue={false}
      showAllContent={false} // Personal + family content only
      enableContentCreation={true} // Notes only, no resources
      enableAssignmentManagement={false} // Can only complete assignments, not create
      enableCurationWorkflow={false}
    />
  );
}