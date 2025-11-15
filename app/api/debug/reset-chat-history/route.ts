import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  try {
    console.log("💬 Starting chat history reset...");

    // Delete chat-related data in dependency order (children first, then parents)
    const results = [];

    // 1. Delete message user statuses first (dependent on messages)
    try {
      const messageUserStatuses = await prisma.messageUserStatus.deleteMany();
      results.push(
        `Deleted ${messageUserStatuses.count} message user statuses`,
      );
    } catch {
      console.log("MessageUserStatus table doesn't exist or is empty");
    }

    // 2. Delete all messages
    try {
      const messages = await prisma.message.deleteMany();
      results.push(`Deleted ${messages.count} messages`);
    } catch {
      console.log("Message table doesn't exist or is empty");
    }

    // 3. Delete conversation participants
    try {
      const conversationParticipants =
        await prisma.conversationParticipant.deleteMany();
      results.push(
        `Deleted ${conversationParticipants.count} conversation participants`,
      );
    } catch {
      console.log("ConversationParticipant table doesn't exist or is empty");
    }

    // 4. Delete all conversations last (parent table)
    try {
      const conversations = await prisma.conversation.deleteMany();
      results.push(`Deleted ${conversations.count} conversations`);
    } catch {
      console.log("Conversation table doesn't exist or is empty");
    }

    // 5. Delete chat-related notifications (optional cleanup)
    try {
      // Delete notifications that are related to messages/conversations
      const chatNotifications = await prisma.notification.deleteMany({
        where: {
          OR: [
            { type: "MESSAGE" },
            { actionUrl: { contains: "/chat/" } }
          ]
        }
      });
      results.push(`Deleted ${chatNotifications.count} chat-related notifications`);
    } catch {
      console.log("Chat notifications cleanup skipped - table doesn't exist or is empty");
    }

    console.log("✅ Chat history reset completed successfully");

    return NextResponse.json({
      message: "Chat history reset successfully",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Chat history reset failed:", error);
    return NextResponse.json(
      {
        error: "Chat history reset failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}