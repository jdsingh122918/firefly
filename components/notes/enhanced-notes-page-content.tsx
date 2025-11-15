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
  Loader2,
  UserCheck
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { NoteCard } from "./note-card"
import { EnhancedNoteForm } from "./enhanced-note-form"
import { AssignmentCard } from "./assignment-card"
import { NoteType, NoteVisibility, UserRole } from "@/lib/types"

interface EnhancedNote {
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
  documents?: any[]
  structuredTags?: any[]
  assignments?: any[]
}

interface NotesResponse {
  notes: EnhancedNote[]
  total: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function EnhancedNotesPageContent() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth()
  const router = useRouter()
  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || UserRole.MEMBER

  // Data state
  const [notes, setNotes] = useState<EnhancedNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("notes")

  // Filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const [showPinned, setShowPinned] = useState<boolean | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [sortBy, setSortBy] = useState<string>("updatedAt")

  // UI state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<EnhancedNote | null>(null)

  // Permission checks
  const canCreateAssignments = userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER

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

  // Get notes with assignments for the assignments tab
  const notesWithAssignments = notes.filter(note => note.assignments && note.assignments.length > 0)

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
        includeAssignments: "true",
        includeDocuments: "true",
        includeStructuredTags: "true",
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

  const handleNoteClick = (note: EnhancedNote) => {
    try {
      // Set note for editing and open dialog
      setEditingNote(note)
      setCreateDialogOpen(true)
    } catch (err) {
      console.error('Error handling note click:', err)
      setError('Failed to open note for editing')
    }
  }

  const handleCreateSuccess = (note?: EnhancedNote) => {
    try {
      setCreateDialogOpen(false)
      setEditingNote(null) // Clear editing note
      fetchNotes() // Refresh notes list
    } catch (err) {
      console.error('Error handling create success:', err)
      setError('Note created but failed to refresh the list. Please refresh the page.')
    }
  }

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
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-red-500" />
            <h3 className="text-sm font-semibold mb-1">Failed to load notes</h3>
            <p className="text-xs text-muted-foreground mb-3">{error}</p>
            <Button onClick={fetchNotes} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with actions and search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              <CardTitle className="text-lg">
                Enhanced Notes
                {!loading && notes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {activeTab === "notes" ? filteredNotes.length : notesWithAssignments.length} of {notes.length}
                  </Badge>
                )}
              </CardTitle>
            </div>

            <Button asChild className="w-full md:w-auto" size="sm">
              <Link href={getCreateNoteUrl()}>
                <Plus className="mr-1 h-3 w-3" />
                Create Note
              </Link>
            </Button>
          </div>

          {/* Tab navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                All Notes
                {notes.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {notes.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                With Assignments
                {notesWithAssignments.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {notesWithAssignments.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search and filters */}
          {activeTab === "notes" && (
            <div className="space-y-2 pt-2">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* Filters row */}
              <div className="flex flex-col md:flex-row gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-36 h-8">
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
                  <SelectTrigger className="w-full md:w-36 h-8">
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
                  <SelectTrigger className="w-full md:w-40 h-8">
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
                    className="h-8 px-2"
                  >
                    <Pin className="mr-1 h-3 w-3" />
                    Pinned
                  </Button>
                  <Button
                    variant={showArchived ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                    className="h-8 px-2"
                  >
                    <Archive className="mr-1 h-3 w-3" />
                    Archived
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Tab content */}
      <Tabs value={activeTab} className="w-full">
        {/* Notes tab */}
        <TabsContent value="notes" className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-3 w-full max-w-md" />
                      <div className="flex gap-2">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedNotes.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center">
                <StickyNote className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
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
                  <Button asChild size="sm" className="mt-3">
                    <Link href={getCreateNoteUrl()}>
                      <Plus className="mr-1 h-3 w-3" />
                      Create First Note
                    </Link>
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
        </TabsContent>

        {/* Assignments tab */}
        <TabsContent value="assignments" className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : notesWithAssignments.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <UserCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">No notes with assignments</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {canCreateAssignments
                    ? "Create a note and add task assignments to get started."
                    : "Notes with assigned tasks will appear here."
                  }
                </p>
                {canCreateAssignments && (
                  <Button asChild size="sm" className="mt-3">
                    <Link href={getCreateNoteUrl()}>
                      <Plus className="mr-1 h-3 w-3" />
                      Create Note with Assignment
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notesWithAssignments.map((note) => (
                <Card key={note.id} className="p-3">
                  <div className="space-y-3">
                    {/* Note info */}
                    <div className="flex items-start gap-3">
                      <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm line-clamp-1 cursor-pointer hover:text-primary"
                            onClick={() => handleNoteClick(note)}>
                          {note.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {note.content.length > 100 ? `${note.content.substring(0, 100)}...` : note.content}
                        </p>
                      </div>
                    </div>

                    {/* Assignments for this note */}
                    {note.assignments && note.assignments.map((assignment: any) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        showNote={false} // Don't show note info since we're already in note context
                        className="ml-6"
                      />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Enhanced Edit Note Dialog - Only for editing existing notes */}
      {editingNote && (
        <EnhancedNoteForm
          mode="edit"
          note={editingNote}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  )
}