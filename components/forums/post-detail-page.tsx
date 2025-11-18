"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  MessageSquare,
  Eye,
  Clock,
  User,
  Hash,
  Pin,
  Lock,
  AlertCircle,
  MessageCircle,
  Paperclip,
  FileIcon,
  FileText,
  Image,
  Video,
  FileAudio,
  Download
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ReplyThread } from "./reply-thread"
import { ReplyForm } from "./reply-form"
import { MessageContentRenderer } from "@/components/chat/message-content-renderer"

interface Post {
  id: string
  title: string
  content: string
  slug: string
  type: 'DISCUSSION' | 'QUESTION' | 'ANNOUNCEMENT' | 'RESOURCE' | 'POLL'
  forumId: string
  forum?: {
    id: string
    title: string
    slug: string
  }
  categoryId?: string
  isPinned: boolean
  isLocked: boolean
  viewCount: number
  replyCount: number
  score: number
  userVote?: "UPVOTE" | "DOWNVOTE" | null
  attachments?: string[]
  documents?: Array<{
    id: string
    title: string
    fileName?: string
    originalFileName?: string
    fileSize?: number
    mimeType?: string
    filePath?: string
    thumbnailPath?: string
    url?: string
  }>
  tags?: string[]
  createdAt: string
  updatedAt: string
  author: {
    id: string
    name: string
    firstName?: string
    lastName?: string
    imageUrl?: string
  }
  replies?: Reply[]
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
  children?: Reply[]
}

// Helper function to get post type display
function getPostTypeDisplay(type: string): { label: string; color: string; icon: any } {
  switch (type) {
    case "DISCUSSION":
      return { label: "Discussion", color: "bg-blue-100 text-blue-800", icon: MessageCircle }
    case "QUESTION":
      return { label: "Question", color: "bg-green-100 text-green-800", icon: MessageSquare }
    case "ANNOUNCEMENT":
      return { label: "Announcement", color: "bg-purple-100 text-purple-800", icon: Pin }
    case "RESOURCE":
      return { label: "Resource", color: "bg-orange-100 text-orange-800", icon: Hash }
    case "POLL":
      return { label: "Poll", color: "bg-pink-100 text-pink-800", icon: Hash }
    default:
      return { label: "Post", color: "bg-gray-100 text-gray-800", icon: MessageCircle }
  }
}

// Helper function to get file icon
function getFileIcon(mimeType?: string) {
  if (!mimeType) return FileIcon

  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Video
  if (mimeType.startsWith('audio/')) return FileAudio
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText

  return FileIcon
}

// Helper function to format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size'

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${Math.round(size * 10) / 10}${units[unitIndex]}`
}

export function PostDetailPage() {
  // Fixed all avatar and author property access issues with optional chaining
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth()
  const router = useRouter()
  const params = useParams()

  // Extract URL parameters
  const forumSlug = params.slug as string
  const postSlug = params.postSlug as string

  // State
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get user role for navigation
  const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
  const rolePrefix = userRole.toLowerCase()

  // Fetch post data
  const fetchPost = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return

    try {
      setLoading(true)
      setError(null)

      const token = await getToken()

      // Get forum by slug using the new by-slug endpoint
      const forumResponse = await fetch(`/api/forums/by-slug/${encodeURIComponent(forumSlug)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!forumResponse.ok) {
        throw new Error('Forum not found')
      }

      const forumData = await forumResponse.json()
      const forum = forumData.forum

      if (!forum) {
        throw new Error('Forum not found')
      }

      // Get posts for this forum
      const postsResponse = await fetch(`/api/posts?forumId=${forum.id}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!postsResponse.ok) {
        throw new Error('Failed to fetch posts')
      }

      const postsData = await postsResponse.json()
      const foundPost = postsData.posts?.find((p: any) => p.slug === postSlug)

      if (!foundPost) {
        throw new Error('Post not found')
      }

      // Now get the full post details with replies
      const postDetailResponse = await fetch(`/api/posts/${foundPost.id}?includeReplies=true&includeVotes=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!postDetailResponse.ok) {
        throw new Error('Failed to fetch post details')
      }

      const postDetailData = await postDetailResponse.json()
      console.log('🔍 Post detail API response:', {
        postDetailData,
        post: postDetailData.post,
        author: postDetailData.post?.author,
        authorName: postDetailData.post?.author?.name
      })
      setPost({ ...postDetailData.post, forum })

    } catch (err) {
      console.error('Error fetching post:', err)
      setError(err instanceof Error ? err.message : 'Failed to load post')
    } finally {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, getToken, forumSlug, postSlug])

  // Load post on mount
  useEffect(() => {
    fetchPost()
  }, [fetchPost])


  // Loading state
  if (!isLoaded || !isSignedIn || loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-3/4" />
            <div className="flex space-x-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${rolePrefix}/forums/${forumSlug}`)}
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to Forum
        </Button>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}. <button onClick={fetchPost} className="underline font-medium">Try again</button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // No post state
  if (!post) {
    return (
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${rolePrefix}/forums/${forumSlug}`)}
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to Forum
        </Button>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Post not found.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const typeDisplay = getPostTypeDisplay(post.type)
  const TypeIcon = typeDisplay.icon

  // Debug post object when rendering
  console.log('🎯 Rendering post:', {
    post,
    author: post?.author,
    authorName: post?.author?.name
  })

  return (
    <div className="space-y-3">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-1 text-xs text-muted-foreground">
        <Link
          href={`/${userRole}/forums`}
          className="hover:text-foreground transition-colors"
        >
          Forums
        </Link>
        <span>›</span>
        <Link
          href={`/${userRole}/forums/${forumSlug}`}
          className="hover:text-foreground transition-colors"
        >
          {post.forum?.title}
        </Link>
        <span>›</span>
        <span className="text-foreground font-medium truncate">
          {post.title}
        </span>
      </nav>

      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        asChild
      >
        <Link href={`/${rolePrefix}/forums/${forumSlug}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {post.forum?.title}
        </Link>
      </Button>

      {/* Post Content */}
      <Card>
        <CardHeader className="pb-3">
          {/* Post Header */}
          <div className="flex items-start">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground mb-2 leading-tight">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                {/* Post Type Badge */}
                <Badge className={cn(typeDisplay.color, "flex items-center gap-1 text-xs px-2 py-1")}>
                  <TypeIcon className="h-3 w-3" />
                  {typeDisplay.label}
                </Badge>

                {/* Pin/Lock badges */}
                {post.isPinned && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </Badge>
                )}
                {post.isLocked && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}

                {/* Tags */}
                {(post.tags || []).map((tag) => (
                  <Badge key={tag} variant="outline">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Author and Metadata */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center space-x-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={post.author?.imageUrl || ''} alt={post.author?.name || 'Unknown'} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-sm">{post.author?.name || 'Unknown Author'}</div>
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(post.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {post.replyCount} replies
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* Post Content */}
          <div className="mt-4 text-foreground prose prose-sm max-w-none">
            <MessageContentRenderer content={post.content} />
          </div>

          {/* Document Attachments */}
          {post.documents && post.documents.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments ({post.documents.length})
              </h4>
              <div className="space-y-2">
                {post.documents.map((doc) => {
                  const FileIconComponent = getFileIcon(doc.mimeType)
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileIconComponent className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h5 className="font-medium text-sm truncate">{doc.title}</h5>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(doc.fileSize)}</span>
                            {doc.fileName && (
                              <>
                                <span>•</span>
                                <span className="truncate">{doc.originalFileName || doc.fileName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {doc.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="flex-shrink-0"
                        >
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            <span className="sr-only">Download {doc.title}</span>
                          </a>
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium text-sm mb-2">Attachments</h4>
              <div className="space-y-2">
                {post.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Hash className="h-4 w-4" />
                    <span className="text-sm">{attachment}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply to Post Form */}
      {!post.isLocked && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Reply to this post
            </h3>
          </CardHeader>
          <CardContent className="pt-0">
            <ReplyForm
              postId={post.id}
              onSuccess={fetchPost}
              placeholder="Share your thoughts on this post..."
            />
          </CardContent>
        </Card>
      )}

      {/* Replies Section */}
      {post.replies && post.replies.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 py-2">
            <MessageCircle className="h-4 w-4" />
            <h2 className="text-base font-semibold">Replies ({post.replyCount})</h2>
          </div>

          <ReplyThread
            replies={post.replies}
            postId={post.id}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-6">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <h3 className="font-medium text-sm mb-1">No replies yet</h3>
              <p className="text-xs">Be the first to reply to this post!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}