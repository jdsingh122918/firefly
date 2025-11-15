import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import ContentEditPage from '@/components/content/content-edit-page';

/**
 * Admin Content Edit Page
 *
 * Allows ADMIN users to edit any content with full privileges:
 * - Edit any content in the system
 * - Modify all content metadata and settings
 * - Change content types and features
 * - Complete assignment management
 * - Full curation control
 * - Access to all families and categories
 */

const prisma = new PrismaClient();

interface AdminContentEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminContentEditPageComponent({ params }: AdminContentEditPageProps) {
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

  // Fetch all families and categories (admins have access to everything)
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
    <ContentEditPage
      contentId={id}
      userRole={finalUserRole}
      userId={userId}
      availableFamilies={families}
      availableCategories={transformedCategories}
      showFamilySelector={true}
      showAssignmentManagement={true}
      showCurationControls={true}
      allowContentTypeChange={true} // Admins can change content type after creation
    />
  );
}