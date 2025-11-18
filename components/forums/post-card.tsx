"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import {
  MessageSquare,
  Calendar,
  User,
  Eye,
  Pin,
  Lock,
  Tag,
  ArrowRight,
  Paperclip
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Post {
  id: string
  title: string
  content?: string
  slug: string
  type: string
  isPinned: boolean
  isLocked: boolean
  viewCount: number
  replyCount: number
  score: number
  upvoteCount: number
  downvoteCount: number
  userVote?: "UPVOTE" | "DOWNVOTE" | null
  tags?: string[]
  documents?: Array<{
    id: string
    title: string
    fileSize?: number
    mimeType?: string
  }>
  createdAt: string
  lastReplyAt?: string
  author: {
    id: string
    name: string
    firstName?: string
    lastName?: string
    imageUrl?: string
  }
  lastReplyBy?: {
    name: string
    firstName?: string
    lastName?: string
  }
}

interface PostCardProps {
  post: Post
  forumSlug: string
  onPostClick?: (post: Post) => void
  showContent?: boolean
  className?: string
}

const postTypeColors = {
  DISCUSSION: "bg-blue-100 text-blue-800",
  QUESTION: "bg-purple-100 text-purple-800",
  ANNOUNCEMENT: "bg-red-100 text-red-800",
  RESOURCE: "bg-green-100 text-green-800",
  POLL: "bg-yellow-100 text-yellow-800"
}

const postTypeLabels = {
  DISCUSSION: "Discussion",
  QUESTION: "Question",
  ANNOUNCEMENT: "Announcement",
  RESOURCE: "Resource",
  POLL: "Poll"
}

export function PostCard({
  post,
  forumSlug,
  onPostClick,
  showContent = false,
  className
}: PostCardProps) {
  const router = useRouter()
  const { sessionClaims } = useAuth()

  const handleClick = () => {
    if (onPostClick) {
      onPostClick(post)
    } else {
      // Get user role for dynamic routing
      const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
      const rolePrefix = userRole.toLowerCase()
      router.push(`/${rolePrefix}/forums/${forumSlug}/posts/${post.slug}`)
    }
  }

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

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md hover:bg-muted/50 cursor-pointer",
        post.isPinned && "border-l-4 border-l-orange-500",
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        <div className="flex gap-2">
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header with badges */}
            <div className="flex flex-wrap items-center gap-1 mb-1">
              {post.isPinned && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
              {post.isLocked && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Locked
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn("text-xs", postTypeColors[post.type as keyof typeof postTypeColors] || "bg-gray-100 text-gray-800")}
              >
                {postTypeLabels[post.type as keyof typeof postTypeLabels] || post.type}
              </Badge>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-primary transition-colors">
              {post.title}
            </h3>

            {/* Content preview */}
            {showContent && post.content && (
              <div className="mb-3">
                <div className="text-muted-foreground text-sm line-clamp-3">
                  {post.content.length > 200
                    ? post.content.substring(0, 200).replace(/\s+$/, '') + '...'
                    : post.content
                  }
                </div>
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {post.tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    <Tag className="h-2 w-2 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {post.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{post.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Author and stats */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={post.author.imageUrl} />
                  <AvatarFallback className="text-xs">
                    {getInitials(post.author)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">
                  {getAuthorName(post.author)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatTimeAgo(post.createdAt)}</span>
              </div>

              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{post.replyCount} replies</span>
              </div>

              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{post.viewCount} views</span>
              </div>

              {post.documents && post.documents.length > 0 && (
                <div className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  <span>{post.documents.length} file{post.documents.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Last reply info */}
            {post.lastReplyAt && post.lastReplyBy && (
              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                Last reply {formatTimeAgo(post.lastReplyAt)} by{' '}
                <span className="font-medium">
                  {getAuthorName(post.lastReplyBy)}
                </span>
              </div>
            )}
          </div>

          {/* Arrow */}
          <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1 hidden sm:block" />
        </div>
      </CardContent>
    </Card>
  )
}