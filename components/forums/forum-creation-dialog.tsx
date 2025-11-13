"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2, MessageSquare, Globe, UsersRound, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

type ForumVisibility = "PUBLIC" | "FAMILY" | "PRIVATE"

interface ForumCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const visibilityOptions = [
  {
    value: "PUBLIC" as ForumVisibility,
    label: "Public",
    description: "Anyone can view and join this forum",
    icon: Globe,
    color: "text-green-600",
  },
  {
    value: "FAMILY" as ForumVisibility,
    label: "Family Only",
    description: "Only family members can access this forum",
    icon: UsersRound,
    color: "text-blue-600",
  },
  {
    value: "PRIVATE" as ForumVisibility,
    label: "Private",
    description: "Only invited members can access this forum",
    icon: Lock,
    color: "text-orange-600",
  },
]

export function ForumCreationDialog({
  open,
  onOpenChange,
  onSuccess,
}: ForumCreationDialogProps) {
  const { getToken } = useAuth()

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<ForumVisibility>("PUBLIC")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError("Forum title is required")
      return
    }

    if (title.length > 100) {
      setError("Forum title must be less than 100 characters")
      return
    }

    if (description.length > 500) {
      setError("Forum description must be less than 500 characters")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const token = await getToken()
      const response = await fetch("/api/forums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          visibility,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create forum")
      }

      // Success
      setTitle("")
      setDescription("")
      setVisibility("PUBLIC")
      onOpenChange(false)
      onSuccess?.()

    } catch (err) {
      console.error("Error creating forum:", err)
      setError(err instanceof Error ? err.message : "Failed to create forum")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setTitle("")
    setDescription("")
    setVisibility("PUBLIC")
    setError(null)
    onOpenChange(false)
  }

  const selectedVisibility = visibilityOptions.find(opt => opt.value === visibility)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Create New Forum
          </DialogTitle>
          <DialogDescription>
            Create a new forum to start conversations and discussions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Field */}
          <div className="space-y-2">
            <Label htmlFor="title">Forum Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter forum title..."
              disabled={isSubmitting}
              maxLength={100}
              className="min-h-[44px]"
            />
            <div className="text-xs text-muted-foreground text-right">
              {title.length}/100 characters
            </div>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this forum is about..."
              disabled={isSubmitting}
              maxLength={500}
              className="min-h-[80px] resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">
              {description.length}/500 characters
            </div>
          </div>

          {/* Visibility Field */}
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select value={visibility} onValueChange={(value) => setVisibility(value as ForumVisibility)}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${option.color}`} />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {/* Current selection display */}
            {selectedVisibility && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/50 rounded">
                <selectedVisibility.icon className={`h-4 w-4 ${selectedVisibility.color}`} />
                <span>{selectedVisibility.description}</span>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert>
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Dialog Footer */}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="min-h-[44px] min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Create Forum
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}