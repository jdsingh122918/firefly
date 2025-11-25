import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@/lib/auth/roles";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { notificationDispatcher } from "@/lib/notifications/notification-dispatcher.service";
import { NotificationType } from "@/lib/types";

const userRepository = new UserRepository();

const testNotificationSchema = z.object({
  targetUserId: z.string().optional(), // If not provided, sends to self
  title: z.string().default("Test Notification"),
  message: z.string().default("This is a test notification from the debug dashboard."),
  type: z.enum([
    "MESSAGE",
    "CARE_UPDATE",
    "SYSTEM_ANNOUNCEMENT",
    "FAMILY_ACTIVITY",
    "EMERGENCY_ALERT",
  ]).default("SYSTEM_ANNOUNCEMENT"),
  isActionable: z.boolean().default(true),
  actionUrl: z.string().optional(),
});

/**
 * POST /api/admin/notifications/test - Send a test notification
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN can send test notifications
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = testNotificationSchema.parse(body);

    // Determine target user
    const targetUserId = validatedData.targetUserId || user.id;
    const targetUser = await userRepository.getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const recipientName = targetUser.firstName
      ? `${targetUser.firstName} ${targetUser.lastName || ""}`.trim()
      : targetUser.email;

    console.log("🔔 Sending test notification:", {
      from: user.email,
      to: targetUser.email,
      type: validatedData.type,
    });

    // Dispatch the test notification
    const result = await notificationDispatcher.dispatchNotification(
      targetUserId,
      validatedData.type as NotificationType,
      {
        title: validatedData.title,
        message: validatedData.message,
        data: {
          isTest: true,
          sentBy: user.id,
          sentByEmail: user.email,
          testTimestamp: new Date().toISOString(),
        },
        isActionable: validatedData.isActionable,
        actionUrl: validatedData.actionUrl || "/admin/notifications/debug",
      },
      {
        recipientName,
        senderName: `${user.firstName} ${user.lastName || ""}`,
      }
    );

    console.log("✅ Test notification dispatched:", result);

    return NextResponse.json({
      success: result.success,
      data: {
        notificationId: result.inAppNotification?.id,
        sseDelivered: result.sseDelivered,
        deliveryLogId: result.deliveryLogId,
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          name: recipientName,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error sending test notification:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
