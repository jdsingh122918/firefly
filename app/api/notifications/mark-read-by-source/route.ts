import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { broadcastUnreadCountToUser } from "@/app/api/notifications/stream/route";

const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

// Allowed source fields for security - prevent arbitrary field injection
const ALLOWED_SOURCE_FIELDS = [
  "conversationId",
  "postId",
  "forumId",
  "resourceId",
  "alertId",
  "announcementId",
];

/**
 * PUT /api/notifications/mark-read-by-source
 * Mark all notifications related to a specific source entity as read
 *
 * Body: { sourceField: string, sourceValue: string }
 * Response: { success: true, data: { markedCount: number } }
 */
export async function PUT(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { sourceField, sourceValue } = body;

    // Validate required fields
    if (!sourceField || !sourceValue) {
      return NextResponse.json(
        { error: "Missing required fields: sourceField and sourceValue" },
        { status: 400 },
      );
    }

    // Validate sourceField is allowed (security check)
    if (!ALLOWED_SOURCE_FIELDS.includes(sourceField)) {
      return NextResponse.json(
        {
          error: `Invalid sourceField. Allowed values: ${ALLOWED_SOURCE_FIELDS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate sourceValue is a non-empty string
    if (typeof sourceValue !== "string" || sourceValue.trim().length === 0) {
      return NextResponse.json(
        { error: "sourceValue must be a non-empty string" },
        { status: 400 },
      );
    }

    console.log("🔔 PUT /api/notifications/mark-read-by-source - User:", {
      userId: user.id,
      email: user.email,
      sourceField,
      sourceValue,
    });

    // Mark notifications as read by source
    const result = await notificationRepository.markReadBySource(
      user.id,
      sourceField,
      sourceValue.trim(),
    );

    // If notifications were marked, broadcast the updated unread count
    if (result.markedCount > 0) {
      const unreadCount = await notificationRepository.getUnreadCount(user.id);
      broadcastUnreadCountToUser(user.id, unreadCount);
    }

    return NextResponse.json({
      success: true,
      data: {
        markedCount: result.markedCount,
      },
      message:
        result.markedCount > 0
          ? `Marked ${result.markedCount} notification(s) as read`
          : "No matching unread notifications found",
    });
  } catch (error) {
    console.error("❌ PUT /api/notifications/mark-read-by-source error:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}
