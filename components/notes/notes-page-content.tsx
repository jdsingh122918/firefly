"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Archive,
  AlertCircle,
  Loader2
} from "lucide-react"
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
import { NoteCard } from "./note-card"
import { NoteType, NoteVisibility, UserRole } from "@/lib/types"

interface Note {
  id: string
  title: string
  content: string
  type: NoteType
  visibility: NoteVisibility
  isPinned: boolean
  isArchived: boolean
  tags: string[]
  attachments: string[]
  viewCount: number
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string
    firstName?: string
    lastName?: string
    imageUrl?: string
  }
  sharedWith?: string[]
  lastEditedBy?: string
  lastEditedAt?: string
}

interface NotesResponse {
  notes: Note[]
  total: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function NotesPageContent() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth()
  const router = useRouter()
  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || UserRole.MEMBER

  // Data state
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const [showPinned, setShowPinned] = useState<boolean | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [sortBy, setSortBy] = useState<string>("updatedAt")

  // UI state - removed modal dialog state since we now use dedicated pages

  // Filter notes client-side for quick filtering
  const filteredNotes = notes.filter((note) => {
    const matchesSearch = searchTerm === "" ||
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesType = typeFilter === "all" || note.type === typeFilter
    const matchesVisibility = visibilityFilter === "all" || note.visibility === visibilityFilter
    const matchesPinned = showPinned === null || note.isPinned === showPinned
    const matchesArchived = note.isArchived === showArchived

    return matchesSearch && matchesType && matchesVisibility && matchesPinned && matchesArchived
  })

  // Sort filtered notes
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    // Always show pinned notes first (unless filtering for non-pinned)
    if (showPinned !== false) {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
    }

    // Then sort by selected criteria
    switch (sortBy) {
      case "createdAt":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case "title":
        return a.title.localeCompare(b.title)
      case "viewCount":
        return b.viewCount - a.viewCount
      case "updatedAt":
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
  })

  // Memoize getToken to reduce dependency changes
  const getAuthToken = useCallback(async () => {
    return await getToken()
  }, [getToken])

  const fetchNotes = useCallback(async () => {
    if (!isSignedIn) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Authentication token not available')
      }

      const params = new URLSearchParams({
        page: "1",
        limit: "50",
        sortBy,
        sortOrder: "desc",
        ...(showArchived && { isArchived: "true" })
      })

      const response = await fetch(`/api/notes?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch notes: ${response.status} ${errorText}`)
      }

      const data: NotesResponse = await response.json()

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format')
      }

      setNotes(Array.isArray(data.notes) ? data.notes : [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notes'
      setError(errorMessage)
      console.error('Failed to fetch notes:', err)
      // Ensure notes is reset on error to prevent stale data
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, getAuthToken, sortBy, showArchived])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchNotes()
    }
  }, [isLoaded, isSignedIn, fetchNotes])

  // Note click handling removed - now handled by NoteCard component directly

  // Get the correct note creation URL based on user role
  const getCreateNoteUrl = () => {
    switch (userRole) {
      case UserRole.ADMIN:
        return '/admin/notes/new'
      case UserRole.VOLUNTEER:
        return '/volunteer/notes/new'
      case UserRole.MEMBER:
        return '/member/notes/new'
      default:
        return '/member/notes/new'
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-3">
        <div className="text-center">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
          <h3 className="text-sm font-semibold mb-1">Failed to load notes</h3>
          <p className="text-xs text-muted-foreground mb-2">{error}</p>
          <Button onClick={fetchNotes} variant="outline" size="sm" className="min-h-[44px]">
            Try Again
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-1">
      {/* Header with actions and search */}
      <Card className="p-3">
        <div className="space-y-2">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              <h2 className="text-lg font-semibold">
                My Notes
                {!loading && notes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filteredNotes.length} of {notes.length}
                  </Badge>
                )}
              </h2>
            </div>

            <Button asChild className="w-full md:w-auto min-h-[44px]" size="sm">
              <Link href={getCreateNoteUrl()}>
                <Plus className="mr-1 h-3 w-3" />
                Create Note
              </Link>
            </Button>
          </div>

          {/* Search and filters */}
          <div className="space-y-1">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 min-h-[44px] text-sm"
              />
            </div>

            {/* Filters row */}
            <div className="flex flex-col md:flex-row gap-1">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-36 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TEXT">Text Notes</SelectItem>
                  <SelectItem value="CHECKLIST">Checklists</SelectItem>
                  <SelectItem value="MEETING">Meeting Notes</SelectItem>
                </SelectContent>
              </Select>

              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-full md:w-36 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notes</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                  <SelectItem value="FAMILY">Family</SelectItem>
                  <SelectItem value="SHARED">Shared</SelectItem>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-40 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt">Recently Updated</SelectItem>
                  <SelectItem value="createdAt">Recently Created</SelectItem>
                  <SelectItem value="title">Title (A-Z)</SelectItem>
                  <SelectItem value="viewCount">Most Viewed</SelectItem>
                </SelectContent>
              </Select>

              {/* Toggle filters */}
              <div className="flex gap-1">
                <Button
                  variant={showPinned === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowPinned(showPinned === true ? null : true)}
                  className="min-h-[44px] px-2"
                >
                  <Pin className="mr-1 h-3 w-3" />
                  Pinned
                </Button>
                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  className="min-h-[44px] px-2"
                >
                  <Archive className="mr-1 h-3 w-3" />
                  Archived
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Notes list */}
      <div className="space-y-1">
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full max-w-md" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : sortedNotes.length === 0 ? (
          <Card className="p-3">
            <div className="text-center">
              <StickyNote className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">No notes found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm || typeFilter !== "all" || visibilityFilter !== "all" || showPinned !== null
                  ? "Try adjusting your search or filters."
                  : showArchived
                  ? "You don't have any archived notes yet."
                  : "Get started by creating your first note."
                }
              </p>
              {(!searchTerm && typeFilter === "all" && visibilityFilter === "all" && showPinned === null && !showArchived) && (
                <Button size="sm" className="mt-2 min-h-[44px]" asChild>
                  <Link href={getCreateNoteUrl()}>
                    <Plus className="mr-1 h-3 w-3" />
                    Create First Note
                  </Link>
                </Button>
              )}
            </div>
          </Card>
        ) : (
          sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              showContent={true}
            />
          ))
        )}
      </div>

    </div>
  )
}