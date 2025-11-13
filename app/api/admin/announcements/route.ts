import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@/lib/auth/roles";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { NotificationType } from "@/lib/types";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import type { NotificationData } from "@/lib/types/api";

const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

// Validation schema for creating an admin announcement
const createAnnouncementSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(1000, "Message must be less than 1000 characters"),
  targetAudience: z.enum(["ALL", "ADMIN", "VOLUNTEER", "MEMBER", "FAMILY"]),
  familyId: z.string().optional(), // Required if targetAudience is "FAMILY"
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  isActionable: z.boolean().optional().default(true),
  actionUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  // Calendar event fields
  isCalendarEvent: z.boolean().optional().default(false),
  eventDate: z.string().datetime().optional(),
  eventLocation: z.string().optional(),
});

// POST /api/admin/announcements - Create admin announcement
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

    // Only admins can create announcements
    if (user.role !== PrismaUserRole.ADMIN) {
      return NextResponse.json(
        { error: "Access denied: Only administrators can create announcements" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createAnnouncementSchema.parse(body);

    console.log("📢 Creating admin announcement:", {
      createdBy: user.email,
      title: validatedData.title,
      targetAudience: validatedData.targetAudience,
      priority: validatedData.priority,
      isCalendarEvent: validatedData.isCalendarEvent,
    });

    // Get target users based on audience
    let targetUsers: Array<{ id: string; role: PrismaUserRole }> = [];

    switch (validatedData.targetAudience) {
      case "ALL":
        const allUsers = await userRepository.getAllUsers();
        targetUsers = allUsers.map(u => ({ id: u.id, role: u.role }));
        break;

      case "ADMIN":
        const adminUsers = await userRepository.getUsersByRole(UserRole.ADMIN);
        targetUsers = adminUsers.map(u => ({ id: u.id, role: u.role }));
        break;

      case "VOLUNTEER":
        const volunteerUsers = await userRepository.getUsersByRole(UserRole.VOLUNTEER);
        targetUsers = volunteerUsers.map(u => ({ id: u.id, role: u.role }));
        break;

      case "MEMBER":
        const memberUsers = await userRepository.getUsersByRole(UserRole.MEMBER);
        targetUsers = memberUsers.map(u => ({ id: u.id, role: u.role }));
        break;

      case "FAMILY":
        if (!validatedData.familyId) {
          return NextResponse.json(
            { error: "Family ID is required for family announcements" },
            { status: 400 },
          );
        }
        // Get all users and filter by family ID
        const allUsersForFamily = await userRepository.getAllUsers();
        const familyUsers = allUsersForFamily.filter(u => u.familyId === validatedData.familyId);
        targetUsers = familyUsers.map(u => ({ id: u.id, role: u.role }));
        break;

      default:
        return NextResponse.json(
          { error: "Invalid target audience" },
          { status: 400 },
        );
    }

    // Filter out the creator from receiving their own announcement
    targetUsers = targetUsers.filter(u => u.id !== user.id);

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { error: "No target users found for this announcement" },
        { status: 400 },
      );
    }

    // Prepare notification data
    const notificationData: NotificationData = {
      priority: validatedData.priority,
      announcementId: `announcement-${Date.now()}`,
      createdBy: user.id,
      createdByName: `${user.firstName} ${user.lastName || ""}`,
      targetAudience: validatedData.targetAudience,
    };

    // Add calendar event data if applicable
    if (validatedData.isCalendarEvent && validatedData.eventDate) {
      notificationData.eventDate = validatedData.eventDate;
      notificationData.eventTitle = validatedData.title;
      notificationData.eventLocation = validatedData.eventLocation;
    }

    // Add family data if applicable
    if (validatedData.targetAudience === "FAMILY" && validatedData.familyId) {
      notificationData.familyId = validatedData.familyId;
    }

    // Create notifications for all target users
    const notifications = targetUsers.map((targetUser) => ({
      userId: targetUser.id,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: validatedData.title,
      message: validatedData.message,
      data: notificationData,
      isActionable: validatedData.isActionable,
      actionUrl: validatedData.actionUrl,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
    }));

    // Create notifications in parallel batches (to avoid overwhelming the database)
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < notifications.length; i += batchSize) {
      batches.push(notifications.slice(i, i + batchSize));
    }

    let createdCount = 0;
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((notification) =>
          notificationRepository.createNotification(notification),
        ),
      );

      createdCount += results.filter(result => result.status === 'fulfilled').length;

      // Log any failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error("❌ Some notifications failed to create:", failures);
      }
    }

    console.log("✅ Admin announcement sent successfully:", {
      title: validatedData.title,
      targetAudience: validatedData.targetAudience,
      targetCount: targetUsers.length,
      createdCount,
      isCalendarEvent: validatedData.isCalendarEvent,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Announcement sent successfully",
        data: {
          title: validatedData.title,
          targetAudience: validatedData.targetAudience,
          targetCount: targetUsers.length,
          createdCount,
          isCalendarEvent: validatedData.isCalendarEvent,
          priority: validatedData.priority,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating admin announcement:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 },
    );
  }
}

// GET /api/admin/announcements - Get announcement history (Admin only)
export async function GET(request: NextRequest) {
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

    // Only admins can view announcement history
    if (user.role !== PrismaUserRole.ADMIN) {
      return NextResponse.json(
        { error: "Access denied: Only administrators can view announcement history" },
        { status: 403 },
      );
    }

    console.log("📢 GET /api/admin/announcements - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get system announcements created by admins (for history tracking)
    // This is a simplified implementation - in production you might want a separate announcements table
    const announcements = await notificationRepository.getNotificationsForUser(
      user.id,
      {
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        page,
        limit,
      },
    );

    return NextResponse.json({
      success: true,
      data: announcements,
      message: "Announcement history retrieved successfully",
    });
  } catch (error) {
    console.error("❌ Error fetching announcement history:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcement history" },
      { status: 500 },
    );
  }
}