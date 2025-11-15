"use client";

import React, { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Save, Loader2, AlertCircle, UserCheck, Paperclip, Tag as TagIcon } from "lucide-react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NoteTypeSelector } from "./note-type-selector";
import { SharePermissionToggle } from "./share-permission-toggle";
import { DocumentAttachmentManager } from "./document-attachment-manager";
import { StructuredTagSelector } from "./structured-tag-selector";
import { AssignmentForm } from "./assignment-form";
import { UserCombobox } from "./user-combobox";
import { NoteType, NoteVisibility, UserRole } from "@/lib/types";

interface EnhancedNote {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  visibility: NoteVisibility;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  attachments: any[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  };
  sharedWith?: string[];
  lastEditedBy?: string;
  lastEditedAt?: string;
  documents?: any[];
  structuredTags?: any[];
  assignments?: any[];
}

interface EnhancedNoteFormProps {
  mode: "create" | "edit";
  note?: EnhancedNote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (note?: EnhancedNote) => void;
  className?: string;
}

interface FormData {
  title: string;
  content: string;
  type: NoteType;
  visibility: NoteVisibility;
  tags: string;
  isPinned: boolean;
  allowEditing: boolean;
  createAssignment: boolean;
  assignTo: string;
}

export function EnhancedNoteForm({
  mode,
  note,
  open,
  onOpenChange,
  onSuccess,
  className = ""
}: EnhancedNoteFormProps) {
  const { getToken, sessionClaims } = useAuth();
  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || UserRole.MEMBER;

  // Form state
  const [formData, setFormData] = useState<FormData>(() => ({
    title: note?.title || "",
    content: note?.content || "",
    type: note?.type || NoteType.TEXT,
    visibility: note?.visibility || NoteVisibility.PRIVATE,
    tags: note?.tags?.join(", ") || "",
    isPinned: note?.isPinned || false,
    allowEditing: mode === "create" ? true : false,
    createAssignment: false,
    assignTo: ""
  }));

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [savedNote, setSavedNote] = useState<EnhancedNote | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);

  // Enhanced data state for edit mode
  const [documents, setDocuments] = useState(note?.documents || []);
  const [structuredTags, setStructuredTags] = useState(note?.structuredTags || []);
  const [simpleTags, setSimpleTags] = useState<string[]>(note?.tags || []);

  // Handle form field changes
  const handleInputChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }, [error]);

  // Validate form
  const validateForm = useCallback((): string | null => {
    if (!formData.title.trim()) {
      return "Note title is required";
    }
    if (formData.title.length > 200) {
      return "Title must be less than 200 characters";
    }
    if (!formData.content.trim()) {
      return "Note content is required";
    }
    if (formData.content.length > 10000) {
      return "Content must be less than 10,000 characters";
    }
    if (formData.createAssignment && !formData.assignTo) {
      return "Please select a user to assign the task to";
    }
    return null;
  }, [formData]);

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
      const url = mode === "create"
        ? "/api/notes"
        : `/api/notes/${note!.id}`;

      const method = mode === "create" ? "POST" : "PUT";

      // Process tags
      const tags = formData.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 10);

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        visibility: formData.visibility,
        tags,
        isPinned: formData.isPinned,
      };

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
        throw new Error(errorData.error || `Failed to ${mode} note`);
      }

      const result = await response.json();
      const createdNote = result.note || result;
      setSavedNote(createdNote);

      // If creating assignment, open assignment dialog
      if (formData.createAssignment && mode === "create") {
        setAssignmentDialogOpen(true);
      } else {
        // Complete success
        onSuccess?.(createdNote);
        onOpenChange(false);
      }

      // Reset form for create mode (unless creating assignment)
      if (mode === "create" && !formData.createAssignment) {
        setFormData({
          title: "",
          content: "",
          type: NoteType.TEXT,
          visibility: NoteVisibility.PRIVATE,
          tags: "",
          isPinned: false,
          allowEditing: true,
          createAssignment: false,
          assignTo: ""
        });
        setDocuments([]);
        setStructuredTags([]);
        setSimpleTags([]);
      }
    } catch (err) {
      console.error(`Failed to ${mode} note:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${mode} note`);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, getToken, mode, note, onSuccess, onOpenChange]);

  // Handle assignment creation success
  const handleAssignmentSuccess = useCallback((assignment: any) => {
    setAssignmentDialogOpen(false);
    onSuccess?.(savedNote || undefined);
    onOpenChange(false);

    // Reset form
    setFormData({
      title: "",
      content: "",
      type: NoteType.TEXT,
      visibility: NoteVisibility.PRIVATE,
      tags: "",
      isPinned: false,
      allowEditing: true,
      createAssignment: false,
      assignTo: ""
    });
    setDocuments([]);
    setStructuredTags([]);
    setSimpleTags([]);
    setSavedNote(null);
  }, [savedNote, onSuccess, onOpenChange]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    if (assignmentDialogOpen) {
      setAssignmentDialogOpen(false);
      return;
    }
    onOpenChange(false);
  }, [isSubmitting, assignmentDialogOpen, onOpenChange]);

  // Permission checks
  const canCreateAssignments = userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER;

  return (
    <>
      <Dialog open={open && !assignmentDialogOpen} onOpenChange={handleClose}>
        <DialogContent className={`max-w-4xl max-h-[90vh] overflow-hidden ${className}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === "create" ? "Create New Note" : "Edit Note"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="attachments" disabled={mode === "create"}>
                  <Paperclip className="h-3 w-3 mr-1" />
                  Documents
                  {documents.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {documents.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tags" disabled={mode === "create"}>
                  <TagIcon className="h-3 w-3 mr-1" />
                  Tags
                  {(structuredTags.length + simpleTags.length) > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {structuredTags.length + simpleTags.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="assignment" disabled={!canCreateAssignments || mode === "edit"}>
                  <UserCheck className="h-3 w-3 mr-1" />
                  Assignment
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4">
                {/* Error Alert */}
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Basic Info Tab */}
                <TabsContent value="basic" className="space-y-4 mt-0">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium">
                      Title *
                    </Label>
                    <Input
                      id="title"
                      placeholder="Enter note title..."
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      className="min-h-[44px]"
                      maxLength={200}
                      disabled={isSubmitting}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {formData.title.length}/200 characters
                    </div>
                  </div>

                  {/* Note Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Note Type</Label>
                    <NoteTypeSelector
                      value={formData.type}
                      onChange={(value) => handleInputChange("type", value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <Label htmlFor="content" className="text-sm font-medium">
                      Content *
                    </Label>
                    <Textarea
                      id="content"
                      placeholder="Write your note content here..."
                      value={formData.content}
                      onChange={(e) => handleInputChange("content", e.target.value)}
                      className="min-h-[120px] max-h-[300px] resize-y"
                      maxLength={10000}
                      disabled={isSubmitting}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {formData.content.length}/10,000 characters
                    </div>
                  </div>

                  {/* Simple Tags */}
                  <div className="space-y-2">
                    <Label htmlFor="tags" className="text-sm font-medium">
                      Tags
                    </Label>
                    <Input
                      id="tags"
                      placeholder="Enter tags separated by commas..."
                      value={formData.tags}
                      onChange={(e) => handleInputChange("tags", e.target.value)}
                      className="min-h-[44px]"
                      disabled={isSubmitting}
                    />
                    <div className="text-xs text-muted-foreground">
                      Separate multiple tags with commas. Maximum 10 tags.
                    </div>
                  </div>

                  {/* Visibility & Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="visibility" className="text-sm font-medium">
                        Who can see this note
                      </Label>
                      <select
                        id="visibility"
                        value={formData.visibility}
                        onChange={(e) => handleInputChange("visibility", e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 border border-input bg-background rounded-md text-sm"
                        disabled={isSubmitting}
                      >
                        <option value={NoteVisibility.PRIVATE}>Private (Only me)</option>
                        <option value={NoteVisibility.FAMILY}>Family Members</option>
                        <option value={NoteVisibility.SHARED}>Shared Users</option>
                        <option value={NoteVisibility.PUBLIC}>Everyone</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="pinned"
                          checked={formData.isPinned}
                          onCheckedChange={(checked) => handleInputChange("isPinned", checked)}
                          disabled={isSubmitting}
                        />
                        <Label htmlFor="pinned" className="text-sm">
                          Pin this note
                        </Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Documents Tab (Edit mode only) */}
                <TabsContent value="attachments" className="mt-0">
                  {note?.id ? (
                    <DocumentAttachmentManager
                      noteId={note.id}
                      attachments={documents}
                      onAttachmentsChange={setDocuments}
                      readOnly={isSubmitting}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          Save the note first to manage document attachments.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tags Tab (Edit mode only) */}
                <TabsContent value="tags" className="mt-0">
                  {note?.id ? (
                    <StructuredTagSelector
                      noteId={note.id}
                      currentTags={structuredTags}
                      simpleTags={simpleTags}
                      onTagsChange={(newStructured, newSimple) => {
                        setStructuredTags(newStructured);
                        setSimpleTags(newSimple);
                      }}
                      readOnly={isSubmitting}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          Save the note first to manage structured tags.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Assignment Tab (Create mode only) */}
                <TabsContent value="assignment" className="mt-0">
                  {canCreateAssignments ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <UserCheck className="h-5 w-5" />
                          Create Task Assignment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="createAssignment"
                            checked={formData.createAssignment}
                            onCheckedChange={(checked) => handleInputChange("createAssignment", checked)}
                            disabled={isSubmitting}
                          />
                          <Label htmlFor="createAssignment" className="text-sm">
                            Create assignment after saving note
                          </Label>
                        </div>

                        {formData.createAssignment && (
                          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Assign To *
                              </Label>
                              <UserCombobox
                                value={formData.assignTo}
                                onValueChange={(value) => handleInputChange("assignTo", value || "")}
                                placeholder="Select user to assign task..."
                                familyFilter={userRole === UserRole.VOLUNTEER}
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

                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                After saving this note, you'll be able to set the priority, due date, and additional notes for the assignment.
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <UserCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm font-medium">Assignment Creation Restricted</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Only administrators and volunteers can create task assignments.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </div>
            </Tabs>
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
                  {mode === "create" ? "Create Note" : "Save Changes"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Creation Dialog */}
      {assignmentDialogOpen && savedNote && (
        <AssignmentForm
          mode="create"
          noteId={savedNote.id}
          noteTitle={savedNote.title}
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          onSuccess={handleAssignmentSuccess}
        />
      )}
    </>
  );
}