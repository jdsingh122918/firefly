"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Send } from "lucide-react";
import { MemberMultiCombobox } from "@/components/shared/member-multi-combobox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AssignTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceTitle: string;
  resourceDescription?: string;
  onSuccess?: () => void;
}

export function AssignTemplateModal({
  open,
  onOpenChange,
  resourceId,
  resourceTitle,
  resourceDescription,
  onSuccess,
}: AssignTemplateModalProps) {
  const { toast } = useToast();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    if (selectedMemberIds.length === 0) {
      toast({
        title: "No members selected",
        description: "Please select at least one member to assign.",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);
    try {
      const response = await fetch("/api/template-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          memberIds: selectedMemberIds,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign template");
      }

      const { assigned, skipped } = data.data;
      let description = `Successfully assigned to ${assigned} member(s).`;
      if (skipped > 0) {
        description += ` ${skipped} member(s) were already assigned.`;
      }

      toast({
        title: "Template Assigned",
        description,
      });

      // Reset form state
      setSelectedMemberIds([]);
      setNotes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Assignment Failed",
        description:
          error instanceof Error ? error.message : "Failed to assign template",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    if (!isAssigning) {
      setSelectedMemberIds([]);
      setNotes("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-[hsl(var(--ppcc-purple))]" />
            Assign Template
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Assign &quot;{resourceTitle}&quot; to members. They will receive a
            notification and can start working on the template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Template info */}
          {resourceDescription && (
            <div className="rounded-lg border bg-muted/30 backdrop-blur-sm p-3">
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {resourceDescription}
              </p>
            </div>
          )}

          {/* Member selection */}
          <div className="space-y-2.5">
            <Label htmlFor="members" className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              Select Members
            </Label>
            <MemberMultiCombobox
              resourceId={resourceId}
              value={selectedMemberIds}
              onValueChange={setSelectedMemberIds}
              placeholder="Search and select members..."
              disabled={isAssigning}
            />
            {selectedMemberIds.length > 0 && (
              <p className="text-xs text-muted-foreground pl-0.5">
                {selectedMemberIds.length} {selectedMemberIds.length === 1 ? "member" : "members"} selected
              </p>
            )}
          </div>

          {/* Optional notes */}
          <div className="space-y-2.5">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any instructions or notes for the assigned members..."
              className="min-h-[88px] resize-none text-sm"
              disabled={isAssigning}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isAssigning}
            className="min-h-[44px] flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={isAssigning || selectedMemberIds.length === 0}
            className="min-h-[44px] flex-1 sm:flex-initial"
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Assign Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
