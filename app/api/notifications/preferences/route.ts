import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

// Validation schema for updating notification preferences
const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailMessages: z.boolean().optional(),
  emailCareUpdates: z.boolean().optional(),
  emailAnnouncements: z.boolean().optional(),
  emailFamilyActivity: z.boolean().optional(),
  emailEmergencyAlerts: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  inAppMessages: z.boolean().optional(),
  inAppCareUpdates: z.boolean().optional(),
  inAppAnnouncements: z.boolean().optional(),
  inAppFamilyActivity: z.boolean().optional(),
  inAppEmergencyAlerts: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)")
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)")
    .optional(),
  timezone: z.string().optional(),
});

// GET /api/notifications/preferences - Get user's notification preferences
export async function GET() {
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

    console.log("🔔 GET /api/notifications/preferences - User:", {
      role: user.role,
      email: user.email,
    });

    // Get notification preferences
    const preferences = await notificationRepository.getNotificationPreferences(
      user.id,
    );

    // If no preferences exist, return default values
    if (!preferences) {
      const defaultPreferences = {
        id: null,
        userId: user.id,
        emailEnabled: true,
        emailMessages: true,
        emailCareUpdates: true,
        emailAnnouncements: true,
        emailFamilyActivity: false,
        emailEmergencyAlerts: true,
        inAppEnabled: true,
        inAppMessages: true,
        inAppCareUpdates: true,
        inAppAnnouncements: true,
        inAppFamilyActivity: true,
        inAppEmergencyAlerts: true,
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return NextResponse.json({
        success: true,
        data: defaultPreferences,
      });
    }

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("❌ GET /api/notifications/preferences error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 },
    );
  }
}

// PUT /api/notifications/preferences - Update user's notification preferences
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updatePreferencesSchema.parse(body);

    console.log("🔔 PUT /api/notifications/preferences - User:", {
      role: user.role,
      email: user.email,
      updates: Object.keys(validatedData),
    });

    // Validate quiet hours if provided
    if (
      validatedData.quietHoursEnabled &&
      (!validatedData.quietHoursStart || !validatedData.quietHoursEnd)
    ) {
      return NextResponse.json(
        {
          error:
            "Quiet hours start and end times are required when quiet hours are enabled",
        },
        { status: 400 },
      );
    }

    // Update notification preferences
    const preferences =
      await notificationRepository.upsertNotificationPreferences(
        user.id,
        validatedData,
      );

    return NextResponse.json({
      success: true,
      data: preferences,
      message: "Notification preferences updated successfully",
    });
  } catch (error) {
    console.error("❌ PUT /api/notifications/preferences error:", error);

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
      { error: "Failed to update notification preferences" },
      { status: 500 },
    );
  }
}
