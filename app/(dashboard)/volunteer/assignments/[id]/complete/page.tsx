/**
 * Assignment Completion Page - Volunteer
 *
 * Volunteer version of the assignment completion page
 * Reuses the member completion logic with role-specific access
 */

import React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/prisma';

// Import the existing assignment completion page
import AssignmentCompletionPage from '@/app/(dashboard)/member/assignments/[id]/complete/page';

interface VolunteerAssignmentCompletionPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    preview?: string;
    resourceId?: string;
  }>;
}

export default async function VolunteerAssignmentCompletionPage({
  params,
  searchParams
}: VolunteerAssignmentCompletionPageProps) {
  const { userId } = await auth();

  if (!userId) {
    return notFound();
  }

  // Verify user is volunteer
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true }
  });

  if (!dbUser || dbUser.role !== 'VOLUNTEER') {
    return notFound();
  }

  // Reuse the member completion page logic
  return (
    <AssignmentCompletionPage
      params={params}
      searchParams={searchParams}
    />
  );
}