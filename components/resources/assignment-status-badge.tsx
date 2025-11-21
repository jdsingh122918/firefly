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
import { AssignmentStatus, AssignmentPriority } from "@/lib/types";

interface AssignmentStatusBadgeProps {
  status: AssignmentStatus;
  priority?: AssignmentPriority;
  isOverdue?: boolean;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  [AssignmentStatus.ASSIGNED]: {
    label: "Assigned",
    icon: Clock,
    className: "bg-[hsl(var(--status-pending)/0.1)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)/0.3)] hover:bg-[hsl(var(--status-pending)/0.15)]",
  },
  [AssignmentStatus.IN_PROGRESS]: {
    label: "In Progress",
    icon: Play,
    className: "bg-[hsl(var(--status-active)/0.1)] text-[hsl(var(--status-active))] border-[hsl(var(--status-active)/0.3)] hover:bg-[hsl(var(--status-active)/0.15)]",
  },
  [AssignmentStatus.COMPLETED]: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-[hsl(var(--status-success)/0.1)] text-[hsl(var(--status-success))] border-[hsl(var(--status-success)/0.3)] hover:bg-[hsl(var(--status-success)/0.15)]",
  },
  [AssignmentStatus.CANCELLED]: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-[hsl(var(--status-neutral)/0.1)] text-[hsl(var(--status-neutral))] border-[hsl(var(--status-neutral)/0.3)] hover:bg-[hsl(var(--status-neutral)/0.15)]",
  },
};

const priorityConfig = {
  [AssignmentPriority.LOW]: {
    label: "Low",
    icon: TrendingUp,
    className: "bg-[hsl(var(--status-neutral)/0.1)] text-[hsl(var(--status-neutral))] border-[hsl(var(--status-neutral)/0.3)]",
  },
  [AssignmentPriority.MEDIUM]: {
    label: "Medium",
    icon: TrendingUp,
    className: "bg-[hsl(var(--status-pending)/0.1)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)/0.3)]",
  },
  [AssignmentPriority.HIGH]: {
    label: "High",
    icon: AlertTriangle,
    className: "bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.3)]",
  },
  [AssignmentPriority.URGENT]: {
    label: "Urgent",
    icon: Flame,
    className: "bg-[hsl(var(--status-error)/0.1)] text-[hsl(var(--status-error))] border-[hsl(var(--status-error)/0.3)]",
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
  const finalClassName = isOverdue && status !== AssignmentStatus.COMPLETED && status !== AssignmentStatus.CANCELLED
    ? "bg-[hsl(var(--status-error)/0.1)] text-[hsl(var(--status-error))] border-[hsl(var(--status-error)/0.3)] hover:bg-[hsl(var(--status-error)/0.15)]"
    : config.className;

  const displayLabel = isOverdue && status !== AssignmentStatus.COMPLETED && status !== AssignmentStatus.CANCELLED
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
  status: AssignmentStatus;
  priority?: AssignmentPriority;
  dueDate?: Date | null;
  className?: string;
}) {
  const now = new Date();
  const isOverdue = dueDate && dueDate < now &&
    status !== AssignmentStatus.COMPLETED &&
    status !== AssignmentStatus.CANCELLED;

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