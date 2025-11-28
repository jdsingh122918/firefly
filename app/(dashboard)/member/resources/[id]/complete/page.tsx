import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ResourceRepository } from '@/lib/db/repositories/resource.repository';
import { TemplateAssignmentRepository } from '@/lib/db/repositories/template-assignment.repository';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/auth/roles';
import { FormCompletionClient } from './form-completion-client';

const resourceRepository = new ResourceRepository(prisma);
const templateAssignmentRepository = new TemplateAssignmentRepository();

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FormCompletionPage({ params }: PageProps) {
  const { id: resourceId } = await params;
  const { userId: clerkUserId, sessionClaims } = await auth();

  if (!clerkUserId) {
    redirect('/sign-in');
  }

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, role: true, firstName: true, lastName: true, email: true },
  });

  if (!dbUser) {
    redirect('/sign-in');
  }

  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || dbUser.role;

  // Verify user has an assignment for this template
  const hasAssignment = await templateAssignmentRepository.hasExistingAssignment(
    resourceId,
    dbUser.id
  );

  if (!hasAssignment) {
    // Redirect back to resource detail with error
    redirect(`/member/resources/${resourceId}?error=no-assignment`);
  }

  // Fetch the resource
  const resource = await resourceRepository.findById(resourceId, dbUser.id, userRole as UserRole);

  if (!resource) {
    notFound();
  }

  // Verify it's a template with a form schema
  const externalMeta = resource.externalMeta as {
    systemGenerated?: boolean;
    formSchema?: { sections: Record<string, any> };
  } | null;

  if (!externalMeta?.formSchema) {
    redirect(`/member/resources/${resourceId}?error=not-template`);
  }

  // Fetch existing form response if any
  const existingResponse = await resourceRepository.getFormResponse(resourceId, dbUser.id);

  // Get assignment details
  const assignment = await prisma.templateAssignment.findUnique({
    where: {
      resourceId_assigneeId: {
        resourceId,
        assigneeId: dbUser.id,
      },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      notes: true,
    },
  });

  return (
    <div className="space-y-6 pb-8">
      <Suspense fallback={<FormLoadingSkeleton />}>
        <FormCompletionClient
          resourceId={resourceId}
          resourceTitle={resource.title}
          resourceDescription={resource.description || ''}
          formSchema={externalMeta.formSchema}
          userId={dbUser.id}
          existingFormData={existingResponse?.formData as Record<string, any> | undefined}
          assignmentStatus={assignment?.status || 'pending'}
        />
      </Suspense>
    </div>
  );
}

function FormLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/3"></div>
      <div className="h-4 bg-muted rounded w-2/3"></div>
      <div className="space-y-4">
        <div className="h-48 bg-muted rounded"></div>
        <div className="h-48 bg-muted rounded"></div>
      </div>
    </div>
  );
}
