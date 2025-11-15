import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole, ContentType } from '@prisma/client';
import ContentCreationPage from '@/components/content/content-creation-page';

/**
 * Volunteer Content Creation Page
 *
 * Dedicated page for creating new content (Notes or Resources) as a VOLUNTEER:
 * - Can create content for families they created
 * - Limited to family-scoped permissions
 * - Standard feature set with curation enabled for resources
 * - Assignment management for their families
 */

const prisma = new PrismaClient();

export default async function VolunteerContentCreationPage() {
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

  // Fetch families created by this volunteer (family-scoped access using database ID)
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
    <ContentCreationPage
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      availableCategories={transformedCategories}
      enableTypeSelection={true}
      defaultContentType={ContentType.NOTE} // Default to NOTE type
      showAdvancedFeatures={false}
      canManageCuration={false}
      backUrl="/volunteer/content"
    />
  );
}