import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  try {
    console.log("🔄 Starting database reset...");

    // Delete all data in dependency order (children first, then parents)
    const results = [];

    // 1. Delete message-related data
    try {
      const messageUserStatuses = await prisma.messageUserStatus.deleteMany();
      results.push(
        `Deleted ${messageUserStatuses.count} message user statuses`,
      );
    } catch {
      console.log("MessageUserStatus table doesn't exist or is empty");
    }

    try {
      const messages = await prisma.message.deleteMany();
      results.push(`Deleted ${messages.count} messages`);
    } catch {
      console.log("Message table doesn't exist or is empty");
    }

    try {
      const conversationParticipants =
        await prisma.conversationParticipant.deleteMany();
      results.push(
        `Deleted ${conversationParticipants.count} conversation participants`,
      );
    } catch {
      console.log("ConversationParticipant table doesn't exist or is empty");
    }

    try {
      const conversations = await prisma.conversation.deleteMany();
      results.push(`Deleted ${conversations.count} conversations`);
    } catch {
      console.log("Conversation table doesn't exist or is empty");
    }

    // 2. Delete notification-related data
    try {
      const notifications = await prisma.notification.deleteMany();
      results.push(`Deleted ${notifications.count} notifications`);
    } catch {
      console.log("Notification table doesn't exist or is empty");
    }

    try {
      const notificationPreferences =
        await prisma.notificationPreferences.deleteMany();
      results.push(
        `Deleted ${notificationPreferences.count} notification preferences`,
      );
    } catch {
      console.log("NotificationPreferences table doesn't exist or is empty");
    }

    // 3. Delete document and tagging system data
    try {
      const resourceTags = await prisma.resourceTag.deleteMany();
      results.push(`Deleted ${resourceTags.count} resource tags`);
    } catch {
      console.log("ResourceTag table doesn't exist or is empty");
    }

    try {
      const documents = await prisma.document.deleteMany();
      results.push(`Deleted ${documents.count} documents`);
    } catch {
      console.log("Document table doesn't exist or is empty");
    }

    try {
      const tags = await prisma.tag.deleteMany();
      results.push(`Deleted ${tags.count} tags`);
    } catch {
      console.log("Tag table doesn't exist or is empty");
    }

    try {
      const categories = await prisma.category.deleteMany();
      results.push(`Deleted ${categories.count} categories`);
    } catch {
      console.log("Category table doesn't exist or is empty");
    }

    // 4. Delete users (this will cascade delete family relationships)
    try {
      const users = await prisma.user.deleteMany();
      results.push(`Deleted ${users.count} users`);
    } catch {
      console.log("User table doesn't exist or is empty");
    }

    // 5. Delete families (should be empty now but just to be safe)
    try {
      const families = await prisma.family.deleteMany();
      results.push(`Deleted ${families.count} families`);
    } catch {
      console.log("Family table doesn't exist or is empty");
    }

    console.log("✅ Database reset completed successfully");

    return NextResponse.json({
      message: "Database reset successfully",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Database reset failed:", error);
    return NextResponse.json(
      {
        error: "Database reset failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
