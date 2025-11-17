"use client"

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MessageReaction } from '@/lib/types/api'

interface MessageReactionsProps {
  messageId: string
  reactions?: Record<string, MessageReaction[]>
  currentUserId?: string
  onAddReaction?: (messageId: string, emoji: string) => void
  onRemoveReaction?: (messageId: string, emoji: string) => void
  className?: string
}

interface ReactionButtonProps {
  emoji: string
  count: number
  users: MessageReaction[]
  isUserReacted: boolean
  onClick: () => void
  className?: string
}

function ReactionButton({
  emoji,
  count,
  users,
  isUserReacted,
  onClick,
  className = ""
}: ReactionButtonProps) {
  // Create tooltip text showing who reacted
  const tooltipText = () => {
    if (users.length === 0) return ""

    if (users.length === 1) {
      return `${users[0].userName} reacted with ${emoji}`
    }

    if (users.length === 2) {
      return `${users[0].userName} and ${users[1].userName} reacted with ${emoji}`
    }

    if (users.length <= 5) {
      const names = users.slice(0, -1).map(u => u.userName).join(', ')
      return `${names}, and ${users[users.length - 1].userName} reacted with ${emoji}`
    }

    const displayedNames = users.slice(0, 3).map(u => u.userName).join(', ')
    const remaining = users.length - 3
    return `${displayedNames}, and ${remaining} others reacted with ${emoji}`
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn(
              "h-6 px-2 py-1 text-xs font-medium rounded-full transition-all duration-200",
              "flex items-center space-x-1 min-w-0",
              "hover:scale-105 active:scale-95",
              isUserReacted
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              className
            )}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && (
              <span className="text-xs font-medium min-w-0">{count}</span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{tooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function MessageReactions({
  messageId,
  reactions = {},
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  className = ""
}: MessageReactionsProps) {
  // Filter out empty reactions and sort by count
  const validReactions = Object.entries(reactions)
    .filter(([_, users]) => users && users.length > 0)
    .sort(([, usersA], [, usersB]) => usersB.length - usersA.length)

  // Don't render if no reactions
  if (validReactions.length === 0) {
    return null
  }

  const handleReactionClick = (emoji: string, isUserReacted: boolean) => {
    if (isUserReacted) {
      onRemoveReaction?.(messageId, emoji)
    } else {
      onAddReaction?.(messageId, emoji)
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-1 mt-2", className)}>
      {validReactions.map(([emoji, users]) => {
        const isUserReacted = currentUserId ? users.some(u => u.userId === currentUserId) : false

        return (
          <ReactionButton
            key={emoji}
            emoji={emoji}
            count={users.length}
            users={users}
            isUserReacted={isUserReacted}
            onClick={() => handleReactionClick(emoji, isUserReacted)}
          />
        )
      })}
    </div>
  )
}

// Compact version for message previews
interface CompactMessageReactionsProps {
  reactions?: Record<string, MessageReaction[]>
  maxDisplay?: number
  className?: string
}

export function CompactMessageReactions({
  reactions = {},
  maxDisplay = 3,
  className = ""
}: CompactMessageReactionsProps) {
  const validReactions = Object.entries(reactions)
    .filter(([_, users]) => users && users.length > 0)
    .sort(([, usersA], [, usersB]) => usersB.length - usersA.length)
    .slice(0, maxDisplay)

  if (validReactions.length === 0) {
    return null
  }

  const totalReactions = Object.values(reactions)
    .flat()
    .length

  const hasMore = Object.keys(reactions).length > maxDisplay

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {validReactions.map(([emoji, users]) => (
        <div
          key={emoji}
          className="flex items-center space-x-1 text-xs text-muted-foreground"
        >
          <span>{emoji}</span>
          <span>{users.length}</span>
        </div>
      ))}
      {hasMore && (
        <span className="text-xs text-muted-foreground">
          +{totalReactions - validReactions.reduce((sum, [, users]) => sum + users.length, 0)} more
        </span>
      )}
    </div>
  )
}

// Hook for managing message reactions state
export function useMessageReactions() {
  const [reactions, setReactions] = useState<Record<string, Record<string, MessageReaction[]>>>({})

  const updateMessageReactions = (
    messageId: string,
    emoji: string,
    userId: string,
    userName: string,
    action: 'add' | 'remove'
  ) => {
    setReactions(prev => {
      const messageReactions = { ...prev[messageId] } || {}
      const emojiReactions = [...(messageReactions[emoji] || [])]

      if (action === 'add') {
        // Add reaction if not already present
        const existingIndex = emojiReactions.findIndex(r => r.userId === userId)
        if (existingIndex === -1) {
          emojiReactions.push({
            userId,
            userName,
            createdAt: new Date()
          })
        }
      } else {
        // Remove reaction
        const filteredReactions = emojiReactions.filter(r => r.userId !== userId)
        if (filteredReactions.length === 0) {
          // Remove emoji entirely if no reactions left
          const { [emoji]: _, ...restReactions } = messageReactions
          return {
            ...prev,
            [messageId]: restReactions
          }
        } else {
          messageReactions[emoji] = filteredReactions
        }
      }

      // Update reactions
      if (action === 'add') {
        messageReactions[emoji] = emojiReactions
      }

      return {
        ...prev,
        [messageId]: messageReactions
      }
    })
  }

  const addReaction = (messageId: string, emoji: string, userId: string, userName: string) => {
    updateMessageReactions(messageId, emoji, userId, userName, 'add')
  }

  const removeReaction = (messageId: string, emoji: string, userId: string, userName: string) => {
    updateMessageReactions(messageId, emoji, userId, userName, 'remove')
  }

  const setMessageReactions = (messageId: string, messageReactions: Record<string, MessageReaction[]>) => {
    setReactions(prev => ({
      ...prev,
      [messageId]: messageReactions
    }))
  }

  const getMessageReactions = (messageId: string): Record<string, MessageReaction[]> => {
    return reactions[messageId] || {}
  }

  return {
    reactions,
    addReaction,
    removeReaction,
    setMessageReactions,
    getMessageReactions
  }
}