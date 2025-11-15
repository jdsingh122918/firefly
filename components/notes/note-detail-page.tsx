"use client"

import React, { useState, useCallback, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Loader2, AlertCircle, Pin, Archive, Eye, Calendar, Share, Tag as TagIcon, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NoteTypeSelector } from "./note-type-selector"
import { DocumentAttachmentManager } from "./document-attachment-manager"
import { formatTimeAgo, getAuthorDisplay } from "@/components/shared/format-utils"
import { NoteType, NoteVisibility, UserRole } from "@/lib/types"

interface Document {
  id: string
  fileName: string
  originalFileName: string
  mimeType: string
  fileSize: number
  title?: string
  type?: string
}

interface Note {
  id: string
  title: string
  content: string
  type: NoteType
  visibility: NoteVisibility
  isPinned: boolean
  isArchived: boolean
  tags: string[]
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
  documents?: Document[]
  lastEditedBy?: string
  lastEditedAt?: string
}

interface NoteDetailPageProps {
  noteId: string
  userRole: UserRole
  backPath: string
}

interface FormData {
  title: string
  content: string
  type: NoteType
  visibility: NoteVisibility
  tags: string
  isPinned: boolean
}

export function NoteDetailPage({ noteId, userRole, backPath }: NoteDetailPageProps) {
  const { getToken } = useAuth()
  const router = useRouter()

  // Data state
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [isEditing, setIsEditing] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: "",
    content: "",
    type: NoteType.JOURNAL,
    visibility: NoteVisibility.PRIVATE,
    tags: "",
    isPinned: false
  })

  // Document state
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([])

  // Memoize getToken to reduce dependency changes
  const getAuthToken = useCallback(async () => {
    return await getToken()
  }, [getToken])

  // Fetch note data
  const fetchNote = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Authentication token not available')
      }

      const response = await fetch(`/api/notes/${noteId}?includeDocuments=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Note not found')
        }
        const errorText = await response.text()
        throw new Error(`Failed to fetch note: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      const noteData = data.note || data

      setNote(noteData)
      setFormData({
        title: noteData.title,
        content: noteData.content,
        type: noteData.type,
        visibility: noteData.visibility,
        tags: noteData.tags?.join(', ') || '',
        isPinned: noteData.isPinned
      })
      setSelectedDocuments(noteData.documents || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load note'
      setError(errorMessage)
      console.error('Failed to fetch note:', err)
    } finally {
      setLoading(false)
    }
  }, [noteId, getAuthToken])

  useEffect(() => {
    fetchNote()
  }, [fetchNote])

  // Handle form field changes
  const handleInputChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }, [error])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!note) return

    setIsSubmitting(true)
    setError(null)

    try {
      const token = await getAuthToken()

      // Process tags
      const tags = formData.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 10)

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        visibility: formData.visibility,
        tags,
        isPinned: formData.isPinned,
        documentIds: selectedDocuments.map(doc => doc.id)
      }

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update note')
      }

      // Refresh note data and navigate back
      await fetchNote()
      router.push(backPath)
    } catch (err) {
      console.error('Failed to update note:', err)
      setError(err instanceof Error ? err.message : 'Failed to update note')
    } finally {
      setIsSubmitting(false)
    }
  }, [noteId, formData, selectedDocuments, getAuthToken, fetchNote, note])

  // Handle cancel - navigate back to notes list
  const handleCancel = useCallback(() => {
    router.push(backPath)
  }, [router, backPath])

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.push(backPath)
  }, [router, backPath])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="min-h-[44px]" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Loading Note...</h1>
            <p className="text-sm text-muted-foreground">Please wait while we load the note</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="min-h-[44px]" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Note Error</h1>
            <p className="text-sm text-muted-foreground">Unable to load note</p>
          </div>
        </div>
        <Card className="p-3">
          <div className="text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <h3 className="text-sm font-semibold mb-1">Failed to load note</h3>
            <p className="text-xs text-muted-foreground mb-2">{error}</p>
            <Button onClick={fetchNote} variant="outline" size="sm" className="min-h-[44px]">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const { name: authorName, initials } = getAuthorDisplay(note.creator)
  const isEdited = note.lastEditedAt &&
    new Date(note.lastEditedAt).getTime() > new Date(note.createdAt).getTime()
  const displayDate = isEdited ? note.lastEditedAt! : note.createdAt
  const dateLabel = isEdited ? "edited" : "created"

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Edit Note</h1>
          <p className="text-sm text-muted-foreground">
            Make changes to your note
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-3">
            <div className="space-y-3">
              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-1">
                {note.isPinned && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </Badge>
                )}
                {note.isArchived && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Archive className="h-3 w-3" />
                    Archived
                  </Badge>
                )}
                <Badge variant="outline">
                  {note.type}
                </Badge>
                <Badge variant="outline">
                  {note.visibility}
                </Badge>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Title
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  className="min-h-[44px] text-lg font-medium"
                  disabled={isSubmitting}
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content" className="text-sm font-medium">
                  Content
                </Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange("content", e.target.value)}
                  className="min-h-[300px] resize-y text-base leading-relaxed"
                  disabled={isSubmitting}
                />
              </div>

              {/* Documents */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Attachments
                  {selectedDocuments.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedDocuments.length}
                    </Badge>
                  )}
                </Label>
                <DocumentAttachmentManager
                  noteId={noteId}
                  attachments={selectedDocuments.map((doc, index) => ({
                    id: doc.id,
                    documentId: doc.id,
                    source: "UPLOAD" as const,
                    order: index,
                    attachedAt: new Date().toISOString(),
                    attachedBy: {
                      id: note?.creator?.id || '',
                      email: note?.creator?.name || ''
                    },
                    document: {
                      id: doc.id,
                      title: doc.originalFileName || doc.fileName,
                      filename: doc.fileName,
                      contentType: doc.mimeType,
                      size: doc.fileSize
                    }
                  }))}
                  onAttachmentsChange={(attachments) =>
                    setSelectedDocuments(attachments.map(att => ({
                      id: att.document.id,
                      fileName: att.document.filename || att.document.title,
                      originalFileName: att.document.title,
                      mimeType: att.document.contentType || '',
                      fileSize: att.document.size || 0
                    })))
                  }
                  readOnly={isSubmitting}
                />
              </div>
            </div>
          </Card>

          {/* Metadata Card */}
          <Card className="p-3">
            <CardHeader className="space-y-2 p-0 pb-2">
              <CardTitle className="text-base">Note Information</CardTitle>
            </CardHeader>
            <div className="space-y-2 text-sm">
              {/* Author */}
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={note.creator.imageUrl} />
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span>Created by <span className="font-medium">{authorName}</span></span>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {dateLabel} {formatTimeAgo(displayDate)}
                </span>
              </div>

              {/* View count */}
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span>{note.viewCount || 0} views</span>
              </div>

              {/* Tags */}
              {note.tags?.length > 0 && (
                <div className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Note Settings */}
          <Card className="p-3">
            <CardHeader className="space-y-2 p-0 pb-2">
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {/* Note Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <NoteTypeSelector
                  value={formData.type}
                  onChange={(value) => handleInputChange("type", value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags" className="text-sm font-medium">
                  Tags
                </Label>
                <Input
                  id="tags"
                  placeholder="work, urgent, family..."
                  value={formData.tags}
                  onChange={(e) => handleInputChange("tags", e.target.value)}
                  className="min-h-[44px]"
                  disabled={isSubmitting}
                />
                <div className="text-xs text-muted-foreground">
                  Separate with commas
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label htmlFor="visibility" className="text-sm font-medium">
                  Visibility
                </Label>
                <select
                  id="visibility"
                  value={formData.visibility}
                  onChange={(e) => handleInputChange("visibility", e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-input bg-background rounded-md text-sm"
                  disabled={isSubmitting}
                >
                  <option value={NoteVisibility.PRIVATE}>Private</option>
                  <option value={NoteVisibility.FAMILY}>Family</option>
                  <option value={NoteVisibility.SHARED}>Shared</option>
                  <option value={NoteVisibility.PUBLIC}>Public</option>
                </select>
              </div>

              {/* Pin Note */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pinned"
                  checked={formData.isPinned}
                  onCheckedChange={(checked) => handleInputChange("isPinned", checked === true)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="pinned" className="text-sm">
                  Pin this note
                </Label>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}