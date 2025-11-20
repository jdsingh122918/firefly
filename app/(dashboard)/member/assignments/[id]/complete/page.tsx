/**
 * Assignment Completion Page
 *
 * Provides a dedicated page for completing assignments with:
 * - Assignment context and navigation
 * - Embedded form completion
 * - Breadcrumb navigation back to assignments
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { AccessibilityWidget } from '@/components/ui/accessibility-controls';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@prisma/client';
import { AssignmentCompletionClient } from './assignment-completion-client';

interface AssignmentCompletionPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    preview?: string;
    resourceId?: string;
  }>;
}

export default async function AssignmentCompletionPage({
  params,
  searchParams
}: AssignmentCompletionPageProps) {
  const { id } = await params;
  const { preview, resourceId } = await searchParams;
  const { userId } = await auth();

  if (!userId) {
    return notFound();
  }

  // Get user's database record
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true }
  });

  if (!dbUser) {
    return notFound();
  }

  const isPreviewMode = preview === 'true';

  try {
    let assignmentData;
    let templateData;

    if (isPreviewMode && resourceId) {
      // Preview mode: fetch template without creating assignment
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

      // Verify this is a template
      const externalMeta = template.externalMeta as any;
      const isTemplate = externalMeta?.isTemplate === true ||
        (template.visibility === 'PUBLIC' &&
         template.tags.includes('advance-directives') &&
         template.status === 'APPROVED');

      if (!isTemplate) {
        redirect(`/${dbUser.role.toLowerCase()}/resources/${resourceId}`);
      }

      templateData = {
        id: template.id,
        title: template.title,
        description: template.description || undefined,
        body: template.body || undefined,
        tags: template.tags,
        formSchema: externalMeta?.formSchema,
        viewCount: template.viewCount,
        createdBy: template.creator ? {
          ...template.creator,
          firstName: template.creator.firstName || '',
          lastName: template.creator.lastName || ''
        } : template.creator
      };

      assignmentData = null; // No assignment in preview mode

    } else {
      // Regular completion mode: fetch assignment
      const assignment = await prisma.resourceAssignment.findFirst({
        where: {
          id: id,
          assignedTo: dbUser.id
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
          assigner: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!assignment) {
        return notFound();
      }

      assignmentData = {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description || undefined,
        status: assignment.status,
        priority: assignment.priority,
        createdAt: assignment.createdAt.toISOString(),
        dueAt: assignment.dueDate ? assignment.dueDate.toISOString() : undefined,
        tags: assignment.tags,
        assignedBy: assignment.assigner ? {
          ...assignment.assigner,
          firstName: assignment.assigner.firstName || '',
          lastName: assignment.assigner.lastName || ''
        } : assignment.assigner,
        notes: assignment.completionNotes || undefined,
        existingResponse: undefined as any
      };

      templateData = {
        id: assignment.resource.id,
        title: assignment.resource.title,
        description: assignment.resource.description || undefined,
        body: assignment.resource.body || undefined,
        tags: assignment.resource.tags,
        formSchema: (assignment.resource.externalMeta as any)?.formSchema,
        viewCount: assignment.resource.viewCount,
        createdBy: assignment.resource.creator ? {
          ...assignment.resource.creator,
          firstName: assignment.resource.creator.firstName || '',
          lastName: assignment.resource.creator.lastName || ''
        } : assignment.resource.creator
      };

      // Get existing form response if any
      const existingResponse = await prisma.resourceFormResponse.findFirst({
        where: {
          resourceId: assignment.resource.id,
          userId: dbUser.id
        }
      });

      if (existingResponse) {
        assignmentData.existingResponse = existingResponse;
      }
    }

    return (
      <div className="min-h-screen bg-gray-50/50">
        {/* Accessibility Widget */}
        <AccessibilityWidget />

        {/* Header with navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href={isPreviewMode ? `/${dbUser.role.toLowerCase()}/resources/${resourceId}` : `/${dbUser.role.toLowerCase()}/assignments`}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {isPreviewMode ? 'Back to Resource' : 'Back to Assignments'}
                </Link>

                {/* Breadcrumb */}
                <div className="text-gray-300">/</div>
                <span className="text-gray-600 text-sm">
                  {isPreviewMode ? 'Template Preview' : 'Complete Assignment'}
                </span>
              </div>

              {/* Mode indicator */}
              {isPreviewMode && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Preview Mode
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar with assignment info */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    {isPreviewMode ? 'Template Info' : 'Assignment Info'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {isPreviewMode ? templateData.title : assignmentData?.title}
                    </h3>
                    {templateData.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {templateData.description}
                      </p>
                    )}
                  </div>

                  {!isPreviewMode && assignmentData && (
                    <>
                      <div>
                        <div className="text-sm text-gray-500">Status</div>
                        <div className="flex items-center mt-1">
                          {assignmentData.status === 'COMPLETED' ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          ) : assignmentData.status === 'IN_PROGRESS' ? (
                            <Clock className="h-4 w-4 text-yellow-500 mr-2" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-gray-500 mr-2" />
                          )}
                          <Badge variant={
                            assignmentData.status === 'COMPLETED' ? 'default' :
                            assignmentData.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                          }>
                            {assignmentData.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      {assignmentData.priority && (
                        <div>
                          <div className="text-sm text-gray-500">Priority</div>
                          <Badge variant={assignmentData.priority === 'HIGH' ? 'destructive' : 'outline'}>
                            {assignmentData.priority}
                          </Badge>
                        </div>
                      )}

                      {assignmentData.dueAt && (
                        <div>
                          <div className="text-sm text-gray-500">Due Date</div>
                          <div className="text-sm">
                            {new Date(assignmentData.dueAt).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Tags */}
                  {templateData.tags && templateData.tags.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-500 mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {templateData.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main form area */}
            <div className="lg:col-span-3">
              <AssignmentCompletionClient
                assignment={assignmentData}
                template={templateData}
                userId={dbUser.id}
                userRole={dbUser.role as UserRole}
                isPreviewMode={isPreviewMode}
              />
            </div>
          </div>
        </div>
      </div>
    );

  } catch (error) {
    console.error('Error in assignment completion page:', error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              We encountered an error while loading the assignment. Please try again.
            </p>
            <Link
              href={`/${dbUser?.role?.toLowerCase() || 'member'}/assignments`}
              className="inline-flex items-center"
            >
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Assignments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
}