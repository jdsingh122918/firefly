"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Calendar,
  Clock,
  User,
  FileText,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatTimeAgo, getAuthorDisplay, truncateText } from "@/components/shared/format-utils";
import { AssignmentStatusBadge, AssignmentPriorityBadge } from "./assignment-status-badge";
import {
  NoteAssignment,
  NoteAssignmentStatus,
  UserRole
} from "@/lib/types";

interface AssignmentCardProps {
  assignment: NoteAssignment;
  onEdit?: (assignment: NoteAssignment) => void;
  onDelete?: (assignment: NoteAssignment) => void;
  onStatusChange?: (assignment: NoteAssignment, newStatus: NoteAssignmentStatus) => void;
  showNote?: boolean; // Whether to show note information
  showActions?: boolean;
  className?: string;
}

const getAssignmentCardColors = (assignment: NoteAssignment, isOverdue: boolean) => {
  // Priority 1: Overdue assignments (critical attention needed)
  if (isOverdue) {
    return {
      border: 'border-l-[var(--healthcare-medical)]',
      background: 'bg-pink-50 dark:bg-pink-950/20',
      hover: 'hover:bg-pink-100 dark:hover:bg-pink-950/30'
    };
  }

  // Priority 2: Assignment status
  switch (assignment.status) {
    case NoteAssignmentStatus.COMPLETED:
      return {
        border: 'border-l-[var(--healthcare-home)]',
        background: 'bg-teal-50 dark:bg-teal-950/20',
        hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
      };
    case NoteAssignmentStatus.IN_PROGRESS:
      return {
        border: 'border-l-[var(--healthcare-basic)]',
        background: 'bg-orange-50 dark:bg-orange-950/20',
        hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
      };
    case NoteAssignmentStatus.ASSIGNED:
      return {
        border: 'border-l-[var(--healthcare-education)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    case NoteAssignmentStatus.CANCELLED:
      return {
        border: 'border-l-[var(--healthcare-legal)]',
        background: 'bg-gray-50 dark:bg-gray-950/20',
        hover: 'hover:bg-gray-100 dark:hover:bg-gray-950/30'
      };
    default:
      break;
  }

  // Priority 3: Assignment priority
  switch (assignment.priority) {
    case "URGENT":
      return {
        border: 'border-l-[var(--healthcare-mental)]',
        background: 'bg-purple-50 dark:bg-purple-950/20',
        hover: 'hover:bg-purple-100 dark:hover:bg-purple-950/30'
      };
    case "HIGH":
      return {
        border: 'border-l-[var(--healthcare-equipment)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    default:
      break;
  }

  // Default fallback for MEDIUM priority
  return {
    border: 'border-l-[var(--healthcare-education)]',
    background: 'bg-blue-50 dark:bg-blue-950/20',
    hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
  };
};

export function AssignmentCard({
  assignment,
  onEdit,
  onDelete,
  onStatusChange,
  showNote = true,
  showActions = true,
  className
}: AssignmentCardProps) {
  const router = useRouter();
  const { sessionClaims, userId: currentUserId } = useAuth();
  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || UserRole.MEMBER;

  // Calculate if assignment is overdue
  const now = new Date();
  const isOverdue = assignment.dueDate &&
    new Date(assignment.dueDate) < now &&
    assignment.status !== NoteAssignmentStatus.COMPLETED &&
    assignment.status !== NoteAssignmentStatus.CANCELLED;

  // Get display info for assignee and assigner
  const assigneeDisplay = assignment.assignee ?
    getAuthorDisplay({
      firstName: assignment.assignee.firstName ?? undefined,
      lastName: assignment.assignee.lastName ?? undefined,
      email: assignment.assignee.email ?? undefined
    }) :
    { name: "Unknown User", initials: "??" };

  const assignerDisplay = assignment.assigner ?
    getAuthorDisplay({
      firstName: assignment.assigner.firstName ?? undefined,
      lastName: assignment.assigner.lastName ?? undefined,
      email: assignment.assigner.email ?? undefined
    }) :
    { name: "Unknown User", initials: "??" };

  // Determine user's relationship to assignment
  const isAssignee = assignment.assignedTo === currentUserId;
  const isAssigner = assignment.assignedBy === currentUserId;
  const canEdit = isAssigner || userRole === UserRole.ADMIN;
  const canDelete = canEdit;
  const canChangeStatus = isAssignee || canEdit;
  const canStartWork = isAssignee; // Only assignees can start work

  // Handle quick status changes
  const handleQuickStatusChange = (newStatus: NoteAssignmentStatus) => {
    if (onStatusChange) {
      onStatusChange(assignment, newStatus);
    }
  };

  // Navigate to note
  const handleViewNote = () => {
    if (assignment.note) {
      const rolePrefix = userRole.toLowerCase();
      router.push(`/${rolePrefix}/notes`); // Will open note in dialog
    }
  };

  const cardColors = getAssignmentCardColors(assignment, !!isOverdue);

  return (
    <Card
      className={cn(
        "border-l-4 transition-colors",
        cardColors.border,
        cardColors.background,
        cardColors.hover,
        assignment.status === NoteAssignmentStatus.COMPLETED && "opacity-75",
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Assignment metadata */}
          <div className="flex items-center gap-2 flex-wrap">
            <AssignmentStatusBadge
              status={assignment.status}
              priority={assignment.priority}
              isOverdue={!!isOverdue}
            />
            {assignment.priority !== "MEDIUM" && !isOverdue && (
              <AssignmentPriorityBadge priority={assignment.priority} />
            )}
            {isOverdue && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
          </div>

          {/* Actions dropdown */}
          {showActions && (canEdit || canChangeStatus) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Quick status changes for assignee */}
                {canChangeStatus && assignment.status !== NoteAssignmentStatus.COMPLETED && (
                  <>
                    {assignment.status === NoteAssignmentStatus.ASSIGNED && (
                      <DropdownMenuItem
                        onClick={() => handleQuickStatusChange(NoteAssignmentStatus.IN_PROGRESS)}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Start Working
                      </DropdownMenuItem>
                    )}
                    {assignment.status === NoteAssignmentStatus.IN_PROGRESS && (
                      <DropdownMenuItem
                        onClick={() => handleQuickStatusChange(NoteAssignmentStatus.COMPLETED)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    {assignment.status === NoteAssignmentStatus.ASSIGNED && (
                      <DropdownMenuItem
                        onClick={() => handleQuickStatusChange(NoteAssignmentStatus.COMPLETED)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Edit assignment (for assigner/admin) */}
                {canEdit && onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(assignment)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Assignment
                  </DropdownMenuItem>
                )}

                {/* View note */}
                {assignment.note && (
                  <DropdownMenuItem onClick={handleViewNote}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Note
                  </DropdownMenuItem>
                )}

                {/* Delete (for assigner/admin) */}
                {canDelete && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(assignment)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Assignment
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Note information (if showing note context) */}
        {showNote && assignment.note && (
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-sm line-clamp-1">
                  {assignment.note.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {assignment.note.type} Note
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Assignment notes */}
        {assignment.notes && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Notes: </span>
            {assignment.notes}
          </div>
        )}

        {/* Assignment metadata */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {/* Assignee */}
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs">
                {assigneeDisplay.initials}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {isAssignee ? "Me" : assigneeDisplay.name}
            </span>
          </div>

          {/* Due date */}
          {assignment.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className={cn(
                isOverdue && "text-red-600 font-medium"
              )}>
                Due {formatTimeAgo(assignment.dueDate)}
              </span>
            </div>
          )}

          {/* Created date */}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              Created {formatTimeAgo(assignment.createdAt)}
            </span>
          </div>
        </div>

        {/* Assigner information (if different from current user) */}
        {!isAssigner && (
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Assigned by:</span>
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-xs">
                  {assignerDisplay.initials}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">
                {assignerDisplay.name}
              </span>
            </div>
          </div>
        )}

        {/* Quick action buttons for common status changes */}
        {assignment.status !== NoteAssignmentStatus.COMPLETED && (
          <div className="pt-2 border-t">
            <div className="flex gap-2">
              {/* Start Working - only for assignees */}
              {canStartWork && assignment.status === NoteAssignmentStatus.ASSIGNED && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickStatusChange(NoteAssignmentStatus.IN_PROGRESS)}
                  className="h-8 text-xs"
                >
                  Start Working
                </Button>
              )}
              {/* Complete Task - for assignees and admins/creators */}
              {canChangeStatus && (assignment.status === NoteAssignmentStatus.IN_PROGRESS ||
                assignment.status === NoteAssignmentStatus.ASSIGNED) && (
                <Button
                  size="sm"
                  onClick={() => handleQuickStatusChange(NoteAssignmentStatus.COMPLETED)}
                  className="h-8 text-xs"
                >
                  Complete Task
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}