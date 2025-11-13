import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NotificationType } from "@/lib/types";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import type { NotificationData } from "@/lib/types/api";

const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

// Validation schema for creating a notification
const createNotificationSchema = z.object({
  type: z.nativeEnum(NotificationType),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(1000, "Message must be less than 1000 characters"),
  data: z.custom<NotificationData>().optional(),
  isActionable: z.boolean().optional(),
  actionUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/notifications - Get notifications for current user
export async function GET(request: NextRequest) {
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

    console.log("🔔 GET /api/notifications - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const isRead = searchParams.get("isRead");
    const type = searchParams.get("type") as NotificationType | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get notifications for user
    const notifications = await notificationRepository.getNotificationsForUser(
      user.id,
      {
        isRead: isRead !== null ? isRead === "true" : undefined,
        type: type || undefined,
        page,
        limit,
      },
    );

    return NextResponse.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("❌ GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

// POST /api/notifications - Create notification (Admin only)
export async function POST(request: NextRequest) {
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

    // Only admins can create notifications manually
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: "Access denied: Only administrators can create notifications",
        },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createNotificationSchema.parse(body);

    console.log("🔔 POST /api/notifications - User:", {
      role: user.role,
      email: user.email,
      type: validatedData.type,
    });

    // Create notification
    const notification = await notificationRepository.createNotification({
      userId: user.id, // For now, create for self - could extend to target other users
      type: validatedData.type,
      title: validatedData.title,
      message: validatedData.message,
      data: validatedData.data,
      isActionable: validatedData.isActionable,
      actionUrl: validatedData.actionUrl,
      expiresAt: validatedData.expiresAt
        ? new Date(validatedData.expiresAt)
        : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: notification,
        message: "Notification created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ POST /api/notifications error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 },
    );
  }
}

// PUT /api/notifications - Mark all notifications as read
export async function PUT() {
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

    console.log("🔔 PUT /api/notifications - Mark all as read - User:", {
      role: user.role,
      email: user.email,
    });

    // Mark all notifications as read
    await notificationRepository.markAllAsRead(user.id);

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("❌ PUT /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}
