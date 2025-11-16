"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  Paperclip,
  Upload,
  X,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  FileIcon,
  FileText,
  Image,
  Video,
  FileAudio,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { formatFileSize } from "@/components/shared/format-utils";
import { cn } from "@/lib/utils";

interface DocumentAttachment {
  id: string;
  documentId: string;
  source: "UPLOAD" | "LIBRARY";
  order: number;
  attachedAt: string;
  attachedBy: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  document: {
    id: string;
    title: string;
    filename?: string;
    description?: string;
    contentType?: string;
    size?: number;
    url?: string;
    thumbnailUrl?: string;
  };
}

interface DocumentAttachmentManagerProps {
  noteId: string;
  attachments: DocumentAttachment[];
  onAttachmentsChange?: (attachments: DocumentAttachment[]) => void;
  readOnly?: boolean;
  className?: string;
}

// Get appropriate icon for file type
function getFileIcon(contentType?: string) {
  if (!contentType) return FileIcon;

  if (contentType.startsWith('image/')) return Image;
  if (contentType.startsWith('video/')) return Video;
  if (contentType.startsWith('audio/')) return FileAudio;
  if (contentType.includes('pdf') || contentType.includes('document')) return FileText;

  return FileIcon;
}

export function DocumentAttachmentManager({
  noteId,
  attachments,
  onAttachmentsChange,
  readOnly = false,
  className
}: DocumentAttachmentManagerProps) {
  const { getToken } = useAuth();

  // File upload hook
  const {
    uploadFiles,
    fetchConfig,
    config,
    isLoading: uploadLoading,
    uploads,
    hasActiveUploads,
    error: uploadError
  } = useFileUpload();

  // UI state
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch upload config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Handle file upload
  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      // Upload files to storage
      const { successful, failed } = await uploadFiles(fileArray, {
        category: 'documents'
      });

      if (failed.length > 0) {
        console.warn('Some files failed to upload:', failed);
        setError(`${failed.length} file(s) failed to upload: ${failed.map(f => f.error).join(', ')}`);
      }

      // Create document records and attach to note
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Process successful uploads into attachment format
      const newAttachments = successful.map((uploadedFile, index) => ({
        id: uploadedFile.fileId,
        documentId: uploadedFile.fileId,
        source: "UPLOAD" as const,
        order: (attachments?.length || 0) + index,
        attachedAt: new Date().toISOString(),
        attachedBy: {
          id: '', // Will be filled by parent component
          email: ''
        },
        document: {
          id: uploadedFile.fileId,
          title: uploadedFile.originalName,
          filename: uploadedFile.fileName,
          contentType: uploadedFile.mimeType,
          size: uploadedFile.size
        }
      }));

      // Update attachments with new uploads
      if (onAttachmentsChange && newAttachments.length > 0) {
        const updatedAttachments = [...(attachments || []), ...newAttachments];
        onAttachmentsChange(updatedAttachments);
      }

    } catch (err) {
      console.error('File upload failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  }, [uploadFiles, getToken, noteId, attachments?.length || 0, onAttachmentsChange]);

  // Handle file input change
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFileSelect(files);
    }
    // Reset input to allow selecting same files again
    event.target.value = '';
  }, [handleFileSelect]);


  // Handle document removal
  const handleRemoveAttachment = useCallback(async (attachmentId: string, documentId: string) => {
    setRemovingId(attachmentId);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/notes/${noteId}/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove attachment');
      }

      const result = await response.json();
      if (result.documents) {
        onAttachmentsChange?.(result.documents);
      }

    } catch (err) {
      console.error('Failed to remove attachment:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove attachment');
    } finally {
      setRemovingId(null);
    }
  }, [getToken, noteId, onAttachmentsChange]);

  // Handle document download/view
  const handleDocumentAction = useCallback((attachment: DocumentAttachment, action: 'view' | 'download') => {
    if (attachment.document.url) {
      if (action === 'download') {
        // Create download link
        const link = document.createElement('a');
        link.href = attachment.document.url;
        link.download = attachment.document.filename || attachment.document.title;
        link.click();
      } else {
        // Open in new tab
        window.open(attachment.document.url, '_blank');
      }
    }
  }, []);

  const sortedAttachments = [...attachments].sort((a, b) => a.order - b.order);

  // Combined loading state
  const isUploading = uploading || uploadLoading || hasActiveUploads;

  // Combined error state
  const displayError = error || uploadError;

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files && files.length > 0 && !readOnly && !isUploading) {
      handleFileSelect(files);
    }
  }, [readOnly, isUploading, handleFileSelect]);

  return (
    <TooltipProvider>
      <div
        className={cn("space-y-3", className)}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={config?.allowedMimeTypes.join(',') || '*'}
          onChange={handleFileInputChange}
          className="hidden"
        />
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attachments
            {attachments.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {attachments.length}
              </Badge>
            )}
          </h3>

          {/* Add attachment buttons */}
          {!readOnly && (
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFileUpload}
                    disabled={isUploading}
                    className="h-8 px-2"
                  >
                    {isUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    <span className="sr-only">Upload Files</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Upload new files</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Error alert */}
        {displayError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}

        {/* Attachments list */}
        {sortedAttachments.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center">
              <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">No attachments</p>
              <p className="text-xs text-muted-foreground mt-1">
                {readOnly
                  ? "This note doesn't have any attached documents."
                  : "Add documents to provide supporting materials for this note."
                }
              </p>
              {!readOnly && (
                <div className="flex gap-2 justify-center mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFileUpload}
                    disabled={isUploading}
                    className="h-8"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-1 h-3 w-3" />
                        Upload Files
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sortedAttachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.document?.contentType);
              const isRemoving = removingId === attachment.id;

              return (
                <Card key={attachment.id} className="transition-opacity duration-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* Document info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm truncate">
                            {attachment.document?.title || 'Untitled'}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {attachment.document?.size && (
                              <span>{formatFileSize(attachment.document.size)}</span>
                            )}
                            <Badge
                              variant="outline"
                              className="text-xs px-1 py-0 bg-green-50 text-green-700 border-green-200"
                            >
                              Upload
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {/* View button */}
                        {attachment.document.url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDocumentAction(attachment, 'view')}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-3 w-3" />
                                <span className="sr-only">View document</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View document</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Download button */}
                        {attachment.document.url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDocumentAction(attachment, 'download')}
                                className="h-8 w-8 p-0"
                              >
                                <Download className="h-3 w-3" />
                                <span className="sr-only">Download document</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Download document</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Remove button */}
                        {!readOnly && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveAttachment(attachment.id, attachment.documentId)}
                                disabled={isRemoving}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                {isRemoving ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                <span className="sr-only">Remove attachment</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove attachment</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      </div>
    </TooltipProvider>
  );
}