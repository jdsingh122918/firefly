"use client"

import React, { useState } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { useAuth } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface VoteButtonsProps {
  itemId: string
  itemType: "post" | "reply"
  initialScore: number
  initialUserVote?: "UPVOTE" | "DOWNVOTE" | null
  className?: string
}

export function VoteButtons({
  itemId,
  itemType,
  initialScore,
  initialUserVote,
  className
}: VoteButtonsProps) {
  const { getToken } = useAuth()
  const [score, setScore] = useState(initialScore)
  const [userVote, setUserVote] = useState<"UPVOTE" | "DOWNVOTE" | null>(initialUserVote || null)
  const [isVoting, setIsVoting] = useState(false)

  const handleVote = async (voteType: "UPVOTE" | "DOWNVOTE") => {
    if (isVoting) return

    setIsVoting(true)

    // Optimistic update
    const previousScore = score
    const previousVote = userVote

    let newScore = score
    let newVote: "UPVOTE" | "DOWNVOTE" | null = voteType

    // Calculate score change based on current state and new vote
    if (userVote === voteType) {
      // Remove vote (toggle off)
      newScore = voteType === "UPVOTE" ? score - 1 : score + 1
      newVote = null
    } else if (userVote && userVote !== voteType) {
      // Change vote type (double swing)
      newScore = voteType === "UPVOTE" ? score + 2 : score - 2
      newVote = voteType
    } else {
      // New vote
      newScore = voteType === "UPVOTE" ? score + 1 : score - 1
      newVote = voteType
    }

    setScore(newScore)
    setUserVote(newVote)

    try {
      const token = await getToken()
      const endpoint = itemType === "post" ? `/api/posts/${itemId}/vote` : `/api/replies/${itemId}/vote`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ voteType })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to submit vote')
      }

      const data = await response.json()

      // Update with actual server response
      if (data.success) {
        setScore(data.score)
        setUserVote(data.voteType || null)
      }
    } catch (error) {
      // Rollback optimistic update
      setScore(previousScore)
      setUserVote(previousVote)

      toast.error("Failed to submit vote")
      console.error('Vote error:', error)
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        disabled={isVoting}
        onClick={() => handleVote("UPVOTE")}
        className={cn(
          "h-10 w-10 md:h-8 md:w-8 p-0 hover:bg-orange-100 hover:text-orange-600 transition-colors",
          userVote === "UPVOTE" && "bg-orange-100 text-orange-600"
        )}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      <span className={cn(
        "text-sm font-medium min-w-[2rem] text-center",
        score > 0 && "text-green-600",
        score < 0 && "text-red-600",
        userVote === "UPVOTE" && "text-orange-600",
        userVote === "DOWNVOTE" && "text-blue-600"
      )}>
        {score}
      </span>

      <Button
        variant="ghost"
        size="sm"
        disabled={isVoting}
        onClick={() => handleVote("DOWNVOTE")}
        className={cn(
          "h-10 w-10 md:h-8 md:w-8 p-0 hover:bg-blue-100 hover:text-blue-600 transition-colors",
          userVote === "DOWNVOTE" && "bg-blue-100 text-blue-600"
        )}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}