"use client"

import React, { useState, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { Save, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { NoteTypeSelector } from "./note-type-selector"
import { SharePermissionToggle } from "./share-permission-toggle"
import { FileUploadPlaceholder } from "./file-attachment-preview"
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
}

interface NoteFormProps {
  mode: "create" | "edit"
  note?: Note
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  className?: string
}

interface FormData {
  title: string
  content: string
  type: NoteType
  visibility: NoteVisibility
  tags: string
  isPinned: boolean
  allowEditing: boolean
}

export function NoteForm({
  mode,
  note,
  open,
  onOpenChange,
  onSuccess,
  className = ""
}: NoteFormProps) {
  const { getToken } = useAuth()

  // Form state
  const [formData, setFormData] = useState<FormData>(() => ({
    title: note?.title || "",
    content: note?.content || "",
    type: note?.type || NoteType.TEXT,
    visibility: note?.visibility || NoteVisibility.PRIVATE,
    tags: note?.tags?.join(", ") || "",
    isPinned: note?.isPinned || false,
    allowEditing: mode === "create" ? true : false // For MVP, default to allow editing
  }))

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle form field changes
  const handleInputChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null) // Clear error when user starts typing
  }, [error])

  // Validate form
  const validateForm = useCallback((): string | null => {
    if (!formData.title.trim()) {
      return "Note title is required"
    }
    if (formData.title.length > 200) {
      return "Title must be less than 200 characters"
    }
    if (!formData.content.trim()) {
      return "Note content is required"
    }
    if (formData.content.length > 10000) {
      return "Content must be less than 10,000 characters"
    }
    return null
  }, [formData])

  // Submit form
  const handleSubmit = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const token = await getToken()
      const url = mode === "create"
        ? "/api/notes"
        : `/api/notes/${note!.id}`

      const method = mode === "create" ? "POST" : "PUT"

      // Process tags
      const tags = formData.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 10) // Limit to 10 tags

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        visibility: formData.visibility,
        tags,
        isPinned: formData.isPinned,
        // For MVP, we're not implementing sharing yet
        // allowEditing will be used for future sharing features
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${mode} note`)
      }

      // Success
      onSuccess?.()
      onOpenChange(false)

      // Reset form for next use
      if (mode === "create") {
        setFormData({
          title: "",
          content: "",
          type: NoteType.TEXT,
          visibility: NoteVisibility.PRIVATE,
          tags: "",
          isPinned: false,
          allowEditing: true
        })
      }
    } catch (err) {
      console.error(`Failed to ${mode} note:`, err)
      setError(err instanceof Error ? err.message : `Failed to ${mode} note`)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, getToken, mode, note, onSuccess, onOpenChange])

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (isSubmitting) return // Prevent closing during submission
    onOpenChange(false)
  }, [isSubmitting, onOpenChange])

  // Handle file upload (MVP placeholder)
  const handleFileUpload = useCallback(() => {
    // MVP: Show placeholder message
    alert("File attachments will be available in a future update!")
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${className}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "create" ? "Create New Note" : "Edit Note"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title *
            </Label>
            <Input
              id="title"
              placeholder="Enter note title..."
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className="min-h-[44px]"
              maxLength={200}
              disabled={isSubmitting}
            />
            <div className="text-xs text-muted-foreground text-right">
              {formData.title.length}/200 characters
            </div>
          </div>

          {/* Note Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Note Type</Label>
            <NoteTypeSelector
              value={formData.type}
              onChange={(value) => handleInputChange("type", value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-sm font-medium">
              Content *
            </Label>
            <Textarea
              id="content"
              placeholder="Write your note content here..."
              value={formData.content}
              onChange={(e) => handleInputChange("content", e.target.value)}
              className="min-h-[120px] max-h-[300px] resize-y"
              maxLength={10000}
              disabled={isSubmitting}
            />
            <div className="text-xs text-muted-foreground text-right">
              {formData.content.length}/10,000 characters
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm font-medium">
              Tags
            </Label>
            <Input
              id="tags"
              placeholder="Enter tags separated by commas..."
              value={formData.tags}
              onChange={(e) => handleInputChange("tags", e.target.value)}
              className="min-h-[44px]"
              disabled={isSubmitting}
            />
            <div className="text-xs text-muted-foreground">
              Separate multiple tags with commas. Maximum 10 tags.
            </div>
          </div>

          {/* Visibility & Sharing */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Privacy & Sharing</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="visibility" className="text-xs text-muted-foreground">
                    Who can see this note
                  </Label>
                  <select
                    id="visibility"
                    value={formData.visibility}
                    onChange={(e) => handleInputChange("visibility", e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 border border-input bg-background rounded-md text-sm"
                    disabled={isSubmitting}
                  >
                    <option value={NoteVisibility.PRIVATE}>Private (Only me)</option>
                    <option value={NoteVisibility.FAMILY}>Family Members</option>
                    <option value={NoteVisibility.SHARED}>Shared Users</option>
                    <option value={NoteVisibility.PUBLIC}>Everyone</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="pinned"
                      checked={formData.isPinned}
                      onChange={(e) => handleInputChange("isPinned", e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="pinned" className="text-sm">
                      Pin this note
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Future sharing permission toggle - hidden for MVP */}
            {false && formData.visibility !== NoteVisibility.PRIVATE && (
              <SharePermissionToggle
                allowEditing={formData.allowEditing}
                onToggle={(value) => handleInputChange("allowEditing", value)}
                disabled={isSubmitting}
              />
            )}
          </div>

          {/* File Attachments - MVP placeholder */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Attachments</Label>
            <FileUploadPlaceholder
              onUploadClick={handleFileUpload}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col md:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-[44px] order-2 md:order-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-h-[44px] order-1 md:order-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "create" ? "Creating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === "create" ? "Create Note" : "Save Changes"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}