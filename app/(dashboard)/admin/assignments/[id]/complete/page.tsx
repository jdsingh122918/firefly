/**
 * Assignment Completion Page - Admin
 *
 * Admin version of the assignment completion page
 * Reuses the member completion logic with role-specific access
 */

import React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/prisma';

// Import the existing assignment completion page
import AssignmentCompletionPage from '@/app/(dashboard)/member/assignments/[id]/complete/page';

interface AdminAssignmentCompletionPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    preview?: string;
    resourceId?: string;
  }>;
}

export default async function AdminAssignmentCompletionPage({
  params,
  searchParams
}: AdminAssignmentCompletionPageProps) {
  const { userId } = await auth();

  if (!userId) {
    return notFound();
  }

  // Verify user is admin
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true }
  });

  if (!dbUser || dbUser.role !== 'ADMIN') {
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