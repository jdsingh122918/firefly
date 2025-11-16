"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { Send, Loader2, Paperclip, Upload, X, Eye, Download, FileText, Image, Video, FileAudio, FileIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useFileUpload, UploadedFile } from "@/hooks/use-file-upload"
import { formatFileSize } from "@/components/shared/format-utils"
import { cn } from "@/lib/utils"

interface ReplyFormProps {
  postId: string
  parentId?: string
  onSuccess?: () => void
  onCancel?: () => void
  className?: string
  placeholder?: string
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

export function ReplyForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  className = "",
  placeholder = "Write your reply..."
}: ReplyFormProps) {
  const { getToken } = useAuth()

  // Form state
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<UploadedFile[]>([])

  // File upload
  const {
    uploadFiles,
    fetchConfig,
    config,
    isLoading: uploadLoading,
    error: uploadError
  } = useFileUpload()

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      // Add successful uploads to attachments
      if (successful.length > 0) {
        setAttachments(prev => [...prev, ...successful]);
      }

    } catch (err) {
      console.error('File upload failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    }
  }, [uploadFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFileSelect(files);
    }
    // Reset input to allow selecting same files again
    event.target.value = '';
  }, [handleFileSelect]);

  // Remove attachment
  const removeAttachment = useCallback((fileId: string) => {
    setAttachments(prev => prev.filter(file => file.fileId !== fileId));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      setError("Reply content is required")
      return
    }

    if (content.length > 10000) {
      setError("Reply content must be less than 10,000 characters")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const token = await getToken()
      const response = await fetch("/api/replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: content.trim(),
          postId,
          parentId,
          attachments: attachments.map(file => ({
            fileId: file.fileId,
            fileName: file.fileName,
            originalName: file.originalName,
            size: file.size,
            mimeType: file.mimeType,
            url: file.url
          }))
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create reply")
      }

      // Success - clear form
      setContent("")
      setAttachments([])
      onSuccess?.()

    } catch (err) {
      console.error("Error creating reply:", err)
      setError(err instanceof Error ? err.message : "Failed to create reply")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setContent("")
    setAttachments([])
    setError(null)
    onCancel?.()
  }

  const isUploading = uploadLoading;
  const displayError = error || uploadError;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={config?.allowedMimeTypes.join(',') || '*'}
        onChange={handleFileInputChange}
        className="hidden"
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none"
          disabled={isSubmitting}
          maxLength={10000}
        />

        {/* File attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Attachments ({attachments.length})
            </div>
            <div className="space-y-1">
              {attachments.map((attachment) => {
                const FileIcon = getFileIcon(attachment.mimeType);
                return (
                  <div
                    key={attachment.fileId}
                    className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.originalName}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(attachment.fileId)}
                      className="h-6 w-6 p-0"
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              {content.length}/10,000 characters
            </div>

            {/* Attach file button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFileUpload}
              disabled={isSubmitting || isUploading}
              className="h-6 w-6 p-0"
              title="Attach files"
            >
              {isUploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="min-h-[36px]"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
              className="min-h-[36px] min-w-[80px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-3 w-3" />
                  Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {displayError && (
        <Alert className="py-2">
          <AlertDescription className="text-sm">
            {displayError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}