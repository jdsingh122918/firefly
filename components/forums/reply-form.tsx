"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EnhancedTextarea } from "@/components/shared/enhanced-textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UploadedFile } from "@/hooks/use-file-upload"

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
  const [attachments, setAttachments] = useState<UploadedFile[]>([])

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
          attachments: attachments.map(file => ({
            documentId: file.document?.id || file.fileId,
            fileName: file.fileName,
            originalName: file.originalName || file.fileName,
            size: file.size,
            mimeType: file.mimeType,
            url: file.url
          }))
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create reply")
      }

      // Success - clear form
      setContent("")
      setAttachments([])
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
    setAttachments([])
    setError(null)
    onCancel?.()
  }


  return (
    <div className={`space-y-3 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <EnhancedTextarea
          value={content}
          onChange={setContent}
          placeholder={placeholder}
          maxLength={10000}
          minHeight={80}
          maxHeight={300}
          showToolbar={true}
          enableEmojis={true}
          enableAttachments={true}
          enablePreview={true}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          autoResize={true}
          description="Write your reply with rich formatting, emojis, and file attachments."
          showCharacterCount="near-limit"
        />

        <div className="flex justify-end gap-2">
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
            disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
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