import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentHubPage from '@/components/content/content-hub-page';

/**
 * Admin Content Hub Page
 *
 * Unified content management interface for ADMIN users that provides:
 * - Combined view of Notes and Resources
 * - Full content management capabilities
 * - Assignment system access
 * - Curation workflow management
 * - Advanced filtering and search
 */

const prisma = new PrismaClient();

export default async function AdminContentPage() {
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
      select: { role: true }
    });
    if (dbUser?.role) finalUserRole = dbUser.role as UserRole;
  }

  if (finalUserRole !== UserRole.ADMIN) {
    redirect('/unauthorized');
  }

  // Fetch available families and categories for filters
  const [families, categories] = await Promise.all([
    prisma.family.findMany({
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
      title="Content Management"
      description="Manage notes, resources, assignments, and curation workflows across the platform."
      showCurationQueue={true}
      showAllContent={true}
      enableContentCreation={true}
      enableAssignmentManagement={true}
      enableCurationWorkflow={true}
    />
  );
}