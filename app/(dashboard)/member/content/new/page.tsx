import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole, ContentType } from '@prisma/client';
import ContentCreationPage from '@/components/content/content-creation-page';

/**
 * Member Content Creation Page
 *
 * Dedicated page for creating new content (Notes or Resources) as a MEMBER:
 * - Can create content for their own family
 * - Basic feature set
 * - Resources require curation by default
 * - Simple assignment management within family scope
 */

const prisma = new PrismaClient();

export default async function MemberContentCreationPage() {
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

  const [families, categories] = await Promise.all([
    user?.family ? [user.family] : [],
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
      showAdvancedFeatures={false}
      canManageCuration={false}
      backUrl="/member/content"
    />
  );
}