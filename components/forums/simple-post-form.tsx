"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, MessageSquare, AlertCircle, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EnhancedTextarea } from "@/components/shared/enhanced-textarea"
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DocumentBrowser } from "@/components/notes/document-browser"
import { ForumTagSelector } from "@/components/forums/forum-tag-selector"
import { UploadedFile } from "@/hooks/use-file-upload"
import { toast } from "sonner"

const postFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().min(1, "Content is required").max(10000, "Content is too long"),
  type: z.enum(["DISCUSSION", "QUESTION", "ANNOUNCEMENT", "RESOURCE"], "Please select a post type"),
  tags: z.array(z.string()).optional()
})

type PostFormData = z.infer<typeof postFormSchema>

interface SimplePostFormProps {
  forumId: string
  forumSlug: string
  onSuccess?: () => void
  trigger?: React.ReactNode
}

const postTypeLabels = {
  DISCUSSION: "Discussion",
  QUESTION: "Question",
  ANNOUNCEMENT: "Announcement",
  RESOURCE: "Resource"
}

const postTypeDescriptions = {
  DISCUSSION: "General discussion or conversation",
  QUESTION: "Ask for help or information",
  ANNOUNCEMENT: "Important news or updates",
  RESOURCE: "Share helpful resources or links"
}

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
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([])
  const [browserOpen, setBrowserOpen] = useState(false)
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

  // Handle document selection
  const handleDocumentSelect = (documents: any[]) => {
    setSelectedDocuments(documents)
    setSelectedDocumentIds(documents.map(doc => doc.id))
    setBrowserOpen(false)
  }

  // Remove selected document
  const removeDocument = (documentId: string) => {
    setSelectedDocuments(prev => prev.filter(doc => doc.id !== documentId))
    setSelectedDocumentIds(prev => prev.filter(id => id !== documentId))
  }

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
            ...uploadedDocuments.map(doc => doc.document?.id || doc.fileId)
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
      setSelectedDocuments([])
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
    <Button>
      <MessageSquare className="mr-2 h-4 w-4" />
      New Post
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What would you like to discuss?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Post Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a post type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(postTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div>
                            <div className="font-medium">{label}</div>
                            <div className="text-xs text-muted-foreground">
                              {postTypeDescriptions[value as keyof typeof postTypeDescriptions]}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <EnhancedTextarea
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Share your thoughts, ask questions, or provide information..."
                      maxLength={10000}
                      minHeight={200}
                      maxHeight={400}
                      showToolbar={true}
                      enableEmojis={true}
                      enableAttachments={true}
                      enablePreview={true}
                      attachments={uploadedDocuments}
                      onAttachmentsChange={setUploadedDocuments}
                      autoResize={true}
                      label="Content *"
                      description="Create your post with rich formatting, emojis, and file attachments."
                      showCharacterCount="near-limit"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      placeholder="Add tags to categorize your post..."
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Document Attachments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Attachments (Optional)</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBrowserOpen(true)}
                  className="h-8"
                >
                  <Paperclip className="mr-1 h-3 w-3" />
                  Add Documents
                </Button>
              </div>

              {selectedDocuments.length > 0 && (
                <div className="space-y-2">
                  {selectedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-3 w-3" />
                        <span className="font-medium">{doc.title}</span>
                        {doc.size && (
                          <span className="text-muted-foreground">
                            ({Math.round(doc.size / 1024)}KB)
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocument(doc.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Post
              </Button>
            </div>
          </form>
        </Form>

        {/* Document Browser */}
        <DocumentBrowser
          open={browserOpen}
          onOpenChange={setBrowserOpen}
          onSelect={handleDocumentSelect}
          selectedDocuments={selectedDocumentIds}
          multiSelect={true}
          title="Select Documents to Attach"
        />
      </DialogContent>
    </Dialog>
  )
}