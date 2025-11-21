"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import {
  MessageSquare,
  Users,
  Calendar,
  Plus,
  Search,
  Filter,
  ArrowRight,
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
import Link from "next/link"

interface Forum {
  id: string
  title: string
  description?: string
  slug: string
  visibility: 'PUBLIC' | 'FAMILY' | 'PRIVATE'
  postCount: number
  memberCount: number
  lastActivityAt?: string
  lastPostBy?: {
    name: string
    firstName?: string
    lastName?: string
  }
  creator?: {
    id: string
    name: string
  }
  createdAt: string
  isMember?: boolean
  isCreator?: boolean
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

const visibilityColors = {
  PUBLIC: "text-green-600",
  FAMILY: "text-blue-600",
  PRIVATE: "text-orange-600",
}

/**
 * Main forums page component
 * Shows list of forums with search, filtering, and creation capabilities
 */
export function ForumsPageContent() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth()
  const router = useRouter()

  const [forums, setForums] = useState<Forum[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("lastActivity")
  const [joiningForum, setJoiningForum] = useState<string | null>(null)
  const [leavingForum, setLeavingForum] = useState<string | null>(null)

  // Get user role from session claims or default to member
  const userRole = ((sessionClaims?.metadata as { role?: string })?.role || 'member').toLowerCase()

  // Filter forums based on current filters
  const filteredForums = forums.filter((forum) => {
    const matchesSearch = searchTerm === "" ||
      forum.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      forum.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesVisibility = visibilityFilter === "all" ||
      forum.visibility === visibilityFilter

    return matchesSearch && matchesVisibility
  })

  // Sort forums
  const sortedForums = [...filteredForums].sort((a, b) => {
    switch (sortBy) {
      case "lastActivity":
        return new Date(b.lastActivityAt || b.createdAt).getTime() -
               new Date(a.lastActivityAt || a.createdAt).getTime()
      case "posts":
        return b.postCount - a.postCount
      case "members":
        return b.memberCount - a.memberCount
      case "alphabetical":
        return a.title.localeCompare(b.title)
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      default:
        return 0
    }
  })

  const fetchForums = useCallback(async () => {
    if (!isSignedIn) return

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch('/api/forums', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch forums')
      }

      const data = await response.json()
      setForums(data.forums || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forums')
      console.error('Failed to fetch forums:', err)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchForums()
    }
  }, [isLoaded, isSignedIn, fetchForums])

  const handleForumClick = (forum: Forum) => {
    // Get user role for dynamic routing
    const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
    const rolePrefix = userRole.toLowerCase()
    router.push(`/${rolePrefix}/forums/${forum.slug}`)
  }

  const handleJoinForum = async (forumId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent forum navigation

    if (!isSignedIn || joiningForum === forumId) return

    setJoiningForum(forumId)

    try {
      const token = await getToken()
      const response = await fetch(`/api/forums/${forumId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to join forum')
      }

      const data = await response.json()

      // Update forum in local state
      setForums(prev => prev.map(forum =>
        forum.id === forumId
          ? {
              ...forum,
              isMember: true,
              memberCount: data.forum.memberCount
            }
          : forum
      ))

      console.log("✅ Successfully joined forum:", data.forum.title)
    } catch (err) {
      console.error("❌ Failed to join forum:", err)
      setError(err instanceof Error ? err.message : 'Failed to join forum')
    } finally {
      setJoiningForum(null)
    }
  }

  const handleLeaveForum = async (forumId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent forum navigation

    if (!isSignedIn || leavingForum === forumId) return

    setLeavingForum(forumId)

    try {
      const token = await getToken()
      const response = await fetch(`/api/forums/${forumId}/join`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to leave forum')
      }

      const data = await response.json()

      // Update forum in local state
      setForums(prev => prev.map(forum =>
        forum.id === forumId
          ? {
              ...forum,
              isMember: false,
              memberCount: data.forum.memberCount
            }
          : forum
      ))

      console.log("✅ Successfully left forum:", data.forum.title)
    } catch (err) {
      console.error("❌ Failed to leave forum:", err)
      setError(err instanceof Error ? err.message : 'Failed to leave forum')
    } finally {
      setLeavingForum(null)
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

  if (!isLoaded || !isSignedIn) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <MessageSquare className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load forums</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button
              onClick={fetchForums}
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with actions and search */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <CardTitle className="text-lg">
                Forums
                {forums.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {forums.length}
                  </Badge>
                )}
              </CardTitle>
            </div>

            <Button asChild className="w-full md:w-auto" size="sm">
              <Link href={`/${userRole}/forums/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Create Forum
              </Link>
            </Button>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col md:flex-row gap-3 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search forums..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forums</SelectItem>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="FAMILY">Family Only</SelectItem>
                <SelectItem value="PRIVATE">Private</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastActivity">Recent Activity</SelectItem>
                <SelectItem value="posts">Most Posts</SelectItem>
                <SelectItem value="members">Most Members</SelectItem>
                <SelectItem value="alphabetical">A-Z</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Forums list */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-full max-w-md" />
                      <div className="flex gap-4">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedForums.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-base font-medium">No forums found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm || visibilityFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Get started by creating your first forum."
                }
              </p>
              {(!searchTerm && visibilityFilter === "all") && (
                <Button asChild className="mt-4" size="sm">
                  <Link href={`/${userRole}/forums/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Forum
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sortedForums.map((forum) => {
            const VisibilityIcon = visibilityIcons[forum.visibility]
            return (
              <Card
                key={forum.id}
                className="transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => handleForumClick(forum)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title and badges row */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-base truncate">
                            {forum.title}
                          </h3>

                          {/* Membership Status Badge */}
                          {forum.isMember && (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                              Member
                            </Badge>
                          )}

                          {/* Creator Badge */}
                          {forum.isCreator && (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">
                              Creator
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Visibility Badge */}
                          <Badge variant="outline" className="flex items-center gap-1 text-xs px-2 py-0.5">
                            <VisibilityIcon className="h-3 w-3" />
                            {visibilityLabels[forum.visibility]}
                          </Badge>

                          {/* Join/Leave Button */}
                          {!forum.isCreator && (
                            forum.isMember ? (
                              // Only show Leave button for PRIVATE forums
                              forum.visibility === 'PRIVATE' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs px-3 py-1 h-7"
                                  disabled={leavingForum === forum.id}
                                  onClick={(e) => handleLeaveForum(forum.id, e)}
                                >
                                  {leavingForum === forum.id ? "Leaving..." : "Leave"}
                                </Button>
                              )
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                className="text-xs px-3 py-1 h-7"
                                disabled={joiningForum === forum.id}
                                onClick={(e) => handleJoinForum(forum.id, e)}
                              >
                                {joiningForum === forum.id ? "Joining..." : "Join"}
                              </Button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {forum.description && (
                        <p className="text-muted-foreground text-sm line-clamp-1 mb-2">
                          {forum.description}
                        </p>
                      )}

                      {/* Stats row */}
                      <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{forum.postCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          <span>{forum.memberCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {forum.lastActivityAt
                              ? formatTimeAgo(forum.lastActivityAt)
                              : formatTimeAgo(forum.createdAt)
                            }
                          </span>
                        </div>
                        {forum.lastPostBy && (
                          <div className="hidden sm:flex text-xs text-muted-foreground/80">
                            •&nbsp;{forum.lastPostBy.name || `${forum.lastPostBy.firstName} ${forum.lastPostBy.lastName}`.trim()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

    </div>
  )
}