"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, MessageSquare, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { toast } from "sonner"

const postFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().min(1, "Content is required").max(10000, "Content is too long"),
  type: z.enum(["DISCUSSION", "QUESTION", "ANNOUNCEMENT", "RESOURCE"], "Please select a post type"),
  tags: z.string().optional()
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

  const form = useForm<PostFormData>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "DISCUSSION",
      tags: ""
    }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (data: PostFormData) => {
    setError(null)

    try {
      const token = await getToken()

      // Process tags
      const tagsArray = data.tags
        ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : []

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
          tags: tagsArray
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create post')
      }

      const result = await response.json()

      toast.success('Post created successfully!')
      form.reset()
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
                  <FormLabel>Content *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share your thoughts, ask questions, or provide information..."
                      className="min-h-[200px] resize-y"
                      {...field}
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
                    <Input
                      placeholder="tag1, tag2, tag3"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Separate multiple tags with commas
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

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
      </DialogContent>
    </Dialog>
  )
}