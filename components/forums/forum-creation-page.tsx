"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"


export function ForumCreationPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Extract user role from pathname (e.g., /admin/forums/new -> admin)
  const userRole = pathname.split('/')[1]

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
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

      // Prepare request body - always use PUBLIC visibility
      const requestBody = {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility: "PUBLIC",
      }

      const token = await getToken()
      const response = await fetch("/api/forums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create forum")
      }

      const result = await response.json()

      // Redirect to the new forum page
      router.push(`/${userRole}/forums/${result.forum.slug}`)

    } catch (err) {
      console.error("Error creating forum:", err)
      setError(err instanceof Error ? err.message : "Failed to create forum")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(`/${userRole}/forums`)
  }


  return (
    <div className="space-y-3">
      {/* Back Button */}
      <Button variant="default" size="sm" asChild>
        <Link href={`/${userRole}/forums`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Forums
        </Link>
      </Button>

      {/* Page Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Create New Forum
          </CardTitle>
          <CardDescription>
            Create a new public forum to start conversations and discussions.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Title Field */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-sm font-medium">Forum Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter forum title..."
                disabled={isSubmitting}
                maxLength={100}
                className="h-9"
              />
              <div className="text-xs text-muted-foreground text-right">
                {title.length}/100 characters
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this forum is about..."
                disabled={isSubmitting}
                maxLength={500}
                className="min-h-[70px] resize-none text-sm"
              />
              <div className="text-xs text-muted-foreground text-right">
                {description.length}/500 characters
              </div>
            </div>


            {/* Error Display */}
            {error && (
              <Alert>
                <AlertDescription className="text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                size="sm"
                className="min-w-[100px]"
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}