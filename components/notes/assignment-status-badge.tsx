"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Clock,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Flame,
  TrendingUp
} from "lucide-react";
import { NoteAssignmentStatus, AssignmentPriority } from "@/lib/types";

interface AssignmentStatusBadgeProps {
  status: NoteAssignmentStatus;
  priority?: AssignmentPriority;
  isOverdue?: boolean;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  [NoteAssignmentStatus.ASSIGNED]: {
    label: "Assigned",
    icon: Clock,
    className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
  },
  [NoteAssignmentStatus.IN_PROGRESS]: {
    label: "In Progress",
    icon: Play,
    className: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
  },
  [NoteAssignmentStatus.COMPLETED]: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
  },
  [NoteAssignmentStatus.CANCELLED]: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200",
  },
};

const priorityConfig = {
  [AssignmentPriority.LOW]: {
    label: "Low",
    icon: TrendingUp,
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  [AssignmentPriority.MEDIUM]: {
    label: "Medium",
    icon: TrendingUp,
    className: "bg-blue-100 text-blue-600 border-blue-200",
  },
  [AssignmentPriority.HIGH]: {
    label: "High",
    icon: AlertTriangle,
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  [AssignmentPriority.URGENT]: {
    label: "Urgent",
    icon: Flame,
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

export function AssignmentStatusBadge({
  status,
  priority,
  isOverdue = false,
  className,
  showIcon = true,
}: AssignmentStatusBadgeProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Override styling for overdue items
  const finalClassName = isOverdue && status !== NoteAssignmentStatus.COMPLETED && status !== NoteAssignmentStatus.CANCELLED
    ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
    : config.className;

  const displayLabel = isOverdue && status !== NoteAssignmentStatus.COMPLETED && status !== NoteAssignmentStatus.CANCELLED
    ? "Overdue"
    : config.label;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium flex items-center gap-1 px-2 py-1",
        finalClassName,
        className
      )}
    >
      {showIcon && <StatusIcon className="h-3 w-3" />}
      {displayLabel}
    </Badge>
  );
}

export function AssignmentPriorityBadge({
  priority,
  className,
  showIcon = true,
}: {
  priority: AssignmentPriority;
  className?: string;
  showIcon?: boolean;
}) {
  const config = priorityConfig[priority];
  const PriorityIcon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium flex items-center gap-1 px-2 py-1",
        config.className,
        className
      )}
    >
      {showIcon && <PriorityIcon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

export function AssignmentMetaBadge({
  status,
  priority,
  dueDate,
  className,
}: {
  status: NoteAssignmentStatus;
  priority?: AssignmentPriority;
  dueDate?: Date | null;
  className?: string;
}) {
  const now = new Date();
  const isOverdue = dueDate && dueDate < now &&
    status !== NoteAssignmentStatus.COMPLETED &&
    status !== NoteAssignmentStatus.CANCELLED;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      <AssignmentStatusBadge
        status={status}
        priority={priority}
        isOverdue={!!isOverdue}
      />
      {priority && !isOverdue && (
        <AssignmentPriorityBadge priority={priority} />
      )}
    </div>
  );
}