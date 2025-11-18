"use client"

import React from 'react'
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
  CheckCircle2,
  Paperclip,
  Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UploadedFile, UploadProgress } from '@/hooks/use-file-upload'

// File type utilities
export function getFileTypeIcon(mimeType: string, size = 'h-4 w-4') {
  if (mimeType.startsWith('image/')) {
    return <Image className={cn(size, 'text-green-600')} />
  }
  if (mimeType.startsWith('video/')) {
    return <Video className={cn(size, 'text-purple-600')} />
  }
  if (mimeType.startsWith('audio/')) {
    return <Music className={cn(size, 'text-blue-600')} />
  }
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
    return <FileText className={cn(size, 'text-red-600')} />
  }
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) {
    return <Archive className={cn(size, 'text-orange-600')} />
  }
  return <File className={cn(size, 'text-muted-foreground')} />
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`
}

// Upload progress display variants
type ProgressVariant = 'bar' | 'text' | 'minimal'
type Layout = 'list' | 'grid' | 'compact'
type Size = "default" | "icon" | "sm" | "lg" | "icon-sm" | "icon-lg"

export interface FileUploadPreviewProps {
  // Data
  attachments?: UploadedFile[]
  uploads?: UploadProgress[]

  // Callbacks
  onRemoveAttachment?: (id: string | File) => void
  onRemoveUpload?: (id: string | File) => void

  // Display options
  layout?: Layout
  size?: Size
  progressVariant?: ProgressVariant
  showFileTypes?: boolean
  showSizes?: boolean
  showStatus?: boolean

  // Upload trigger
  showUploadButton?: boolean
  onUploadClick?: () => void
  uploadButtonText?: string
  uploadButtonIcon?: React.ReactNode
  disabled?: boolean

  // Styling
  className?: string
  title?: string
  emptyStateText?: string
}

// Individual file item component
interface FileItemProps {
  file: UploadedFile | UploadProgress
  type: 'attachment' | 'upload'
  onRemove?: (id: string | File) => void
  layout: Layout
  size: Size
  progressVariant: ProgressVariant
  showFileTypes: boolean
  showSizes: boolean
  showStatus: boolean
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  type,
  onRemove,
  layout,
  size,
  progressVariant,
  showFileTypes,
  showSizes,
  showStatus
}) => {
  const isUpload = type === 'upload'
  const upload = isUpload ? (file as UploadProgress) : null
  const attachment = !isUpload ? (file as UploadedFile) : null

  const fileName = isUpload ? upload!.file.name : attachment!.fileName
  const fileSize = isUpload ? upload!.file.size : attachment!.size
  const mimeType = isUpload ? upload!.file.type : attachment!.mimeType
  const fileId = isUpload ? upload!.file : attachment!.fileId

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return layout === 'compact' ? 'p-1.5 text-xs' : 'p-2 text-sm'
      case 'default':
        return layout === 'compact' ? 'p-2 text-sm' : 'p-3 text-sm'
      case 'lg':
        return layout === 'compact' ? 'p-2.5 text-sm' : 'p-4 text-base'
      default:
        return 'p-2 text-sm'
    }
  }

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3'
      case 'default':
        return 'h-4 w-4'
      case 'lg':
        return 'h-5 w-5'
      default:
        return 'h-4 w-4'
    }
  }

  const getStatusIcon = () => {
    if (!isUpload || !showStatus) return null

    switch (upload!.status) {
      case 'uploading':
        return <Loader2 className={cn(getIconSize(), 'animate-spin text-blue-600 flex-shrink-0')} />
      case 'success':
        return <CheckCircle2 className={cn(getIconSize(), 'text-green-600 flex-shrink-0')} />
      case 'error':
        return <AlertTriangle className={cn(getIconSize(), 'text-red-600 flex-shrink-0')} />
      default:
        return null
    }
  }

  const getBackgroundClass = () => {
    if (isUpload) {
      switch (upload!.status) {
        case 'uploading':
          return 'bg-blue-50/50 border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-800/30'
        case 'success':
          return 'bg-green-50/50 border-green-200/50 dark:bg-green-950/20 dark:border-green-800/30'
        case 'error':
          return 'bg-red-50/50 border-red-200/50 dark:bg-red-950/20 dark:border-red-800/30'
        default:
          return 'bg-muted/30 border-border/30'
      }
    }
    return 'bg-accent/30 border-accent/50'
  }

  const renderProgressBar = () => {
    if (!isUpload || upload!.status !== 'uploading' || progressVariant === 'text') return null

    if (progressVariant === 'minimal') {
      return (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted-foreground/20">
          <div
            className="bg-blue-600 h-0.5 transition-all duration-300"
            style={{ width: `${upload!.progress}%` }}
          />
        </div>
      )
    }

    return (
      <div className="w-16 bg-muted-foreground/20 rounded-full h-1">
        <div
          className="bg-blue-600 h-1 rounded-full transition-all duration-300"
          style={{ width: `${upload!.progress}%` }}
        />
      </div>
    )
  }

  const renderFileInfo = () => {
    const statusText = isUpload && upload!.status === 'uploading'
      ? `${upload!.progress}%`
      : isUpload && upload!.status === 'error' && upload!.error
      ? upload!.error
      : null

    return (
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{fileName}</div>
        {(showSizes || statusText) && (
          <div className="text-xs text-muted-foreground">
            {showSizes && formatFileSize(fileSize)}
            {showSizes && statusText && ' • '}
            {statusText}
          </div>
        )}
      </div>
    )
  }

  const handleRemove = () => {
    if (onRemove) {
      onRemove(fileId)
    }
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-between rounded-md border transition-colors',
        getSizeClasses(),
        getBackgroundClass(),
        layout === 'grid' && 'flex-col items-start gap-2'
      )}
    >
      <div className={cn(
        'flex items-center gap-2 min-w-0 flex-1',
        layout === 'grid' && 'w-full'
      )}>
        {showStatus && getStatusIcon()}
        {showFileTypes && getFileTypeIcon(mimeType, getIconSize())}
        {renderFileInfo()}
      </div>

      <div className={cn(
        'flex items-center gap-2 flex-shrink-0',
        layout === 'grid' && 'w-full justify-between'
      )}>
        {renderProgressBar()}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className={cn(
            'text-muted-foreground hover:text-destructive',
            size === 'sm' ? 'h-5 w-5 p-0' : 'h-6 w-6 p-0'
          )}
        >
          <X className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        </Button>
      </div>

      {progressVariant === 'minimal' && renderProgressBar()}
    </div>
  )
}

// Main component
export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
  attachments = [],
  uploads = [],
  onRemoveAttachment,
  onRemoveUpload,
  layout = 'list',
  size = 'default',
  progressVariant = 'bar',
  showFileTypes = true,
  showSizes = true,
  showStatus = true,
  showUploadButton = false,
  onUploadClick,
  uploadButtonText = 'Upload files',
  uploadButtonIcon,
  disabled = false,
  className,
  title,
  emptyStateText = 'No files attached'
}) => {
  const hasAttachments = attachments.length > 0
  const hasUploads = uploads.length > 0
  const hasAnyFiles = hasAttachments || hasUploads

  const getLayoutClasses = () => {
    switch (layout) {
      case 'grid':
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'
      case 'compact':
        return 'flex flex-wrap gap-1'
      default:
        return 'space-y-2'
    }
  }

  const renderUploadButton = () => {
    if (!showUploadButton || !onUploadClick) return null

    return (
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={onUploadClick}
        disabled={disabled}
        className="w-full"
      >
        {uploadButtonIcon || <Upload className="h-4 w-4 mr-2" />}
        {uploadButtonText}
      </Button>
    )
  }

  const renderEmptyState = () => {
    if (hasAnyFiles) return null

    return (
      <div className="text-center py-6 text-muted-foreground">
        <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{emptyStateText}</p>
        {renderUploadButton()}
      </div>
    )
  }

  const renderFileList = () => {
    if (!hasAnyFiles) return renderEmptyState()

    return (
      <div className={getLayoutClasses()}>
        {/* Upload Progress Items */}
        {uploads.map((upload) => (
          <FileItem
            key={upload.file.name + upload.file.lastModified}
            file={upload}
            type="upload"
            onRemove={onRemoveUpload}
            layout={layout}
            size={size}
            progressVariant={progressVariant}
            showFileTypes={showFileTypes}
            showSizes={showSizes}
            showStatus={showStatus}
          />
        ))}

        {/* Completed Attachment Items */}
        {attachments.map((attachment) => (
          <FileItem
            key={attachment.fileId}
            file={attachment}
            type="attachment"
            onRemove={onRemoveAttachment}
            layout={layout}
            size={size}
            progressVariant={progressVariant}
            showFileTypes={showFileTypes}
            showSizes={showSizes}
            showStatus={showStatus}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Title and Upload Button */}
      {(title || (showUploadButton && hasAnyFiles)) && (
        <div className="flex items-center justify-between">
          {title && (
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {title}
                {hasAnyFiles && ` (${attachments.length + uploads.length})`}
              </span>
            </div>
          )}
          {showUploadButton && hasAnyFiles && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onUploadClick}
              disabled={disabled}
            >
              {uploadButtonIcon || <Paperclip className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}

      {/* File List */}
      {renderFileList()}
    </div>
  )
}