"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
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
import { NoteForm } from "./note-form"
import { NoteType, NoteVisibility } from "@/lib/types"

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

  // UI state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)

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

  const handleNoteClick = (note: Note) => {
    try {
      // Set note for editing and open dialog
      setEditingNote(note)
      setCreateDialogOpen(true)
    } catch (err) {
      console.error('Error handling note click:', err)
      setError('Failed to open note for editing')
    }
  }

  const handleCreateSuccess = () => {
    try {
      setCreateDialogOpen(false)
      setEditingNote(null) // Clear editing note
      fetchNotes() // Refresh notes list
    } catch (err) {
      console.error('Error handling create success:', err)
      setError('Note created but failed to refresh the list. Please refresh the page.')
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
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Failed to load notes</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchNotes} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions and search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <StickyNote className="h-6 w-6" />
              <CardTitle className="text-xl">
                My Notes
                {!loading && notes.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredNotes.length} of {notes.length}
                  </Badge>
                )}
              </CardTitle>
            </div>

            <Button
              className="w-full md:w-auto min-h-[44px]"
              onClick={() => {
              setEditingNote(null) // Ensure we're in create mode
              setCreateDialogOpen(true)
            }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Note
            </Button>
          </div>

          {/* Search and filters */}
          <div className="space-y-4 pt-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>

            {/* Filters row */}
            <div className="flex flex-col md:flex-row gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-48 min-h-[44px]">
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
                <SelectTrigger className="w-full md:w-48 min-h-[44px]">
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
                <SelectTrigger className="w-full md:w-48 min-h-[44px]">
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
              <div className="flex gap-2">
                <Button
                  variant={showPinned === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowPinned(showPinned === true ? null : true)}
                  className="min-h-[44px]"
                >
                  <Pin className="mr-2 h-3 w-3" />
                  Pinned
                </Button>
                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  className="min-h-[44px]"
                >
                  <Archive className="mr-2 h-3 w-3" />
                  Archived
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Notes list */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-md" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedNotes.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <StickyNote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No notes found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm || typeFilter !== "all" || visibilityFilter !== "all" || showPinned !== null
                  ? "Try adjusting your search or filters."
                  : showArchived
                  ? "You don't have any archived notes yet."
                  : "Get started by creating your first note."
                }
              </p>
              {(!searchTerm && typeFilter === "all" && visibilityFilter === "all" && showPinned === null && !showArchived) && (
                <Button className="mt-4 min-h-[44px]" onClick={() => {
                  setEditingNote(null) // Ensure we're in create mode
                  setCreateDialogOpen(true)
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Note
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onNoteClick={handleNoteClick}
              showContent={true}
            />
          ))
        )}
      </div>

      {/* Create/Edit Note Dialog */}
      <NoteForm
        mode={editingNote ? "edit" : "create"}
        note={editingNote || undefined}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}