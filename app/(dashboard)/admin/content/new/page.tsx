import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole, ContentType } from '@prisma/client';
import ContentCreationPage from '@/components/content/content-creation-page';

/**
 * Admin Content Creation Page
 *
 * Dedicated page for creating new content (Notes or Resources) as an ADMIN:
 * - Full access to all content types and features
 * - Can create content for any family
 * - Access to all organizational tools
 * - Advanced feature configuration
 */

const prisma = new PrismaClient();

export default async function AdminContentCreationPage() {
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

  // Fetch available families and categories for organization
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
    <ContentCreationPage
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      availableCategories={transformedCategories}
      enableTypeSelection={true}
      defaultContentType={ContentType.NOTE} // Default to NOTE type
      showAdvancedFeatures={true}
      canManageCuration={true}
      backUrl="/admin/content"
    />
  );
}