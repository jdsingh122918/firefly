"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Plus,
  Search,
  SortDesc,
  Pin,
  Clock,
  TrendingUp,
  MessageCircle,
  Globe,
  Lock,
  UsersRound
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PostCard } from "./post-card"

interface Forum {
  id: string
  title: string
  description?: string
  slug: string
  visibility: 'PUBLIC' | 'FAMILY' | 'PRIVATE'
  postCount: number
  memberCount: number
  lastActivityAt?: string
  creator?: {
    name: string
  }
  createdAt: string
}

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

interface ForumDetailContentProps {
  forumSlug: string
}

const visibilityIcons = {
  PUBLIC: Globe,
  FAMILY: UsersRound,
  PRIVATE: Lock,
}

const visibilityLabels = {
  PUBLIC: "Public",
  FAMILY: "Family Only",
  PRIVATE: "Private",
}

export function ForumDetailContent({ forumSlug }: ForumDetailContentProps) {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth()
  const router = useRouter()

  // Get user role for routing
  const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
  const rolePrefix = userRole.toLowerCase()

  const [forum, setForum] = useState<Forum | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<string>("pinned")

  // Filter and sort posts
  const filteredPosts = posts.filter((post) => {
    if (!searchTerm) return true
    return post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           post.content?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    // Always show pinned posts first
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1

    // Then sort by selected criteria
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case "mostReplies":
        return b.replyCount - a.replyCount
      case "mostViews":
        return b.viewCount - a.viewCount
      case "topScore":
        return b.score - a.score
      case "lastActivity":
        return new Date(b.lastReplyAt || b.createdAt).getTime() -
               new Date(a.lastReplyAt || a.createdAt).getTime()
      default: // "pinned" or fallback
        return new Date(b.lastReplyAt || b.createdAt).getTime() -
               new Date(a.lastReplyAt || a.createdAt).getTime()
    }
  })

  const fetchForumAndPosts = useCallback(async () => {
    if (!isSignedIn) return

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()

      // Fetch forum details by slug
      const forumResponse = await fetch(`/api/forums/by-slug/${forumSlug}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!forumResponse.ok) {
        throw new Error('Forum not found')
      }

      const forumData = await forumResponse.json()

      if (!forumData.forum) {
        throw new Error('Forum not found')
      }

      setForum(forumData.forum)

      // Fetch posts for this forum
      const postsResponse = await fetch(`/api/posts?forumId=${forumData.forum.id}&includeReplies=true&sortBy=pinned`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (postsResponse.ok) {
        const postsData = await postsResponse.json()
        setPosts(postsData.posts || [])
      } else {
        setPosts([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forum')
      console.error('Failed to fetch forum and posts:', err)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, getToken, forumSlug])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchForumAndPosts()
    }
  }, [isLoaded, isSignedIn, fetchForumAndPosts])

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

  if (!isLoaded || !isSignedIn) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Forum Not Found</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild variant="outline">
              <Link href={`/${((sessionClaims?.metadata as { role?: string })?.role || 'member').toLowerCase()}/forums`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Forums
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading || !forum) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const VisibilityIcon = visibilityIcons[forum.visibility]

  return (
    <div className="space-y-2">
      {/* Back navigation */}
      <Button variant="ghost" asChild className="w-fit">
        <Link href={`/${((sessionClaims?.metadata as { role?: string })?.role || 'member').toLowerCase()}/forums`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Forums
        </Link>
      </Button>

      {/* Forum header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{forum.title}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <VisibilityIcon className="h-3 w-3" />
                      {visibilityLabels[forum.visibility]}
                    </Badge>
                  </div>
                </div>
              </div>

              {forum.description && (
                <p className="text-muted-foreground max-w-3xl">
                  {forum.description}
                </p>
              )}
            </div>

            <Button asChild>
              <Link href={`/${rolePrefix}/forums/${forum.slug}/posts/new`}>
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>{forum.postCount} posts</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{forum.memberCount} members</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                Created {formatTimeAgo(forum.createdAt)}
                {forum.creator && ` by ${forum.creator.name}`}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search and controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pinned">
                  <div className="flex items-center gap-2">
                    <Pin className="h-4 w-4" />
                    Pinned & Recent
                  </div>
                </SelectItem>
                <SelectItem value="lastActivity">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Recent Activity
                  </div>
                </SelectItem>
                <SelectItem value="topScore">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Top Rated
                  </div>
                </SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="mostReplies">Most Replies</SelectItem>
                <SelectItem value="mostViews">Most Views</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Posts list */}
      <div className="space-y-3">
        {sortedPosts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No posts found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm
                  ? "Try adjusting your search term."
                  : "Be the first to start a discussion in this forum!"
                }
              </p>
              {!searchTerm && forum && (
                <Button asChild className="mt-4">
                  <Link href={`/${rolePrefix}/forums/${forum.slug}/posts/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Post
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sortedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumSlug={forum.slug}
              showContent={false}
            />
          ))
        )}
      </div>
    </div>
  )
}