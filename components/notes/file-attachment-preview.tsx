"use client"

import React from "react"
import {
  FileIcon,
  Download,
  X,
  ImageIcon,
  FileTextIcon,
  VideoIcon,
  FileAudio,
  Paperclip
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatFileSize } from "@/components/shared/format-utils"

// Simple attachment interface for MVP
interface Attachment {
  id: string
  name: string
  size?: number
  type?: string
  url?: string
  thumbnailUrl?: string
}

interface FileAttachmentPreviewProps {
  attachments: string[] | Attachment[]
  onRemove?: (attachmentId: string) => void
  onDownload?: (attachment: Attachment) => void
  showCount?: boolean
  maxDisplay?: number
  className?: string
}

// Get appropriate icon for file type
function getFileIcon(type?: string) {
  if (!type) return FileIcon

  if (type.startsWith('image/')) return ImageIcon
  if (type.startsWith('video/')) return VideoIcon
  if (type.startsWith('audio/')) return FileAudio
  if (type.includes('pdf') || type.includes('document')) return FileTextIcon

  return FileIcon
}

// Simple count badge for MVP (when attachments are just strings)
export function FileAttachmentCount({
  attachments,
  className = ""
}: {
  attachments: string[] | Attachment[]
  className?: string
}) {
  const count = attachments.length

  if (count === 0) return null

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Paperclip className="h-4 w-4 text-muted-foreground" />
      <Badge variant="secondary" className="text-xs">
        {count} {count === 1 ? "file" : "files"}
      </Badge>
    </div>
  )
}

// Full attachment preview for detailed views
export function FileAttachmentPreview({
  attachments,
  onRemove,
  onDownload,
  showCount = false,
  maxDisplay = 3,
  className = ""
}: FileAttachmentPreviewProps) {
  // Handle both string[] and Attachment[] formats
  const attachmentList: Attachment[] = attachments.map((att, index) => {
    if (typeof att === 'string') {
      return {
        id: `${index}`,
        name: att,
        url: att
      }
    }
    return att
  })

  if (attachmentList.length === 0) return null

  // Show count only for MVP
  if (showCount || !onRemove) {
    return <FileAttachmentCount attachments={attachmentList} className={className} />
  }

  const displayAttachments = attachmentList.slice(0, maxDisplay)
  const remainingCount = attachmentList.length - maxDisplay

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {attachmentList.length} {attachmentList.length === 1 ? "attachment" : "attachments"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {displayAttachments.map((attachment) => {
          const Icon = getFileIcon(attachment.type)

          return (
            <Card key={attachment.id} className="p-0">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {attachment.name}
                      </p>
                      {attachment.size && (
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {onDownload && attachment.url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDownload(attachment)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-3 w-3" />
                        <span className="sr-only">Download {attachment.name}</span>
                      </Button>
                    )}

                    {onRemove && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(attachment.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove {attachment.name}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {remainingCount > 0 && (
        <div className="text-center">
          <Badge variant="outline" className="text-xs">
            +{remainingCount} more {remainingCount === 1 ? "file" : "files"}
          </Badge>
        </div>
      )}
    </div>
  )
}

// Simple inline attachment indicator for card views
export function InlineAttachmentIndicator({
  count,
  className = ""
}: {
  count: number
  className?: string
}) {
  if (count === 0) return null

  return (
    <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
      <Paperclip className="h-3 w-3" />
      <span>{count}</span>
    </div>
  )
}

// File upload placeholder button for MVP
export function FileUploadPlaceholder({
  onUploadClick,
  disabled = false,
  className = ""
}: {
  onUploadClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      variant="outline"
      onClick={onUploadClick}
      disabled={disabled}
      className={`min-h-[44px] ${className}`}
    >
      <Paperclip className="mr-2 h-4 w-4" />
      Add Files
      <Badge variant="secondary" className="ml-2">
        Coming Soon
      </Badge>
    </Button>
  )
}