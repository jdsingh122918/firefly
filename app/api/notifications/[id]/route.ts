import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

// GET /api/notifications/[id] - Get specific notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const notificationId = id;

    console.log("🔔 GET /api/notifications/[id] - User:", {
      role: user.role,
      email: user.email,
      notificationId,
    });

    // Get notifications for user to check if they own this notification
    const userNotifications =
      await notificationRepository.getNotificationsForUser(user.id, {
        page: 1,
        limit: 1000, // Get all to search through them
      });

    const notification = userNotifications.items.find(
      (n) => n.id === notificationId,
    );

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found or access denied" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error("❌ GET /api/notifications/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification" },
      { status: 500 },
    );
  }
}

// PUT /api/notifications/[id] - Mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const notificationId = id;

    console.log("🔔 PUT /api/notifications/[id] - Mark as read - User:", {
      role: user.role,
      email: user.email,
      notificationId,
    });

    // Verify user owns this notification by checking if it exists in their notifications
    const userNotifications =
      await notificationRepository.getNotificationsForUser(user.id, {
        page: 1,
        limit: 1000,
      });

    const exists = userNotifications.items.some((n) => n.id === notificationId);

    if (!exists) {
      return NextResponse.json(
        { error: "Notification not found or access denied" },
        { status: 404 },
      );
    }

    // Mark as read
    const updatedNotification =
      await notificationRepository.markAsRead(notificationId);

    return NextResponse.json({
      success: true,
      data: updatedNotification,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("❌ PUT /api/notifications/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 },
    );
  }
}

// DELETE /api/notifications/[id] - Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const notificationId = id;

    console.log("🔔 DELETE /api/notifications/[id] - User:", {
      role: user.role,
      email: user.email,
      notificationId,
    });

    // Verify user owns this notification by checking if it exists in their notifications
    const userNotifications =
      await notificationRepository.getNotificationsForUser(user.id, {
        page: 1,
        limit: 1000,
      });

    const notification = userNotifications.items.find(
      (n) => n.id === notificationId,
    );

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found or access denied" },
        { status: 404 },
      );
    }

    // Users can delete their own notifications, admins can delete any
    const canDelete =
      notification.userId === user.id || user.role === UserRole.ADMIN;

    if (!canDelete) {
      return NextResponse.json(
        { error: "Access denied: You can only delete your own notifications" },
        { status: 403 },
      );
    }

    // Delete notification
    await notificationRepository.deleteNotification(notificationId);

    return NextResponse.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE /api/notifications/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
