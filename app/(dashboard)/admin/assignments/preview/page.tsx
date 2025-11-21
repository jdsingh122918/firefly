/**
 * Assignment Preview Selection Page - Admin
 *
 * Redirects users to the resources page to select a template for preview.
 * The preview functionality requires a specific resourceId to work.
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';

export default async function AssignmentPreviewPage() {
  const { userId } = await auth();

  if (!userId) {
    return notFound();
  }

  // Verify user has admin role
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true }
  });

  if (!dbUser || dbUser.role !== 'ADMIN') {
    return notFound();
  }

  // Redirect to resources page where they can select a template to preview
  redirect('/admin/resources?message=select-template-to-preview');
}