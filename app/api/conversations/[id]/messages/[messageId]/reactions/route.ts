import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { MessageRepository } from "@/lib/db/repositories/message.repository"
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository"
import { UserRepository } from "@/lib/db/repositories/user.repository"
import { broadcastToConversation } from "@/lib/utils/sse-utils"

const messageRepository = new MessageRepository()
const conversationRepository = new ConversationRepository()
const userRepository = new UserRepository()

// Validation schemas
const addReactionSchema = z.object({
  emoji: z.string().min(1, "Emoji is required"),
})

/**
 * GET /api/conversations/[id]/messages/[messageId]/reactions
 * Get all reactions for a message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: conversationId, messageId } = await params

    // Get database user
    const user = await userRepository.getUserByClerkId(userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Validate participant access
    const isParticipant = await conversationRepository.isUserParticipant(conversationId, user.id)
    if (!isParticipant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get message reactions
    const reactions = await messageRepository.getMessageReactions(messageId)
    const reactionCounts = await messageRepository.getReactionCounts(messageId)

    return NextResponse.json({
      reactions,
      counts: reactionCounts,
    })
  } catch (error) {
    console.error("❌ Error getting message reactions:", error)
    return NextResponse.json(
      { error: "Failed to get reactions" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/conversations/[id]/messages/[messageId]/reactions
 * Add a reaction to a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: conversationId, messageId } = await params

    // Parse and validate request body
    const body = await request.json()
    const { emoji } = addReactionSchema.parse(body)

    // Get database user
    const user = await userRepository.getUserByClerkId(userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Validate participant access
    const isParticipant = await conversationRepository.isUserParticipant(conversationId, user.id)
    if (!isParticipant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if message exists and belongs to this conversation
    const message = await messageRepository.getMessageById(messageId)
    if (!message || message.conversationId !== conversationId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user already reacted with this emoji
    const hasReacted = await messageRepository.hasUserReacted(messageId, emoji, user.id)
    if (hasReacted) {
      return NextResponse.json({ error: "Already reacted with this emoji" }, { status: 400 })
    }

    // Add reaction
    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.email.split('@')[0]

    const updatedMessage = await messageRepository.addReactionToMessage(
      messageId,
      emoji,
      user.id,
      userName
    )

    // Broadcast reaction to all conversation participants
    await broadcastToConversation(conversationId, {
      type: "message_reaction_added",
      data: {
        messageId,
        emoji,
        userId: user.id,
        userName,
        timestamp: new Date().toISOString(),
      },
    })

    // Get updated reaction data
    const reactionCounts = await messageRepository.getReactionCounts(messageId)

    return NextResponse.json({
      message: "Reaction added successfully",
      messageId,
      emoji,
      userId: user.id,
      userName,
      counts: reactionCounts,
    })
  } catch (error) {
    console.error("❌ Error adding reaction:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to add reaction" },
      { status: 500 }
    )
  }
}