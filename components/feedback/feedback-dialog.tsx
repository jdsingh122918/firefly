"use client"

import React, { useState, useEffect } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Paperclip, X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileUploadPreview } from "@/components/shared/file-upload-preview"
import { useFileUpload, UploadedFile } from "@/hooks/use-file-upload"
import { toast } from "sonner"

const feedbackSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description must be 2000 characters or less"),
})

type FeedbackFormData = z.infer<typeof feedbackSchema>

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { getToken, sessionClaims } = useAuth()
  const { user } = useUser()
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const { uploadFile, uploads, validateFile, clearUploads, removeUpload } = useFileUpload()

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      title: "",
      description: "",
    }
  })

  const { isSubmitting } = form.formState

  // Clear form and uploads when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset()
      setUploadedFiles([])
      clearUploads()
      setError(null)
    }
  }, [open, form, clearUploads])

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      // Validate file
      const validation = validateFile(file)
      if (!validation.isValid) {
        toast.error(`${file.name}: ${validation.error}`)
        continue
      }

      try {
        const result = await uploadFile(file, {
          category: "documents",
          description: "Feedback attachment"
        })

        if (result) {
          setUploadedFiles(prev => [...prev, result])
          toast.success(`${file.name} uploaded successfully`)
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    // Clear file input
    event.target.value = ""
  }

  // Handle file removal
  const handleFileRemove = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.fileId !== fileId))
  }

  // Submit feedback
  const onSubmit = async (data: FeedbackFormData) => {
    try {
      setError(null)

      // Get authentication token
      const token = await getToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Prepare feedback payload
      const payload = {
        title: data.title,
        description: data.description,
        attachments: uploadedFiles.map(f => f.fileId),
        userInfo: {
          name: user?.fullName || user?.firstName || "Unknown",
          email: user?.emailAddresses?.[0]?.emailAddress || "unknown@example.com",
          role: sessionClaims?.role || "UNKNOWN",
          userId: user?.id
        }
      }

      // Submit feedback
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Server error (${response.status})`)
      }

      // Success
      toast.success('Feedback submitted successfully! Thank you for your input.')
      onOpenChange(false)

    } catch (error) {
      console.error('Feedback submission error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit feedback'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Feedback
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief summary of your feedback"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Please describe your feedback in detail..."
                      rows={4}
                      disabled={isSubmitting}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {field.value.length}/2000 characters
                  </p>
                </FormItem>
              )}
            />

            {/* File Upload Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Attachments (Optional)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => document.getElementById('feedback-file-input')?.click()}
                  className="h-8"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Add Files
                </Button>
              </div>

              {/* Hidden File Input */}
              <input
                id="feedback-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={isSubmitting}
              />

              {/* File Upload Progress */}
              {uploads.length > 0 && (
                <FileUploadPreview
                  uploads={uploads}
                  onRemoveUpload={(file) => removeUpload(file as File)}
                  layout="compact"
                />
              )}

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {uploadedFiles.length} file(s) attached
                  </p>
                  <FileUploadPreview
                    attachments={uploadedFiles}
                    onRemoveAttachment={(id) => handleFileRemove(id as string)}
                    layout="compact"
                  />
                </div>
              )}
            </div>

            {/* User Info Display */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                This feedback will be sent from:
              </p>
              <p className="text-sm">
                <strong>{user?.fullName || user?.firstName || "Unknown User"}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Feedback
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}