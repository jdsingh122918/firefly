import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ForumVisibility } from "@prisma/client";
import { UserRole } from "@/lib/auth/roles";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";

const forumRepository = new ForumRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Validation schema for creating a forum
const createForumSchema = z.object({
  title: z
    .string()
    .min(1, "Forum title is required")
    .max(100, "Forum title must be less than 100 characters"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  visibility: z.enum(["PUBLIC", "FAMILY", "ROLE_BASED", "PRIVATE"], {
    message: "Visibility must be PUBLIC, FAMILY, ROLE_BASED, or PRIVATE",
  }).optional(),
  familyId: z.string().optional(),
  allowedRoles: z.array(z.string()).optional(),
  rules: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

// GET /api/forums - List forums with filtering
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

    console.log("🏛️ GET /api/forums - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const visibility = searchParams.get("visibility") as ForumVisibility | null;
    const familyId = searchParams.get("familyId");
    const createdBy = searchParams.get("createdBy");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") as "createdAt" | "lastActivityAt" | "title" | "postCount" | "memberCount" || "lastActivityAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "desc";
    const includeMembers = searchParams.get("includeMembers") === "true";

    // Build filters object
    const filters = {
      ...(visibility && { visibility }),
      ...(familyId && { familyId }),
      ...(createdBy && { createdBy }),
      ...(search && { search }),
      isActive: true,
      isArchived: false,
    };

    console.log("🔍 Forum filters applied:", filters);

    // Get forums with pagination
    const result = await forumRepository.getForums(filters, {
      page,
      limit,
      sortBy,
      sortOrder,
      includeMembers,
    });

    // Filter forums based on user permissions
    const accessibleForums = result.items.filter(forum => {
      // Public forums are always accessible
      if (forum.visibility === ForumVisibility.PUBLIC) {
        return true;
      }

      // Family forums - user must be in the same family
      if (forum.visibility === ForumVisibility.FAMILY) {
        return forum.familyId === user.familyId;
      }

      // Role-based forums - check if user's role is allowed
      if (forum.visibility === ForumVisibility.ROLE_BASED) {
        return forum.allowedRoles.includes(user.role);
      }

      // Private forums - user must be a member or creator
      if (forum.visibility === ForumVisibility.PRIVATE) {
        return forum.createdBy === user.id; // Check membership separately if needed
      }

      return false;
    });

    console.log("✅ Forums retrieved:", {
      total: result.total,
      accessible: accessibleForums.length,
      filters
    });

    // Format response with membership status
    const formattedForums = await Promise.all(
      accessibleForums.map(async (forum) => {
        // Check if user is a member
        const isMember = await forumRepository.isMember(forum.id, user.id);
        const isCreator = forum.createdBy === user.id;

        return {
          id: forum.id,
          title: forum.title,
          description: forum.description,
          slug: forum.slug,
          icon: forum.icon,
          color: forum.color,
          visibility: forum.visibility,
          familyId: forum.familyId,
          family: forum.family ? {
            id: forum.family.id,
            name: forum.family.name,
          } : null,
          allowedRoles: forum.allowedRoles,
          rules: forum.rules,
          settings: forum.settings,
          isActive: forum.isActive,
          isArchived: forum.isArchived,
          postCount: forum.postCount,
          memberCount: forum.memberCount,
          lastActivityAt: forum.lastActivityAt,
          lastPostAt: forum.lastPostAt,
          createdAt: forum.createdAt,
          creator: forum.creator ? {
            id: forum.creator.id,
            name: forum.creator.firstName
              ? `${forum.creator.firstName} ${forum.creator.lastName || ""}`.trim()
              : forum.creator.email,
          } : null,
          members: includeMembers && forum.members ? forum.members.filter(member => member.user).slice(0, 5).map(member => ({
            id: member.user!.id,
            name: member.user!.firstName
              ? `${member.user!.firstName} ${member.user!.lastName || ""}`.trim()
              : member.user!.email,
            role: member.role,
            joinedAt: member.joinedAt,
          })) : [],
          // Add membership status
          isMember,
          isCreator,
        };
      })
    );

    return NextResponse.json({
      forums: formattedForums,
      total: accessibleForums.length,
      page,
      limit,
      hasNextPage: page * limit < accessibleForums.length,
      hasPrevPage: page > 1,
      filters: {
        visibility: visibility || null,
        familyId: familyId || null,
        createdBy: createdBy || null,
        search: search || null,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching forums:", error);
    return NextResponse.json(
      { error: "Failed to fetch forums" },
      { status: 500 },
    );
  }
}

// POST /api/forums - Create a new forum
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

    // Only ADMIN and VOLUNTEER can create forums
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions. Only admins and volunteers can create forums." },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createForumSchema.parse(body);

    console.log("🏛️ Creating forum:", {
      data: validatedData,
      createdBy: user.email,
    });

    // Create forum
    const forum = await forumRepository.createForum({
      title: validatedData.title,
      description: validatedData.description,
      icon: validatedData.icon,
      color: validatedData.color,
      visibility: validatedData.visibility as ForumVisibility || ForumVisibility.PUBLIC,
      familyId: validatedData.familyId,
      allowedRoles: validatedData.allowedRoles || [],
      createdBy: user.id,
      rules: validatedData.rules,
      settings: validatedData.settings || {},
    });

    console.log("✅ Forum created successfully:", {
      forumId: forum.id,
      title: forum.title,
      slug: forum.slug,
    });

    // Create forum creation notification for admin users
    await createForumCreatedNotification(forum.id, user.id);

    return NextResponse.json(
      {
        success: true,
        forum: {
          id: forum.id,
          title: forum.title,
          description: forum.description,
          slug: forum.slug,
          icon: forum.icon,
          color: forum.color,
          visibility: forum.visibility,
          familyId: forum.familyId,
          family: forum.family ? {
            id: forum.family.id,
            name: forum.family.name,
          } : null,
          allowedRoles: forum.allowedRoles,
          rules: forum.rules,
          isActive: forum.isActive,
          postCount: forum.postCount,
          memberCount: forum.memberCount,
          lastActivityAt: forum.lastActivityAt,
          createdAt: forum.createdAt,
          creator: forum.creator ? {
            id: forum.creator.id,
            name: forum.creator.firstName
              ? `${forum.creator.firstName} ${forum.creator.lastName || ""}`.trim()
              : forum.creator.email,
          } : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating forum:", error);

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

    // Handle unique constraint errors (duplicate slug)
    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json(
        {
          error: "A forum with this title already exists. Please choose a different title.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create forum" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications when a forum is created
async function createForumCreatedNotification(
  forumId: string,
  creatorId: string,
): Promise<void> {
  try {
    // Get forum details
    const forum = await forumRepository.getForumById(forumId);
    if (!forum) return;

    // Get creator details
    const creator = await userRepository.getUserById(creatorId);
    if (!creator) return;

    // Notify admin users about new forum creation (exclude creator)
    const adminUsers = await userRepository.getUsersByRole(UserRole.ADMIN);
    const usersToNotify = adminUsers.filter(admin => admin.id !== creatorId);

    if (usersToNotify.length === 0) return;

    // Create notifications for admin users
    const notifications = usersToNotify.map((admin) => ({
      userId: admin.id,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "New Forum Created",
      message: `${creator.firstName || creator.email || "A user"} ${creator.lastName || ""} created a new forum: "${forum.title}"`,
      data: {
        forumId,
        forumTitle: forum.title,
        forumSlug: forum.slug,
        creatorId,
        creatorName: `${creator.firstName || creator.email || "A user"} ${creator.lastName || ""}`,
        activityType: "forum_created"
      },
      actionUrl: `/${admin.role.toLowerCase()}/forums/${forum.slug}`,
      isActionable: true
    }));

    // Create notifications in parallel
    await Promise.all(
      notifications.map((notification) =>
        notificationRepository.createNotification(notification),
      ),
    );

    console.log("✅ Forum creation notifications sent:", {
      forumId,
      forumTitle: forum.title,
      notificationCount: notifications.length
    });
  } catch (error) {
    console.error("❌ Failed to create forum creation notifications:", error);
    // Don't throw error as this is not critical for forum creation
  }
}