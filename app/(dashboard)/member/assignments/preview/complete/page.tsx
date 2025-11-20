/**
 * Template Preview Page
 *
 * Provides a preview of advance directive templates without creating assignments
 * Uses the same completion infrastructure but in read-only preview mode
 */

import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@prisma/client';

// Import the client component for assignment completion
import { AssignmentCompletionClient } from '@/app/(dashboard)/member/assignments/[id]/complete/assignment-completion-client';

interface TemplatePreviewPageProps {
  searchParams: Promise<{
    preview?: string;
    resourceId?: string;
  }>;
}

export default async function TemplatePreviewPage({
  searchParams
}: TemplatePreviewPageProps) {
  const { preview, resourceId } = await searchParams;
  const { userId } = await auth();

  if (!userId) {
    return notFound();
  }

  // Ensure this is actually a preview request with a resource ID
  if (preview !== 'true' || !resourceId) {
    redirect('/member/resources');
  }

  // Get user's database record to determine role for redirect
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true }
  });

  if (!dbUser) {
    return notFound();
  }

  // Fetch the template data for preview
  const template = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      OR: [
        { visibility: 'PUBLIC' },
        { createdBy: dbUser.id }
      ]
    },
    include: {
      creator: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (!template) {
    return notFound();
  }

  // Transform the data to match the expected interfaces
  const externalMeta = template.externalMeta as any;
  const templateData = {
    id: template.id,
    title: template.title,
    description: template.description || '',
    body: template.body || '',
    tags: template.tags,
    formSchema: externalMeta?.formSchema,
    viewCount: template.viewCount,
    createdBy: {
      firstName: template.creator?.firstName || '',
      lastName: template.creator?.lastName || '',
      email: template.creator?.email || ''
    }
  };

  return (
    <AssignmentCompletionClient
      assignment={null}
      template={templateData}
      userId={dbUser.id}
      userRole={dbUser.role as UserRole}
      isPreviewMode={true}
    />
  );
}