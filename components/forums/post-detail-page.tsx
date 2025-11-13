"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  MessageSquare,
  Eye,
  ThumbsUp,
  Clock,
  User,
  Hash,
  Pin,
  Lock,
  AlertCircle,
  MessageCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VoteButtons } from "./vote-buttons"
import { ReplyThread } from "./reply-thread"
import { ReplyForm } from "./reply-form"

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
  attachments: string[]
  tags: string[]
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

export function PostDetailPage() {
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

  // Fetch post data
  const fetchPost = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return

    try {
      setLoading(true)
      setError(null)

      const token = await getToken()

      // First, we need to get the post by slug. For now, let's use the forum endpoint to find posts
      // We'll use the forum detail endpoint to get posts, then find the matching slug
      const forumResponse = await fetch(`/api/forums?search=${encodeURIComponent(forumSlug)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!forumResponse.ok) {
        throw new Error('Failed to fetch forum')
      }

      const forumsData = await forumResponse.json()
      const forum = forumsData.forums?.[0]

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
      setPost({ ...postDetailData, forum })

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

  // Handle vote success
  const handleVoteSuccess = () => {
    fetchPost() // Refresh to get updated vote counts
  }

  // Loading state
  if (!isLoaded || !isSignedIn || loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <div className="flex space-x-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Alert className="max-w-2xl">
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
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Alert className="max-w-2xl">
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

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
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
      </div>

      {/* Back Button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${userRole}/forums/${forumSlug}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {post.forum?.title}
        </Button>
      </div>

      {/* Post Content */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          {/* Post Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground mb-2 leading-tight">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {/* Post Type Badge */}
                <Badge className={cn(typeDisplay.color, "flex items-center gap-1")}>
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
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Vote Buttons */}
            <div className="flex-shrink-0">
              <VoteButtons
                itemId={post.id}
                itemType="post"
                initialScore={post.score}
                initialUserVote={post.userVote}
                className="flex-col gap-1"
              />
            </div>
          </div>

          {/* Author and Metadata */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.author.imageUrl} alt={post.author.name} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-sm">{post.author.name}</div>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
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
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.viewCount} views
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.replyCount} replies
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Post Content */}
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-foreground">
              {post.content}
            </div>
          </div>

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
          <CardHeader>
            <h3 className="text-lg font-medium flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Reply to this post
            </h3>
          </CardHeader>
          <CardContent>
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
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Replies ({post.replyCount})
          </h2>

          <div className="space-y-4">
            <ReplyThread
              replies={post.replies}
              postId={post.id}
            />
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">No replies yet</h3>
              <p className="text-sm">Be the first to reply to this post!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}