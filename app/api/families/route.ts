import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@/lib/auth/roles";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Validation schema for creating a family
const createFamilySchema = z.object({
  name: z
    .string()
    .min(1, "Family name is required")
    .max(100, "Family name must be less than 100 characters"),
  description: z.string().optional(),
});

// GET /api/families - List all families
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

    // Only ADMIN and VOLUNTEER can view families
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    console.log("📋 GET /api/families - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const createdBy = searchParams.get("createdBy");

    // Get families based on role and filters
    let families;
    if (user.role === UserRole.ADMIN) {
      // Admins can see all families
      families = await familyRepository.getAllFamilies();
    } else if (user.role === UserRole.VOLUNTEER) {
      // Volunteers can only see families they created
      families = await familyRepository.getFamiliesByCreator(user.id);
    } else {
      // Members can only see their own family
      families = user.familyId
        ? [await familyRepository.getFamilyById(user.familyId)].filter(Boolean)
        : [];
    }

    // Apply search filter if provided
    if (search && families) {
      const searchLower = search.toLowerCase();
      families = families.filter(
        (family) =>
          family && (
            family.name.toLowerCase().includes(searchLower) ||
            (family.description &&
              family.description.toLowerCase().includes(searchLower))
          ),
      );
    }

    console.log("✅ Families retrieved:", {
      count: families?.length,
      search,
      createdBy,
    });

    return NextResponse.json({
      families: (families || []).filter(family => family !== null).map(family => ({
        id: family.id,
        name: family.name,
        description: family.description,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
        createdBy: family.createdBy ? {
          id: family.createdBy.id,
          name: family.createdBy.firstName
            ? `${family.createdBy.firstName} ${family.createdBy.lastName || ""}`.trim()
            : family.createdBy.email,
          email: family.createdBy.email,
        } : undefined,
        members: (family.members || []).map(member => ({
          id: member.id,
          name: member.firstName
            ? `${member.firstName} ${member.lastName || ""}`.trim()
            : member.email,
          email: member.email,
          role: member.role,
        })),
        memberCount: (family.members || []).length,
      })),
      total: families?.length || 0,
    });
  } catch (error) {
    console.error("❌ Error fetching families:", error);
    return NextResponse.json(
      { error: "Failed to fetch families" },
      { status: 500 },
    );
  }
}

// POST /api/families - Create a new family
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

    // Only ADMIN and VOLUNTEER can create families
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createFamilySchema.parse(body);

    console.log("👨‍👩‍👧‍👦 Creating family:", {
      data: validatedData,
      createdBy: user.email,
    });

    // Create family
    const family = await familyRepository.createFamily({
      name: validatedData.name,
      description: validatedData.description,
      createdById: user.id,
    });

    console.log("✅ Family created successfully:", {
      familyId: family.id,
      name: family.name,
    });

    // Create family activity notification for admin users
    await createFamilyCreatedNotification(family.id, user.id);

    return NextResponse.json(
      {
        success: true,
        family: {
          id: family.id,
          name: family.name,
          description: family.description,
          createdAt: family.createdAt,
          createdBy: {
            id: user.id,
            name: user.firstName
              ? `${user.firstName} ${user.lastName || ""}`.trim()
              : user.email,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating family:", error);

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
      { error: "Failed to create family" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications when a family is created
async function createFamilyCreatedNotification(
  familyId: string,
  creatorId: string,
): Promise<void> {
  try {
    // Get family details
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) return;

    // Get creator details
    const creator = await userRepository.getUserById(creatorId);
    if (!creator) return;

    // Notify admin users about new family creation (exclude creator)
    const adminUsers = await userRepository.getUsersByRole(UserRole.ADMIN);
    const usersToNotify = adminUsers.filter(admin => admin.id !== creatorId);

    if (usersToNotify.length === 0) return;

    // Create notifications for admin users
    const notifications = usersToNotify.map((admin) => ({
      userId: admin.id,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "New Family Created",
      message: `${creator.firstName} ${creator.lastName || ""} created a new family: "${family.name}"`,
      data: {
        familyId,
        familyName: family.name,
        creatorId,
        creatorName: `${creator.firstName} ${creator.lastName || ""}`,
        activityType: "family_created"
      },
      actionUrl: `/admin/families/${familyId}`,
      isActionable: true
    }));

    // Create notifications in parallel
    await Promise.all(
      notifications.map((notification) =>
        notificationRepository.createNotification(notification),
      ),
    );

    console.log("✅ Family creation notifications sent:", {
      familyId,
      familyName: family.name,
      notificationCount: notifications.length
    });
  } catch (error) {
    console.error("❌ Failed to create family creation notifications:", error);
    // Don't throw error as this is not critical for family creation
  }
}
