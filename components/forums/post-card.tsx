"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import {
  MessageSquare,
  Calendar,
  User,
  Pin,
  Lock,
  Tag,
  ArrowRight,
  Paperclip
} from "lucide-react"
import {
  getPostTypeConfig,
  getPostTypeBadgeClasses,
  getPostTypeCardClasses,
  getLegacyPostTypeColors
} from "@/lib/forum/post-types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PostModerationActions } from "./post-moderation-actions"

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
  onUpdate?: () => void
}

// Enhanced Post Type Badge Component
interface PostTypeBadgeProps {
  type: string
  size?: "sm" | "md" | "lg"
  showIcon?: boolean
}

const PostTypeBadge = ({ type, size = "sm", showIcon = true }: PostTypeBadgeProps) => {
  const config = getPostTypeConfig(type)
  const Icon = config.icon

  return (
    <div className={getPostTypeBadgeClasses(type, size)}>
      {showIcon && <Icon className={cn(
        "shrink-0",
        size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5"
      )} />}
      <span>{config.label}</span>
    </div>
  )
}

const getPostCardColors = (post: Post) => {
  // Priority 1: Healthcare tags (highest priority)
  if (post.tags && post.tags.length > 0) {
    const tag = post.tags[0].toLowerCase();
    if (tag.includes('medical') || tag.includes('health')) {
      return {
        border: 'border-l-[var(--healthcare-medical)]',
        background: 'bg-pink-50 dark:bg-pink-950/20',
        hover: 'hover:bg-pink-100 dark:hover:bg-pink-950/30'
      };
    }
    if (tag.includes('mental')) {
      return {
        border: 'border-l-[var(--healthcare-mental)]',
        background: 'bg-purple-50 dark:bg-purple-950/20',
        hover: 'hover:bg-purple-100 dark:hover:bg-purple-950/30'
      };
    }
    if (tag.includes('home') || tag.includes('community')) {
      return {
        border: 'border-l-[var(--healthcare-home)]',
        background: 'bg-teal-50 dark:bg-teal-950/20',
        hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
      };
    }
    if (tag.includes('equipment') || tag.includes('technology') || tag.includes('tool')) {
      return {
        border: 'border-l-[var(--healthcare-equipment)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    }
    if (tag.includes('basic') || tag.includes('resources') || tag.includes('support')) {
      return {
        border: 'border-l-[var(--healthcare-basic)]',
        background: 'bg-orange-50 dark:bg-orange-950/20',
        hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
      };
    }
    if (tag.includes('education') || tag.includes('family') || tag.includes('training')) {
      return {
        border: 'border-l-[var(--healthcare-education)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      };
    }
    if (tag.includes('legal') || tag.includes('advocacy')) {
      return {
        border: 'border-l-[var(--healthcare-legal)]',
        background: 'bg-gray-50 dark:bg-gray-950/20',
        hover: 'hover:bg-gray-100 dark:hover:bg-gray-950/30'
      };
    }
  }

  // Priority 2: Enhanced post type styling
  if (post.type) {
    return getLegacyPostTypeColors(post.type);
  }

  // Priority 3: Post states (pinned gets special treatment)
  if (post.isPinned) {
    return {
      border: 'border-l-[var(--ppcc-orange)]',
      background: 'bg-orange-50 dark:bg-orange-950/20',
      hover: 'hover:bg-orange-100 dark:hover:bg-orange-950/30'
    };
  }

  // Default fallback for regular posts
  return {
    border: 'border-l-[var(--healthcare-home)]',
    background: 'bg-teal-50 dark:bg-teal-950/20',
    hover: 'hover:bg-teal-100 dark:hover:bg-teal-950/30'
  };
}

export function PostCard({
  post,
  forumSlug,
  onPostClick,
  showContent = false,
  className,
  onUpdate
}: PostCardProps) {
  const router = useRouter()
  const { sessionClaims, userId } = useAuth()
  const cardColors = getPostCardColors(post)

  // Check if current user is the author
  const isAuthor = userId ? post.author.id === userId : false

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
        "border-l-4 transition-colors cursor-pointer group",
        cardColors.border,
        cardColors.background,
        cardColors.hover,
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
              <PostTypeBadge type={post.type} />
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

          {/* Moderation Actions / Arrow */}
          <div className="flex-shrink-0 mt-1 flex items-center gap-2">
            <PostModerationActions
              postId={post.id}
              isPinned={post.isPinned}
              isLocked={post.isLocked}
              isAuthor={isAuthor}
              onUpdate={onUpdate}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}