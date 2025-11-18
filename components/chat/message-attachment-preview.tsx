"use client";

import React from "react";
import {
  File,
  Image,
  FileText,
  Video,
  Music,
  Archive,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UploadedFile, UploadProgress } from "@/hooks/use-file-upload";

export interface MessageAttachmentPreviewProps {
  attachments: UploadedFile[];
  uploads: UploadProgress[];
  onRemoveAttachment: (fileId: string) => void;
  onRemoveUpload: (file: File) => void;
  className?: string;
}

// Helper function to get file type icon
function getFileTypeIcon(mimeType: string, size = "h-4 w-4") {
  if (mimeType.startsWith("image/")) {
    return <Image className={cn(size, "text-green-600")} />;
  }
  if (mimeType.startsWith("video/")) {
    return <Video className={cn(size, "text-purple-600")} />;
  }
  if (mimeType.startsWith("audio/")) {
    return <Music className={cn(size, "text-blue-600")} />;
  }
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) {
    return <FileText className={cn(size, "text-red-600")} />;
  }
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) {
    return <Archive className={cn(size, "text-orange-600")} />;
  }
  return <File className={cn(size, "text-muted-foreground")} />;
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
}

export function MessageAttachmentPreview({
  attachments,
  uploads,
  onRemoveAttachment,
  onRemoveUpload,
  className,
}: MessageAttachmentPreviewProps) {
  const hasAttachments = attachments.length > 0;
  const hasUploads = uploads.length > 0;

  if (!hasAttachments && !hasUploads) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Upload Progress */}
      {hasUploads && (
        <div className="space-y-1">
          {uploads.map((upload) => (
            <div
              key={upload.file.name}
              className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm border border-border/30"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {upload.status === "uploading" && (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600 flex-shrink-0" />
                )}
                {upload.status === "success" && (
                  <div className="h-3 w-3 rounded-full bg-green-600 flex-shrink-0" />
                )}
                {upload.status === "error" && (
                  <AlertTriangle className="h-3 w-3 text-red-600 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{upload.file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(upload.file.size)}
                    {upload.status === "uploading" && ` • ${upload.progress}%`}
                    {upload.status === "error" && upload.error && ` • ${upload.error}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {upload.status === "uploading" && (
                  <div className="w-16 bg-muted-foreground/20 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveUpload(upload.file)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Attachments */}
      {hasAttachments && (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.fileId}
              className="flex items-center justify-between p-2 bg-accent/30 rounded-md border border-accent/50"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getFileTypeIcon(attachment.mimeType, "h-3 w-3")}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{attachment.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveAttachment(attachment.fileId)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}