import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole, ForumVisibility } from "@prisma/client";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const forumRepository = new ForumRepository();
const userRepository = new UserRepository();

// Validation schema for updating a forum
const updateForumSchema = z.object({
  title: z
    .string()
    .min(1, "Forum title is required")
    .max(100, "Forum title must be less than 100 characters")
    .optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  visibility: z.enum(["PUBLIC", "FAMILY", "ROLE_BASED", "PRIVATE"]).optional(),
  allowedRoles: z.array(z.string()).optional(),
  moderators: z.array(z.string()).optional(),
  rules: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// GET /api/forums/[id] - Get forum by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includePosts = searchParams.get("includePosts") === "true";
    const includeMembers = searchParams.get("includeMembers") === "true";

    console.log("🏛️ GET /api/forums/[id] - User:", {
      role: user.role,
      email: user.email,
      forumId: id,
    });

    // Get forum
    const forum = await forumRepository.getForumById(id, {
      includeDeleted: false,
      includePosts,
      includeMembers,
    });

    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check access permissions
    const hasAccess = await checkForumAccess(forum, user);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this forum" },
        { status: 403 }
      );
    }

    // Check if user is a member
    let isMember = await forumRepository.isMember(forum.id, user.id);

    // Auto-enroll user in PUBLIC forums if not already a member
    if (!isMember && forum.visibility === ForumVisibility.PUBLIC) {
      try {
        await forumRepository.addMember({
          forumId: forum.id,
          userId: user.id,
          role: "member",
          notifications: true, // Enable notifications by default
        });
        isMember = true;
        console.log("✅ Auto-enrolled user in PUBLIC forum:", {
          forumId: forum.id,
          userId: user.id,
          forumTitle: forum.title,
        });
      } catch (error) {
        // If enrollment fails (e.g., user already a member due to race condition),
        // don't break the API - just log and continue
        console.error("⚠️ Failed to auto-enroll user in forum:", error);
      }
    }

    console.log("✅ Forum retrieved:", {
      forumId: forum.id,
      title: forum.title,
      isMember,
    });

    // Format response
    const formattedForum = {
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
      moderators: forum.moderators,
      rules: forum.rules,
      settings: forum.settings,
      isActive: forum.isActive,
      isArchived: forum.isArchived,
      postCount: forum.postCount,
      memberCount: forum.memberCount,
      lastActivityAt: forum.lastActivityAt,
      lastPostAt: forum.lastPostAt,
      lastPostBy: forum.lastPostBy,
      createdAt: forum.createdAt,
      updatedAt: forum.updatedAt,
      creator: forum.creator ? {
        id: forum.creator.id,
        name: forum.creator.firstName
          ? `${forum.creator.firstName} ${forum.creator.lastName || ""}`.trim()
          : forum.creator.email,
      } : null,
      posts: includePosts && forum.posts ? forum.posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        type: post.type,
        isPinned: post.isPinned,
        isLocked: post.isLocked,
        viewCount: post.viewCount,
        replyCount: post.replyCount,
        score: post.score,
        lastReplyAt: post.lastReplyAt,
        createdAt: post.createdAt,
        author: post.author ? {
          id: post.author.id,
          name: post.author.firstName
            ? `${post.author.firstName} ${post.author.lastName || ""}`.trim()
            : post.author.email,
        } : null,
      })) : [],
      members: includeMembers && forum.members ? forum.members.filter(member => member.user).map(member => ({
        id: member.user!.id,
        name: member.user!.firstName
          ? `${member.user!.firstName} ${member.user!.lastName || ""}`.trim()
          : member.user!.email,
        role: member.role,
        postCount: member.postCount,
        replyCount: member.replyCount,
        joinedAt: member.joinedAt,
        lastViewedAt: member.lastViewedAt,
      })) : [],
      userMembership: isMember ? {
        role: "member", // Would need to fetch actual role
        joinedAt: new Date(), // Would need to fetch actual join date
        notifications: true, // Would need to fetch actual preference
      } : null,
    };

    return NextResponse.json({
      forum: formattedForum,
    });
  } catch (error) {
    console.error("❌ Error fetching forum:", error);
    return NextResponse.json(
      { error: "Failed to fetch forum" },
      { status: 500 },
    );
  }
}

// PUT /api/forums/[id] - Update forum
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get forum to check permissions
    const forum = await forumRepository.getForumById(id);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check permissions: creator, moderator, or admin
    const canEdit = await checkForumEditPermissions(forum, user);
    if (!canEdit) {
      return NextResponse.json(
        { error: "Insufficient permissions to edit this forum" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateForumSchema.parse(body);

    console.log("🏛️ Updating forum:", {
      forumId: id,
      data: validatedData,
      updatedBy: user.email,
    });

    // Update forum
    const updatedForum = await forumRepository.updateForum(id, validatedData);

    console.log("✅ Forum updated successfully:", {
      forumId: updatedForum.id,
      title: updatedForum.title,
      changes: Object.keys(validatedData),
    });

    return NextResponse.json({
      success: true,
      forum: {
        id: updatedForum.id,
        title: updatedForum.title,
        description: updatedForum.description,
        slug: updatedForum.slug,
        icon: updatedForum.icon,
        color: updatedForum.color,
        visibility: updatedForum.visibility,
        familyId: updatedForum.familyId,
        family: updatedForum.family ? {
          id: updatedForum.family.id,
          name: updatedForum.family.name,
        } : null,
        allowedRoles: updatedForum.allowedRoles,
        moderators: updatedForum.moderators,
        rules: updatedForum.rules,
        isActive: updatedForum.isActive,
        isArchived: updatedForum.isArchived,
        postCount: updatedForum.postCount,
        memberCount: updatedForum.memberCount,
        lastActivityAt: updatedForum.lastActivityAt,
        updatedAt: updatedForum.updatedAt,
        creator: updatedForum.creator ? {
          id: updatedForum.creator.id,
          name: updatedForum.creator.firstName
            ? `${updatedForum.creator.firstName} ${updatedForum.creator.lastName || ""}`.trim()
            : updatedForum.creator.email,
        } : null,
      },
    });
  } catch (error) {
    console.error("❌ Error updating forum:", error);

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

    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json(
        {
          error: "A forum with this title already exists. Please choose a different title.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update forum" },
      { status: 500 },
    );
  }
}

// DELETE /api/forums/[id] - Soft delete forum
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get forum to check permissions
    const forum = await forumRepository.getForumById(id);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Only creator or admin can delete forums
    if (forum.createdBy !== user.id && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only the forum creator or admin can delete this forum" },
        { status: 403 },
      );
    }

    console.log("🏛️ Deleting forum:", {
      forumId: id,
      title: forum.title,
      deletedBy: user.email,
    });

    // Soft delete forum
    await forumRepository.deleteForum(id);

    console.log("✅ Forum deleted successfully:", {
      forumId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Forum deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting forum:", error);
    return NextResponse.json(
      { error: "Failed to delete forum" },
      { status: 500 },
    );
  }
}

// Helper function to check forum access permissions
async function checkForumAccess(forum: any, user: any): Promise<boolean> {
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
    if (forum.createdBy === user.id) return true;
    // Check membership would require additional query
    return await forumRepository.isMember(forum.id, user.id);
  }

  return false;
}

// Helper function to check forum edit permissions
async function checkForumEditPermissions(forum: any, user: any): Promise<boolean> {
  // Forum creator can always edit
  if (forum.createdBy === user.id) {
    return true;
  }

  // Admin can edit any forum
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Moderators can edit forum settings
  if (forum.moderators && forum.moderators.includes(user.id)) {
    return true;
  }

  return false;
}