"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, MessageSquare, AlertCircle, Paperclip, X, Plus } from "lucide-react"
import {
  VALID_POST_TYPES
} from "@/lib/forum/post-types"
import { EnhancedPostTypeSelector } from "@/components/forums/enhanced-post-type-selector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EnhancedTextarea } from "@/components/shared/enhanced-textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
// Select components no longer needed - using EnhancedPostTypeSelector
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ForumTagSelector } from "@/components/forums/forum-tag-selector"
import { UploadedFile } from "@/hooks/use-file-upload"
import { toast } from "sonner"

const postFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().min(1, "Content is required").max(10000, "Content is too long"),
  type: z.enum(VALID_POST_TYPES, "Please select a post type"),
  tags: z.array(z.string()).optional()
})

type PostFormData = z.infer<typeof postFormSchema>

interface SimplePostFormProps {
  forumId: string
  forumSlug: string
  onSuccess?: () => void
  trigger?: React.ReactNode
}

// Post type configuration is now handled by the shared system

export function SimplePostForm({
  forumId,
  forumSlug,
  onSuccess,
  trigger
}: SimplePostFormProps) {
  const { getToken, sessionClaims } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedFile[]>([])

  const form = useForm<PostFormData>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "DISCUSSION",
      tags: []
    }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (data: PostFormData) => {
    setError(null)

    try {
      const token = await getToken()

      // Process tags (already an array)
      const tagsArray = data.tags || []

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          type: data.type,
          forumId: forumId,
          tags: tagsArray,
          documentIds: [
            ...selectedDocumentIds,
            ...uploadedDocuments.map(doc => doc.fileId)
          ]
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create post')
      }

      const result = await response.json()

      toast.success('Post created successfully!')
      form.reset()
      setSelectedDocumentIds([])
      setUploadedDocuments([])
      setOpen(false)

      // Navigate to the new post or refresh the forum
      if (result.post?.slug) {
        // Get user role for dynamic routing
        const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
        const rolePrefix = userRole.toLowerCase()
        router.push(`/${rolePrefix}/forums/${forumSlug}/posts/${result.post.slug}`)
      } else {
        router.refresh()
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create post'
      setError(message)
      toast.error(message)
    }
  }

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="mr-2 h-4 w-4" />
      Quick Post
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Create New Post
          </DialogTitle>
          <DialogDescription>
            Share your thoughts, ask questions, or provide resources for the community.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Post Type Selection */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Post Type</FormLabel>
                  <FormControl>
                    <EnhancedPostTypeSelector
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select post type"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What would you like to discuss?"
                      {...field}
                      maxLength={200}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value.length}/200 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <EnhancedTextarea
                      placeholder="Share your thoughts, provide details, or ask your question..."
                      {...field}
                      minHeight={150}
                      maxHeight={400}
                      maxLength={10000}
                      enableAttachments={true}
                      onAttachmentsChange={setUploadedDocuments}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value.length}/10,000 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (Optional)</FormLabel>
                  <FormControl>
                    <ForumTagSelector
                      value={field.value || []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Uploaded Files Preview */}
            {uploadedDocuments.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Attached Files</div>
                <div className="space-y-1">
                  {uploadedDocuments.map((doc) => (
                    <div
                      key={doc.fileId}
                      className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{doc.fileName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(doc.size / 1024)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUploadedDocuments(prev =>
                            prev.filter(f => f.fileId !== doc.fileId)
                          )
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Create Post
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}