/**
 * Assignment Detail Page - Volunteer
 *
 * Displays detailed information about a specific assignment including
 * status, progress, and actions available to volunteer users
 */

import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@prisma/client';
import { AssignmentDetailView } from '@/components/resources/assignment-detail-view';

interface AssignmentDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AssignmentDetailPage({
  params
}: AssignmentDetailPageProps) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return notFound();
  }

  // Get user's database record to verify volunteer role
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true }
  });

  if (!dbUser || dbUser.role !== 'VOLUNTEER') {
    return notFound();
  }

  // Get families created by this volunteer for access control
  const volunteerFamilies = await prisma.family.findMany({
    where: { createdById: dbUser.id },
    select: { id: true }
  });

  const familyIds = volunteerFamilies.map(family => family.id);

  // Fetch assignment with access control for volunteers
  const assignment = await prisma.resourceAssignment.findFirst({
    where: {
      id: id,
      OR: [
        { assignedBy: dbUser.id }, // Assignment was created by this volunteer
        {
          // Or assignment is for a family member in a family they manage
          assignee: {
            familyId: { in: familyIds }
          }
        }
      ]
    },
    include: {
      resource: {
        include: {
          creator: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      assignee: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          familyId: true
        }
      },
      assigner: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      },
    }
  });

  if (!assignment) {
    return notFound();
  }

  // Get form response for the resource if it exists
  let formResponse = null;
  const externalMeta = assignment.resource.externalMeta as any;
  if (externalMeta?.formSchema) {
    formResponse = await prisma.resourceFormResponse.findFirst({
      where: {
        resourceId: assignment.resource.id,
        userId: assignment.assignedTo
      },
      select: {
        id: true,
        formData: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // Add form response to assignment object and handle null values
  const assignmentWithFormResponse = {
    ...assignment,
    description: assignment.description || undefined,
    notes: assignment.completionNotes || undefined,
    dueAt: assignment.dueDate || undefined,
    completedAt: assignment.completedAt || undefined,
    assignee: assignment.assignee ? {
      ...assignment.assignee,
      firstName: assignment.assignee.firstName || undefined,
      lastName: assignment.assignee.lastName || undefined
    } : undefined,
    assigner: assignment.assigner ? {
      ...assignment.assigner,
      firstName: assignment.assigner.firstName || undefined,
      lastName: assignment.assigner.lastName || undefined
    } : undefined,
    resource: {
      ...assignment.resource,
      description: assignment.resource.description || undefined,
      creator: assignment.resource.creator ? {
        ...assignment.resource.creator,
        firstName: assignment.resource.creator.firstName || undefined,
        lastName: assignment.resource.creator.lastName || undefined
      } : undefined
    },
    formResponse: formResponse ? {
      id: formResponse.id,
      isCompleted: !!formResponse.completedAt,
      completedAt: formResponse.completedAt || undefined,
      createdAt: formResponse.createdAt,
      updatedAt: formResponse.updatedAt
    } : undefined
  };

  // Check if volunteer can edit this assignment
  const canEdit = assignment.assignedBy === dbUser.id && assignment.status !== 'COMPLETED';
  const canDelete = assignment.assignedBy === dbUser.id; // Volunteers can delete assignments they created

  return (
    <AssignmentDetailView
      assignment={assignmentWithFormResponse}
      userRole={dbUser.role as UserRole}
      userId={dbUser.id}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}