"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ReplyFormProps {
  postId: string
  parentId?: string
  onSuccess?: () => void
  onCancel?: () => void
  className?: string
  placeholder?: string
}

export function ReplyForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  className = "",
  placeholder = "Write your reply..."
}: ReplyFormProps) {
  const { getToken } = useAuth()

  // Form state
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      setError("Reply content is required")
      return
    }

    if (content.length > 10000) {
      setError("Reply content must be less than 10,000 characters")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const token = await getToken()
      const response = await fetch("/api/replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: content.trim(),
          postId,
          parentId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create reply")
      }

      // Success
      setContent("")
      onSuccess?.()

    } catch (err) {
      console.error("Error creating reply:", err)
      setError(err instanceof Error ? err.message : "Failed to create reply")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setContent("")
    setError(null)
    onCancel?.()
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none"
          disabled={isSubmitting}
          maxLength={10000}
        />

        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {content.length}/10,000 characters
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="min-h-[36px]"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim()}
              className="min-h-[36px] min-w-[80px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-3 w-3" />
                  Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {error && (
        <Alert className="py-2">
          <AlertDescription className="text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}