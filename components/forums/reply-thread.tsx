"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  MessageCircle,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  Reply,
  Paperclip,
  Eye,
  Download,
  FileText,
  Image,
  Video,
  FileAudio,
  FileIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ReplyForm } from "./reply-form"
import { formatFileSize } from "@/components/shared/format-utils"
import { ContentRenderer } from "@/components/editors/content-renderer"

interface ReplyAttachment {
  id: string
  fileId: string
  fileName: string
  originalName: string
  size: number
  mimeType: string
  url: string
}

interface Reply {
  id: string
  content: string
  depth: number
  createdAt: string
  score: number
  userVote?: "UPVOTE" | "DOWNVOTE" | null
  author: {
    id: string
    name: string
    firstName?: string
    lastName?: string
    imageUrl?: string
  }
  attachments?: ReplyAttachment[]
  children?: Reply[]
  isDeleted?: boolean
  deletedAt?: string
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

interface ReplyThreadProps {
  replies: Reply[]
  postId: string
  maxDepth?: number
  className?: string
}

interface ReplyItemProps {
  reply: Reply
  postId: string
  maxDepth: number
  onReplyUpdate?: () => void
}

function ReplyItem({ reply, postId, maxDepth, onReplyUpdate }: ReplyItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)

  const formatTimeAgo = (date: string): string => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(date))
  }

  const getAuthorName = (author: { name: string; firstName?: string; lastName?: string }) => {
    return author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown User'
  }

  const getInitials = (author: { name: string; firstName?: string; lastName?: string }) => {
    const name = getAuthorName(author)
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  // Calculate indentation - less on mobile
  const indentClass = `ml-${Math.min(reply.depth * 4, 12)} md:ml-${Math.min(reply.depth * 8, 16)}`

  if (reply.isDeleted) {
    return (
      <div className={cn("py-2", indentClass)}>
        <Card className="bg-muted/20 border-muted">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-sm italic">
              [This reply has been deleted]
            </p>
          </CardContent>
        </Card>
        {/* Still show children if they exist */}
        {reply.children && reply.children.length > 0 && (
          <div className="mt-2">
            {reply.children.map((child) => (
              <ReplyItem
                key={child.id}
                reply={child}
                postId={postId}
                maxDepth={maxDepth}
                onReplyUpdate={onReplyUpdate}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const hasChildren = reply.children && reply.children.length > 0

  return (
    <div className={cn("py-2", indentClass)}>
      <Card className="hover:bg-muted/20 transition-colors">
        <CardContent className="p-3">
          <div className="flex gap-3">
            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={reply.author?.imageUrl || ''} />
                  <AvatarFallback className="text-xs">
                    {getInitials(reply.author)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">
                  {getAuthorName(reply.author)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(reply.createdAt)}
                </span>
                <Badge variant="outline" className="text-xs">
                  Depth {reply.depth}
                </Badge>
              </div>

              {/* Content */}
              <div className={cn("mb-3", isCollapsed && "line-clamp-2")}>
                <ContentRenderer
                  content={reply.content}
                  className="text-sm"
                  preview={isCollapsed}
                  maxLength={isCollapsed ? 150 : undefined}
                />

                {/* Attachments */}
                {reply.attachments && reply.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {reply.attachments.length} attachment{reply.attachments.length !== 1 ? 's' : ''}
                    </div>
                    <div className="space-y-1">
                      {reply.attachments.map((attachment) => {
                        const FileIcon = getFileIcon(attachment.mimeType);
                        return (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-md border"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{attachment.originalName}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* View button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(attachment.url, '_blank')}
                                className="h-6 w-6 p-0"
                                title="View attachment"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              {/* Download button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = attachment.url;
                                  link.download = attachment.originalName;
                                  link.click();
                                }}
                                className="h-6 w-6 p-0"
                                title="Download attachment"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 text-xs">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-6 px-2"
                  >
                    {isCollapsed ? (
                      <>
                        <ChevronRight className="h-3 w-3 mr-1" />
                        Show {reply.children!.length} replies
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Hide replies
                      </>
                    )}
                  </Button>
                )}

                {reply.depth < maxDepth && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="h-6 px-2"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                )}
              </div>

              {/* Reply form */}
              {showReplyForm && (
                <div className="mt-3 p-3 border rounded bg-muted/10">
                  <ReplyForm
                    postId={postId}
                    parentId={reply.id}
                    onSuccess={() => {
                      setShowReplyForm(false)
                      onReplyUpdate?.()
                    }}
                    onCancel={() => setShowReplyForm(false)}
                    placeholder={`Reply to ${reply.author?.name || 'this post'}...`}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div className="mt-2">
          {reply.children!.map((child) => (
            <ReplyItem
              key={child.id}
              reply={child}
              postId={postId}
              maxDepth={maxDepth}
              onReplyUpdate={onReplyUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ReplyThread({
  replies,
  postId,
  maxDepth = 3,
  className
}: ReplyThreadProps) {
  if (!replies || replies.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No replies yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Be the first to join the conversation!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {replies.map((reply) => (
        <ReplyItem
          key={reply.id}
          reply={reply}
          postId={postId}
          maxDepth={maxDepth}
        />
      ))}
    </div>
  )
}