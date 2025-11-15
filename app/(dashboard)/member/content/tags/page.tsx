import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PrismaClient, UserRole } from '@prisma/client';
import HealthcareTagSelector from '@/components/content/healthcare-tag-selector';

/**
 * Healthcare Tag Selection Page - Member
 */

const prisma = new PrismaClient();

interface SearchParams {
  returnUrl?: string;
  selectedTags?: string;
}

export default async function MemberHealthcareTagsPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
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

  if (finalUserRole !== UserRole.MEMBER) {
    redirect('/unauthorized');
  }

  // Parse selected tags from URL
  const currentTags = searchParams.selectedTags ?
    decodeURIComponent(searchParams.selectedTags).split(',').filter(Boolean) : [];

  const returnUrl = searchParams.returnUrl || '/member/content/new';

  return (
    <HealthcareTagSelector
      userRole={finalUserRole}
      currentTags={currentTags}
      returnUrl={returnUrl}
    />
  );
}