"use client"

import React, { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  MoreVertical,
  Pin,
  PinOff,
  Lock,
  LockOpen,
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface PostModerationActionsProps {
  postId: string
  isPinned: boolean
  isLocked: boolean
  isAuthor: boolean
  onUpdate?: () => void
  className?: string
}

export function PostModerationActions({
  postId,
  isPinned,
  isLocked,
  isAuthor,
  onUpdate,
  className
}: PostModerationActionsProps) {
  const { getToken, sessionClaims } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  // Get user role
  const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
  const isAdmin = userRole.toUpperCase() === 'ADMIN'
  const isVolunteer = userRole.toUpperCase() === 'VOLUNTEER'

  // Check if user can moderate (admin or volunteer for now - forum-specific moderation would require additional API call)
  const canModerate = isAdmin || isVolunteer

  // Check if user can delete (admin, or author for their own posts)
  const canDelete = isAdmin || isAuthor

  if (!canModerate && !canDelete) {
    return null // No moderation actions available
  }

  const handleModerationAction = async (action: 'pin' | 'lock', newValue: boolean) => {
    if (isLoading) return

    setIsLoading(true)
    setPendingAction(action)

    try {
      const token = await getToken()
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [action === 'pin' ? 'isPinned' : 'isLocked']: newValue
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${action} post`)
      }

      const actionText = action === 'pin'
        ? (newValue ? 'pinned' : 'unpinned')
        : (newValue ? 'locked' : 'unlocked')

      toast.success(`Post ${actionText} successfully`)
      onUpdate?.()
    } catch (err) {
      console.error(`Failed to ${action} post:`, err)
      toast.error(err instanceof Error ? err.message : `Failed to ${action} post`)
    } finally {
      setIsLoading(false)
      setPendingAction(null)
    }
  }

  const handleDeletePost = async () => {
    if (isLoading) return

    setIsLoading(true)
    setPendingAction('delete')

    try {
      const token = await getToken()
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete post')
      }

      toast.success('Post deleted successfully')
      setShowDeleteDialog(false)
      onUpdate?.()
    } catch (err) {
      console.error('Failed to delete post:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete post')
    } finally {
      setIsLoading(false)
      setPendingAction(null)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${className}`}
            disabled={isLoading}
          >
            {isLoading && pendingAction ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
            <span className="sr-only">Open moderation menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canModerate && (
            <>
              {/* Pin/Unpin Action */}
              <DropdownMenuItem
                onClick={() => handleModerationAction('pin', !isPinned)}
                disabled={isLoading}
                className="cursor-pointer"
              >
                {isPinned ? (
                  <>
                    <PinOff className="mr-2 h-4 w-4" />
                    Unpin Post
                  </>
                ) : (
                  <>
                    <Pin className="mr-2 h-4 w-4" />
                    Pin Post
                  </>
                )}
              </DropdownMenuItem>

              {/* Lock/Unlock Action */}
              <DropdownMenuItem
                onClick={() => handleModerationAction('lock', !isLocked)}
                disabled={isLoading}
                className="cursor-pointer"
              >
                {isLocked ? (
                  <>
                    <LockOpen className="mr-2 h-4 w-4" />
                    Unlock Post
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Lock Post
                  </>
                )}
              </DropdownMenuItem>

              {canDelete && <DropdownMenuSeparator />}
            </>
          )}

          {/* Delete Action */}
          {canDelete && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              disabled={isLoading}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Post
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Post
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
              All replies and attachments will also be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && pendingAction === 'delete' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Post
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}