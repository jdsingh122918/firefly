/**
 * Assignment Detail View Component
 *
 * Displays detailed information about an assignment including status,
 * progress, metadata, and available actions based on user permissions
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@prisma/client';
import {
  ArrowLeft,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Edit,
  Trash2,
  Play,
  Eye,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow, format } from 'date-fns';

interface AssignmentDetailProps {
  assignment: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    createdAt: Date | string;
    dueAt?: Date | string;
    completedAt?: Date | string;
    notes?: string;
    tags: string[];
    assignedTo: string;
    assignedBy: string;
    resource: {
      id: string;
      title: string;
      description?: string;
      resourceType: string;
      externalMeta?: any;
      creator?: {
        firstName?: string;
        lastName?: string;
        email: string;
      };
    };
    assignee?: {
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
    };
    assigner?: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
    formResponse?: {
      id: string;
      isCompleted: boolean;
      completedAt?: Date | string;
      createdAt: Date | string;
      updatedAt: Date | string;
    };
  };
  userRole: UserRole;
  userId: string;
  canEdit: boolean;
  canDelete: boolean;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'IN_PROGRESS':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'PENDING':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'OVERDUE':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'OVERDUE':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'HIGH':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'MEDIUM':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'LOW':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function AssignmentDetailView({
  assignment,
  userRole,
  userId,
  canEdit,
  canDelete
}: AssignmentDetailProps) {
  const router = useRouter();

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/assignments/${assignment.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete assignment');
      }

      router.push(`/${userRole.toLowerCase()}/assignments`);
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  const isTemplate = assignment.resource.externalMeta?.isTemplate === true;
  const hasForm = assignment.resource.externalMeta?.formSchema;
  const isCompleted = assignment.status === 'COMPLETED';
  const hasFormResponse = assignment.formResponse;
  const isAssignee = assignment.assignedTo === userId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/${userRole.toLowerCase()}/assignments`}>
            <Button variant="ghost" size="sm" className="min-h-[44px]">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Assignments
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Assignment Actions */}
          {isTemplate && hasForm && isAssignee && !isCompleted && (
            <Link href={`/${userRole.toLowerCase()}/assignments/${assignment.id}/complete`}>
              <Button
                size="sm"
                className="min-h-[44px] bg-[hsl(var(--ppcc-purple))] hover:bg-[hsl(var(--ppcc-purple)/0.9)] text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                {hasFormResponse ? 'Continue' : 'Start'} Work
              </Button>
            </Link>
          )}

          {isTemplate && hasForm && (
            <Link href={`/${userRole.toLowerCase()}/assignments/preview/complete?preview=true&resourceId=${assignment.resource.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] border-[hsl(var(--ppcc-purple)/0.3)] text-[hsl(var(--ppcc-purple))] hover:bg-[hsl(var(--ppcc-purple)/0.1)]"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Template
              </Button>
            </Link>
          )}

          {canEdit && (
            <Button variant="outline" size="sm" className="min-h-[44px]">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[44px] text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this assignment? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{assignment.title}</CardTitle>
                  {assignment.description && (
                    <p className="text-muted-foreground mt-2">{assignment.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(assignment.status)}
                  <Badge className={getStatusColor(assignment.status)}>
                    {assignment.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Status indicators */}
              <div className="flex items-center gap-4 flex-wrap">
                {assignment.priority && (
                  <Badge variant="outline" className={getPriorityColor(assignment.priority)}>
                    {assignment.priority} Priority
                  </Badge>
                )}
                {isTemplate && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <FileText className="h-3 w-3 mr-1" />
                    Template Assignment
                  </Badge>
                )}
                {hasFormResponse && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Form Data Available
                  </Badge>
                )}
              </div>

              {/* Due date warning */}
              {assignment.dueAt && new Date(assignment.dueAt) < new Date() && !isCompleted && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This assignment was due {formatDistanceToNow(new Date(assignment.dueAt), { addSuffix: true })}
                  </AlertDescription>
                </Alert>
              )}

              {/* Tags */}
              {assignment.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {assignment.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {assignment.notes && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {assignment.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resource Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Related Resource</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium">{assignment.resource.title}</h4>
                  {assignment.resource.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {assignment.resource.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {assignment.resource.resourceType}
                    </Badge>
                    <Link href={`/${userRole.toLowerCase()}/resources/${assignment.resource.id}`}>
                      <Button variant="link" size="sm" className="p-0 h-auto">
                        View Resource →
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assignment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Assignment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assignee */}
              {assignment.assignee && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Assigned to</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.assignee.firstName || assignment.assignee.lastName
                        ? `${assignment.assignee.firstName || ''} ${assignment.assignee.lastName || ''}`.trim()
                        : assignment.assignee.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">{assignment.assignee.role}</p>
                  </div>
                </div>
              )}

              {/* Assigner */}
              {assignment.assigner && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Assigned by</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.assigner.firstName || assignment.assigner.lastName
                        ? `${assignment.assigner.firstName || ''} ${assignment.assigner.lastName || ''}`.trim()
                        : assignment.assigner.email.split('@')[0]}
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Dates */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(assignment.createdAt), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {assignment.dueAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Due Date</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(assignment.dueAt), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(assignment.dueAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )}

                {assignment.completedAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(assignment.completedAt), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(assignment.completedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Form Response Info */}
          {hasFormResponse && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Form Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status</span>
                  <Badge
                    variant="outline"
                    className={assignment.formResponse?.isCompleted
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-yellow-50 text-yellow-700 border-yellow-200"}
                  >
                    {assignment.formResponse?.isCompleted ? 'Completed' : 'In Progress'}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.formResponse?.updatedAt && formatDistanceToNow(new Date(assignment.formResponse.updatedAt), { addSuffix: true })}
                  </p>
                </div>

                {assignment.formResponse?.completedAt && (
                  <div>
                    <p className="text-sm font-medium">Form Completed</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(assignment.formResponse.completedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}