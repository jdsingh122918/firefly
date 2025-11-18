import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { MessageRepository } from "@/lib/db/repositories/message.repository"
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository"
import { UserRepository } from "@/lib/db/repositories/user.repository"
import { broadcastToConversation } from "@/lib/utils/sse-utils"

const messageRepository = new MessageRepository()
const conversationRepository = new ConversationRepository()
const userRepository = new UserRepository()

/**
 * DELETE /api/conversations/[id]/messages/[messageId]/reactions/[emoji]
 * Remove a reaction from a message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string; emoji: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: conversationId, messageId, emoji } = await params

    // Decode the emoji (in case it was URL encoded)
    const decodedEmoji = decodeURIComponent(emoji)

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

    // Check if user has reacted with this emoji
    const hasReacted = await messageRepository.hasUserReacted(messageId, decodedEmoji, user.id)
    if (!hasReacted) {
      return NextResponse.json({ error: "Reaction not found" }, { status: 404 })
    }

    // Remove reaction
    const updatedMessage = await messageRepository.removeReactionFromMessage(
      messageId,
      decodedEmoji,
      user.id
    )

    // Get user name for broadcast
    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.email.split('@')[0]

    // Broadcast reaction removal to all conversation participants
    await broadcastToConversation(conversationId, {
      type: "message_reaction_removed",
      data: {
        messageId,
        emoji: decodedEmoji,
        userId: user.id,
        userName,
        timestamp: new Date().toISOString(),
      },
    })

    // Get updated reaction data
    const reactionCounts = await messageRepository.getReactionCounts(messageId)

    return NextResponse.json({
      message: "Reaction removed successfully",
      messageId,
      emoji: decodedEmoji,
      userId: user.id,
      counts: reactionCounts,
    })
  } catch (error) {
    console.error("❌ Error removing reaction:", error)
    return NextResponse.json(
      { error: "Failed to remove reaction" },
      { status: 500 }
    )
  }
}