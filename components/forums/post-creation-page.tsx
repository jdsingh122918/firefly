"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, MessageSquare, AlertCircle, Paperclip, X, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor, countHtmlCharacters } from "@/components/editors/editor-migration-wrapper"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { toast } from "sonner"

const postFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().min(1, "Content is required").max(50000, "Content is too long"),
  type: z.enum(["DISCUSSION", "QUESTION", "ANNOUNCEMENT", "RESOURCE"], "Please select a post type"),
  tags: z.array(z.string()).optional()
})

type PostFormData = z.infer<typeof postFormSchema>

interface PostCreationPageProps {
  forumId: string
  forumSlug: string
  forumName: string
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

export function PostCreationPage({
  forumId,
  forumSlug,
  forumName
}: PostCreationPageProps) {
  const { getToken, sessionClaims } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([])
  const [browserOpen, setBrowserOpen] = useState(false)

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

  // Get user role for routing
  const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
  const rolePrefix = userRole.toLowerCase()

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
          documentIds: selectedDocumentIds
        })
      })

      if (!response.ok) {
        const errorData = await response.json()

        // Enhanced logging for debugging
        console.error('Post creation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          requestBody: {
            title: data.title,
            contentLength: data.content?.length || 0,
            type: data.type,
            forumId: forumId,
            tagsCount: tagsArray.length,
            documentIdsCount: selectedDocumentIds.length
          }
        })

        // Handle validation errors with detailed messages
        if (response.status === 400 && errorData.details) {
          const validationErrors = errorData.details.map((detail: any) =>
            `${detail.field}: ${detail.message}`
          ).join(', ')
          throw new Error(`Validation failed: ${validationErrors}`)
        }

        // Handle specific error messages
        const errorMessage = errorData.error || errorData.message || 'Failed to create post'
        throw new Error(errorMessage)
      }

      const result = await response.json()

      toast.success('Post created successfully!')

      // Navigate to the new post
      if (result.post?.slug) {
        router.push(`/${rolePrefix}/forums/${forumSlug}/posts/${result.post.slug}`)
      } else {
        router.push(`/${rolePrefix}/forums/${forumSlug}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create post'
      setError(message)
      toast.error(message)
    }
  }

  const handleCancel = () => {
    router.push(`/${rolePrefix}/forums/${forumSlug}`)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with breadcrumb */}
      <div className="space-y-3">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href={`/${rolePrefix}/forums`} className="hover:text-foreground">
            Forums
          </Link>
          <span>/</span>
          <Link href={`/${rolePrefix}/forums/${forumSlug}`} className="hover:text-foreground">
            {forumName}
          </Link>
          <span>/</span>
          <span>New Post</span>
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Forum
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Post</h1>
            <p className="text-muted-foreground">
              Share your thoughts, ask questions, or start a discussion in {forumName}
            </p>
          </div>
        </div>
      </div>

      {/* Main form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Post Details
          </CardTitle>
          <CardDescription>
            Fill out the information below to create your post.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="What would you like to discuss?"
                        className="text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Post Type */}
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
                                {value && postTypeDescriptions[value as keyof typeof postTypeDescriptions] || ''}
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

              {/* Content */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content *</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        content={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Share your thoughts, ask questions, or provide information..."
                        maxLength={50000}
                        className="min-h-[300px]"
                      />
                    </FormControl>
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
                  <div>
                    <label className="text-sm font-medium">Attachments (Optional)</label>
                    <p className="text-xs text-muted-foreground">
                      Add relevant documents to support your post
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBrowserOpen(true)}
                    className="h-9"
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    Add Documents
                  </Button>
                </div>

                {selectedDocuments.length > 0 && (
                  <div className="space-y-2">
                    {selectedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{doc.title}</div>
                            {doc.size && (
                              <div className="text-xs text-muted-foreground">
                                {Math.round(doc.size / 1024)}KB
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(doc.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
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
        </CardContent>
      </Card>

      {/* Document Browser */}
      <DocumentBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={handleDocumentSelect}
        selectedDocuments={selectedDocumentIds}
        multiSelect={true}
        title="Select Documents to Attach"
      />
    </div>
  )
}