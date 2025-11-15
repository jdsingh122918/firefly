"use client";

import React, { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, AlertCircle, UserCheck, Paperclip, Tag as TagIcon, Upload, File, Image, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { NoteTypeSelector } from "./note-type-selector";
import { UserCombobox } from "./user-combobox";
import { ForumTagSelector } from "../forums/forum-tag-selector";
import { NoteType, NoteVisibility, UserRole } from "@/lib/types";

interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadProgress?: number;
  isUploading?: boolean;
}

interface FormData {
  title: string;
  content: string;
  type: NoteType;
  visibility: NoteVisibility;
  tags: string[];
  isPinned: boolean;
  allowEditing: boolean;
  createAssignment: boolean;
  assignTo: string;
}

interface NoteCreationPageProps {
  userRole: UserRole;
}

export function NoteCreationPage({ userRole }: NoteCreationPageProps) {
  const { getToken } = useAuth();
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: "",
    content: "",
    type: NoteType.JOURNAL,
    visibility: NoteVisibility.PRIVATE,
    tags: [],
    isPinned: false,
    allowEditing: true,
    createAssignment: false,
    assignTo: ""
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Handle form field changes
  const handleInputChange = useCallback((field: keyof FormData, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }, [error]);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;

    setIsUploading(true);
    const newDocuments: Document[] = [];

    try {
      const token = await getToken();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Create document entry with upload progress
        const docId = `temp-${Date.now()}-${i}`;
        const document: Document = {
          id: docId,
          filename: file.name,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          uploadProgress: 0,
          isUploading: true
        };

        newDocuments.push(document);
        setDocuments(prev => [...prev, document]);

        // Upload file
        const formData = new FormData();
        formData.append('files', file);  // Changed from 'file' to 'files'
        formData.append('category', 'notes');

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to upload ${file.name}`);
        }

        const result = await response.json();

        // Check if upload was successful and has files
        if (!result.success || !result.files || result.files.length === 0) {
          throw new Error(result.error || `Failed to upload ${file.name}`);
        }

        const uploadedFile = result.files[0];  // Get first uploaded file

        // Update document with final info
        setDocuments(prev => prev.map(doc =>
          doc.id === docId
            ? {
                ...doc,
                id: uploadedFile.fileId,  // Use fileId from API response
                filename: uploadedFile.fileName,  // Use fileName from API response
                isUploading: false,
                uploadProgress: 100
              }
            : doc
        ));
      }
    } catch (err) {
      console.error('File upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload files');
      // Remove failed uploads
      setDocuments(prev => prev.filter(doc => !doc.isUploading));
    } finally {
      setIsUploading(false);
    }
  }, [getToken]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  // Remove document
  const removeDocument = useCallback((docId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
  }, []);

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

    if (isUploading) {
      setError("Please wait for file uploads to complete");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();

      // Process tags (already an array)
      const tags = formData.tags.slice(0, 10);

      // Get document IDs from uploaded documents
      const documentIds = documents
        .filter(doc => !doc.isUploading)
        .map(doc => doc.id);

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        visibility: formData.visibility,
        tags,
        isPinned: formData.isPinned,
        documentIds
      };

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create note');
      }

      const result = await response.json();
      const createdNote = result.note || result;

      // Handle assignment creation if requested
      if (formData.createAssignment) {
        // Redirect to assignment creation with note context
        router.push(`/assignments/new?noteId=${createdNote.id}&assignTo=${formData.assignTo}`);
      } else {
        // Navigate back to notes list
        const basePath = userRole === UserRole.ADMIN ? '/admin/notes'
          : userRole === UserRole.VOLUNTEER ? '/volunteer/notes'
          : '/member/notes';
        router.push(basePath);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, getToken, documents, isUploading, userRole, router]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    const basePath = userRole === UserRole.ADMIN ? '/admin/notes'
      : userRole === UserRole.VOLUNTEER ? '/volunteer/notes'
      : '/member/notes';
    router.push(basePath);
  }, [userRole, router]);

  // Get file type icon
  const getFileIcon = useCallback((mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    return File;
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Permission checks
  const canCreateAssignments = userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Create New Note</h1>
          <p className="text-sm text-muted-foreground">
            Create a personal or shared note with attachments and assignments
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Content - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-3">
            <CardContent className="space-y-4 p-0">
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
                  className="min-h-[44px] text-lg font-medium"
                  maxLength={200}
                  disabled={isSubmitting}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {formData.title.length}/200 characters
                </div>
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
                  className="min-h-[300px] resize-y text-base leading-relaxed"
                  maxLength={10000}
                  disabled={isSubmitting}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {formData.content.length}/10,000 characters
                </div>
              </div>

              {/* Document Upload Area */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Attachments</Label>

                {/* Upload Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Upload documents, images, videos, and other files
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    className="hidden"
                    id="file-upload"
                    disabled={isSubmitting || isUploading}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={isSubmitting || isUploading}
                    className="min-h-[44px]"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Choose Files
                  </Button>
                </div>

                {/* Uploaded Documents */}
                {documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Attached Files ({documents.length})
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {documents.map((doc) => {
                        const FileIcon = getFileIcon(doc.mimeType);
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 p-3 border rounded-md bg-muted/30"
                          >
                            <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.originalName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatFileSize(doc.size)}</span>
                                {doc.isUploading && (
                                  <>
                                    <span>•</span>
                                    <span>Uploading...</span>
                                  </>
                                )}
                              </div>
                              {doc.isUploading && doc.uploadProgress !== undefined && (
                                <Progress value={doc.uploadProgress} className="h-1 mt-1" />
                              )}
                            </div>
                            {!doc.isUploading && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDocument(doc.id)}
                                disabled={isSubmitting}
                                className="text-destructive hover:text-destructive/80"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Sidebar - 1/3 width */}
        <div className="space-y-6">
          {/* Note Settings */}
          <Card className="p-3">
            <CardHeader className="space-y-2 p-0 pb-3">
              <CardTitle className="text-lg">Note Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              {/* Note Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Note Type</Label>
                <NoteTypeSelector
                  value={formData.type}
                  onChange={(value) => handleInputChange("type", value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Tags
                </Label>
                <ForumTagSelector
                  value={formData.tags}
                  onChange={(tags) => handleInputChange("tags", tags)}
                  placeholder="Add tags to categorize your note..."
                  disabled={isSubmitting}
                />
                <div className="text-xs text-muted-foreground">
                  Max 10 tags. Use "Browse" to select from healthcare system tags.
                </div>
              </div>

              {/* Visibility */}
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

              {/* Pin Note */}
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
            </CardContent>
          </Card>

          {/* Assignment Settings */}
          {canCreateAssignments && (
            <Card className="p-3">
              <CardHeader className="space-y-2 p-0 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-0">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="createAssignment"
                    checked={formData.createAssignment}
                    onCheckedChange={(checked) => handleInputChange("createAssignment", checked)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="createAssignment" className="text-sm">
                    Create task assignment
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
                        placeholder="Select user..."
                        familyFilter={userRole === UserRole.VOLUNTEER}
                        excludeCurrentUser={true}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">
                        {userRole === UserRole.VOLUNTEER
                          ? "Only users from families you manage"
                          : "Select any user to assign"
                        }
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className="w-full min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Note
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="w-full min-h-[44px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}