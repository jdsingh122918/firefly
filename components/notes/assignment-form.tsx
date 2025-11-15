"use client";

import React, { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { CalendarIcon, Save, Loader2, AlertCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserCombobox } from "./user-combobox";
import { NoteCombobox } from "./note-combobox";
import { AssignmentStatusBadge, AssignmentPriorityBadge } from "./assignment-status-badge";
import { formatTimeAgo } from "@/components/shared/format-utils";
import { cn } from "@/lib/utils";
import {
  NoteAssignmentStatus,
  AssignmentPriority,
  UserRole,
  NoteAssignment
} from "@/lib/types";

interface AssignmentFormProps {
  mode: "create" | "edit";
  noteId?: string;
  noteTitle?: string;
  assignment?: NoteAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (assignment: NoteAssignment) => void;
  className?: string;
}

interface FormData {
  selectedNoteId?: string; // For create mode when note needs to be selected
  assignedTo: string;
  priority: AssignmentPriority;
  dueDate: Date | null;
  notes: string;
  status?: NoteAssignmentStatus; // Only for edit mode
}

export function AssignmentForm({
  mode,
  noteId,
  noteTitle,
  assignment,
  open,
  onOpenChange,
  onSuccess,
  className = ""
}: AssignmentFormProps) {
  const { getToken, sessionClaims } = useAuth();
  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || UserRole.MEMBER;

  // Form state
  const [formData, setFormData] = useState<FormData>(() => ({
    selectedNoteId: noteId || "",
    assignedTo: assignment?.assignedTo || "",
    priority: assignment?.priority || AssignmentPriority.MEDIUM,
    dueDate: assignment?.dueDate ? new Date(assignment.dueDate) : null,
    notes: assignment?.notes || "",
    status: assignment?.status,
  }));

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Handle form field changes
  const handleInputChange = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null); // Clear error when user starts typing
  }, [error]);

  // Validate form
  const validateForm = useCallback((): string | null => {
    // Check if we have a valid note ID in create mode
    if (mode === "create" && !noteId && !formData.selectedNoteId) {
      return "Please select a note to create an assignment for";
    }
    if (!formData.assignedTo) {
      return "Please select a user to assign this task to";
    }
    if (formData.notes.length > 500) {
      return "Notes must be less than 500 characters";
    }
    return null;
  }, [formData, mode, noteId]);

  // Submit form
  const handleSubmit = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();

      let url: string;
      let method: string;
      let payload: any;

      if (mode === "create") {
        const targetNoteId = noteId || formData.selectedNoteId;
        if (!targetNoteId) {
          throw new Error("Note ID is required for creating assignments");
        }
        url = `/api/notes/${targetNoteId}/assignments`;
        method = "POST";
        payload = {
          assignedTo: formData.assignedTo,
          priority: formData.priority,
          dueDate: formData.dueDate?.toISOString(),
          notes: formData.notes.trim() || undefined,
        };
      } else {
        if (!assignment?.id) {
          throw new Error("Assignment ID is required for editing");
        }
        url = `/api/assignments/${assignment.id}`;
        method = "PATCH";
        payload = {
          priority: formData.priority,
          dueDate: formData.dueDate?.toISOString(),
          notes: formData.notes.trim() || undefined,
          ...(formData.status && formData.status !== assignment.status && {
            status: formData.status
          })
        };
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${mode} assignment`);
      }

      const result = await response.json();
      const updatedAssignment = result.assignment || result;

      // Success
      onSuccess?.(updatedAssignment);
      onOpenChange(false);

      // Reset form for create mode
      if (mode === "create") {
        setFormData({
          assignedTo: "",
          priority: AssignmentPriority.MEDIUM,
          dueDate: null,
          notes: "",
        });
      }
    } catch (err) {
      console.error(`Failed to ${mode} assignment:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${mode} assignment`);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, getToken, mode, noteId, assignment, onSuccess, onOpenChange]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (isSubmitting) return; // Prevent closing during submission
    onOpenChange(false);
  }, [isSubmitting, onOpenChange]);

  // Permission checks
  const canCreateAssignments = userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER;
  const canEditStatus = assignment && (
    // Assignee can update status
    assignment.assignedTo === formData.assignedTo ||
    // Assigner can update
    userRole === UserRole.ADMIN ||
    userRole === UserRole.VOLUNTEER
  );

  if (!canCreateAssignments && mode === "create") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Permission Required
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Only administrators and volunteers can create task assignments.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} className="min-h-[44px]">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isOverdue = formData.dueDate && formData.dueDate < new Date() &&
    assignment?.status !== NoteAssignmentStatus.COMPLETED &&
    assignment?.status !== NoteAssignmentStatus.CANCELLED;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${className}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {mode === "create" ? "Create Assignment" : "Edit Assignment"}
          </DialogTitle>
          {noteTitle && (
            <p className="text-sm text-muted-foreground mt-1">
              For note: <span className="font-medium">{noteTitle}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Status (Edit mode only) */}
          {mode === "edit" && assignment && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Current Status:</span>
                  <AssignmentStatusBadge
                    status={assignment.status}
                    priority={assignment.priority}
                    isOverdue={!!isOverdue}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Created {formatTimeAgo(assignment.createdAt)}
                </div>
              </div>
            </div>
          )}

          {/* Select Note (when noteId not provided) */}
          {mode === "create" && !noteId && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Note *
              </Label>
              <NoteCombobox
                value={formData.selectedNoteId}
                onValueChange={(value) => handleInputChange("selectedNoteId", value || "")}
                placeholder="Search and select a note..."
                excludeArchived={true}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Search for the note you want to create an assignment for.
              </p>
            </div>
          )}

          {/* Assign To User */}
          {mode === "create" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Assign To *
              </Label>
              <UserCombobox
                value={formData.assignedTo}
                onValueChange={(value) => handleInputChange("assignedTo", value || "")}
                placeholder="Select user to assign task..."
                familyFilter={userRole === UserRole.VOLUNTEER} // VOLUNTEER sees only family members
                excludeCurrentUser={true}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                {userRole === UserRole.VOLUNTEER
                  ? "You can only assign tasks to members of families you manage"
                  : "Select any user to assign this task to"
                }
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Priority</Label>
            <div className="flex items-center gap-3">
              <Select
                value={formData.priority}
                onValueChange={(value) => handleInputChange("priority", value as AssignmentPriority)}
              >
                <SelectTrigger className="w-40 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AssignmentPriority.LOW}>Low</SelectItem>
                  <SelectItem value={AssignmentPriority.MEDIUM}>Medium</SelectItem>
                  <SelectItem value={AssignmentPriority.HIGH}>High</SelectItem>
                  <SelectItem value={AssignmentPriority.URGENT}>Urgent</SelectItem>
                </SelectContent>
              </Select>
              <AssignmentPriorityBadge priority={formData.priority} />
            </div>
          </div>

          {/* Status (Edit mode only) */}
          {mode === "edit" && canEditStatus && assignment && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex items-center gap-3">
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value as NoteAssignmentStatus)}
                >
                  <SelectTrigger className="w-40 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NoteAssignmentStatus.ASSIGNED}>Assigned</SelectItem>
                    <SelectItem value={NoteAssignmentStatus.IN_PROGRESS}>In Progress</SelectItem>
                    <SelectItem value={NoteAssignmentStatus.COMPLETED}>Completed</SelectItem>
                    <SelectItem value={NoteAssignmentStatus.CANCELLED}>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                {formData.status && (
                  <AssignmentStatusBadge
                    status={formData.status}
                    isOverdue={!!isOverdue}
                  />
                )}
              </div>
            </div>
          )}

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Due Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full min-h-[44px] justify-start text-left font-normal",
                    !formData.dueDate && "text-muted-foreground",
                    isOverdue && "border-red-300 text-red-700"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.dueDate ? (
                    <span>
                      {formData.dueDate.toLocaleDateString()}
                      {isOverdue && " (Overdue)"}
                    </span>
                  ) : (
                    "Set due date (optional)"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.dueDate || undefined}
                  onSelect={(date) => {
                    handleInputChange("dueDate", date || null);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                />
                {formData.dueDate && (
                  <div className="p-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleInputChange("dueDate", null);
                        setCalendarOpen(false);
                      }}
                      className="w-full"
                    >
                      Clear Date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes or instructions..."
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              className="min-h-[80px] max-h-[120px] resize-y"
              maxLength={500}
              disabled={isSubmitting}
            />
            <div className="text-xs text-muted-foreground text-right">
              {formData.notes.length}/500 characters
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col md:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-[44px] order-2 md:order-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-h-[44px] order-1 md:order-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "create" ? "Creating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === "create" ? "Create Assignment" : "Save Changes"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}