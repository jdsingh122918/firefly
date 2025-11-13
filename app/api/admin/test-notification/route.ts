import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";
import {
  broadcastNotificationToUser,
  broadcastUnreadCountToUser
} from "@/app/api/notifications/stream/route";

const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

/**
 * POST /api/admin/test-notification - Create a test notification
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Only allow admin users to create test notifications
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Create test notification
    const testNotification = await notificationRepository.createNotification({
      userId: user.id,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: "Test Notification",
      message: `Test notification sent at ${new Date().toLocaleTimeString()}`,
      isActionable: true,
      data: {
        testData: "This is a test notification to verify the SSE system is working",
        generatedAt: new Date().toISOString()
      }
    });

    console.log("🔔 Test notification created:", {
      id: testNotification.id,
      userId: user.id,
      title: testNotification.title
    });

    // Broadcast to real-time connections
    broadcastNotificationToUser(user.id, {
      id: testNotification.id,
      type: testNotification.type,
      title: testNotification.title,
      message: testNotification.message,
      data: testNotification.data as Record<string, unknown> | undefined,
      isActionable: testNotification.isActionable,
      actionUrl: testNotification.actionUrl || undefined,
      createdAt: testNotification.createdAt
    });

    // Update unread count
    const unreadCount = await notificationRepository.getUnreadCount(user.id);
    broadcastUnreadCountToUser(user.id, unreadCount);

    return NextResponse.json({
      success: true,
      message: "Test notification created successfully",
      data: {
        notificationId: testNotification.id,
        unreadCount
      }
    });

  } catch (error) {
    console.error("❌ Failed to create test notification:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}