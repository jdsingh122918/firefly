import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";

const forumRepository = new ForumRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Validation schema for adding a member
const addMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["member", "moderator", "admin"]).default("member"),
  notifications: z.boolean().default(true),
});

// Validation schema for updating member role
const updateMemberSchema = z.object({
  role: z.enum(["member", "moderator", "admin"]),
});

// GET /api/forums/[id]/members - Get forum members
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

    // Get forum to check permissions
    const forum = await forumRepository.getForumById(id);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check if user can view members
    const canViewMembers = await checkMemberViewPermissions(forum, user);
    if (!canViewMembers) {
      return NextResponse.json(
        { error: "Access denied to view forum members" },
        { status: 403 }
      );
    }

    console.log("👥 GET /api/forums/[id]/members - User:", {
      role: user.role,
      email: user.email,
      forumId: id,
    });

    // Get forum members
    const members = await forumRepository.getForumMembers(id);

    console.log("✅ Forum members retrieved:", {
      forumId: id,
      memberCount: members.length,
    });

    // Format response
    const formattedMembers = members.map(member => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      lastViewedAt: member.lastViewedAt,
      postCount: member.postCount,
      replyCount: member.replyCount,
      notifications: member.notifications,
      user: {
        id: member.user.id,
        name: member.user.firstName
          ? `${member.user.firstName} ${member.user.lastName || ""}`.trim()
          : member.user.email,
        email: member.user.email,
        role: member.user.role,
      },
    }));

    return NextResponse.json({
      members: formattedMembers,
      total: formattedMembers.length,
      forum: {
        id: forum.id,
        title: forum.title,
        memberCount: forum.memberCount,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching forum members:", error);
    return NextResponse.json(
      { error: "Failed to fetch forum members" },
      { status: 500 },
    );
  }
}

// POST /api/forums/[id]/members - Add member to forum
export async function POST(
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

    // Check if user can add members
    const canAddMembers = await checkMemberManagePermissions(forum, user);
    if (!canAddMembers) {
      return NextResponse.json(
        { error: "Access denied to add members to this forum" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // Check if target user exists
    const targetUser = await userRepository.getUserById(validatedData.userId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const isMember = await forumRepository.isMember(id, validatedData.userId);
    if (isMember) {
      return NextResponse.json(
        { error: "User is already a member of this forum" },
        { status: 400 }
      );
    }

    console.log("👥 Adding forum member:", {
      forumId: id,
      userId: validatedData.userId,
      role: validatedData.role,
      addedBy: user.email,
    });

    // Add member to forum
    await forumRepository.addMember({
      forumId: id,
      userId: validatedData.userId,
      role: validatedData.role,
      notifications: validatedData.notifications,
    });

    console.log("✅ Forum member added successfully:", {
      forumId: id,
      userId: validatedData.userId,
    });

    // Send notification to the added user
    await createMembershipNotification(id, validatedData.userId, "added", user.id);

    return NextResponse.json({
      success: true,
      message: "Member added to forum successfully",
      member: {
        userId: validatedData.userId,
        role: validatedData.role,
        notifications: validatedData.notifications,
        joinedAt: new Date(),
        user: {
          id: targetUser.id,
          name: targetUser.firstName
            ? `${targetUser.firstName} ${targetUser.lastName || ""}`.trim()
            : targetUser.email,
          email: targetUser.email,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error("❌ Error adding forum member:", error);

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
      { error: "Failed to add forum member" },
      { status: 500 },
    );
  }
}

// PUT /api/forums/[id]/members/[userId] - Update member role
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

    // Check if user can manage members
    const canManageMembers = await checkMemberManagePermissions(forum, user);
    if (!canManageMembers) {
      return NextResponse.json(
        { error: "Access denied to manage forum members" },
        { status: 403 }
      );
    }

    // Parse target user ID from request body (since we don't have [userId] in params)
    const body = await request.json();
    const targetUserId = body.userId;
    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 }
      );
    }

    const validatedData = updateMemberSchema.parse(body);

    // Check if target user is a member
    const isMember = await forumRepository.isMember(id, targetUserId);
    if (!isMember) {
      return NextResponse.json(
        { error: "User is not a member of this forum" },
        { status: 400 }
      );
    }

    console.log("👥 Updating forum member role:", {
      forumId: id,
      targetUserId,
      newRole: validatedData.role,
      updatedBy: user.email,
    });

    // Update member role
    await forumRepository.updateMemberRole(id, targetUserId, validatedData.role);

    console.log("✅ Forum member role updated successfully:", {
      forumId: id,
      targetUserId,
      newRole: validatedData.role,
    });

    return NextResponse.json({
      success: true,
      message: "Member role updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating forum member role:", error);

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
      { error: "Failed to update member role" },
      { status: 500 },
    );
  }
}

// DELETE /api/forums/[id]/members/[userId] - Remove member from forum
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

    // Get target user ID from query params
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 }
      );
    }

    // Check permissions: user can remove themselves, or managers can remove others
    const canRemove = (targetUserId === user.id) ||
      await checkMemberManagePermissions(forum, user);

    if (!canRemove) {
      return NextResponse.json(
        { error: "Access denied to remove this forum member" },
        { status: 403 }
      );
    }

    // Check if target user is a member
    const isMember = await forumRepository.isMember(id, targetUserId);
    if (!isMember) {
      return NextResponse.json(
        { error: "User is not a member of this forum" },
        { status: 400 }
      );
    }

    console.log("👥 Removing forum member:", {
      forumId: id,
      targetUserId,
      removedBy: user.email,
    });

    // Remove member from forum
    await forumRepository.removeMember(id, targetUserId);

    console.log("✅ Forum member removed successfully:", {
      forumId: id,
      targetUserId,
    });

    // Send notification if removing someone else
    if (targetUserId !== user.id) {
      await createMembershipNotification(id, targetUserId, "removed", user.id);
    }

    return NextResponse.json({
      success: true,
      message: "Member removed from forum successfully",
    });
  } catch (error) {
    console.error("❌ Error removing forum member:", error);
    return NextResponse.json(
      { error: "Failed to remove forum member" },
      { status: 500 },
    );
  }
}

// Helper function to check member view permissions
async function checkMemberViewPermissions(forum: any, user: any): Promise<boolean> {
  // Public forums - anyone can view members
  if (forum.visibility === "PUBLIC") {
    return true;
  }

  // For other forums, user must be a member or have management permissions
  const isMember = await forumRepository.isMember(forum.id, user.id);
  const canManage = await checkMemberManagePermissions(forum, user);

  return isMember || canManage;
}

// Helper function to check member management permissions
async function checkMemberManagePermissions(forum: any, user: any): Promise<boolean> {
  // Forum creator can always manage members
  if (forum.createdBy === user.id) {
    return true;
  }

  // Admin can manage any forum
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Moderators can manage members
  if (forum.moderators && forum.moderators.includes(user.id)) {
    return true;
  }

  return false;
}

// Helper function to create membership notifications
async function createMembershipNotification(
  forumId: string,
  targetUserId: string,
  action: "added" | "removed",
  actionBy: string
): Promise<void> {
  try {
    const forum = await forumRepository.getForumById(forumId);
    const actionUser = await userRepository.getUserById(actionBy);

    if (!forum || !actionUser) return;

    const notification = {
      userId: targetUserId,
      type: NotificationType.FAMILY_ACTIVITY,
      title: `Forum Membership ${action === "added" ? "Added" : "Removed"}`,
      message: action === "added"
        ? `You were added to the forum "${forum.title}" by ${actionUser.firstName} ${actionUser.lastName || ""}`
        : `You were removed from the forum "${forum.title}" by ${actionUser.firstName} ${actionUser.lastName || ""}`,
      data: {
        forumId,
        forumTitle: forum.title,
        forumSlug: forum.slug,
        action,
        actionBy,
        actionByName: `${actionUser.firstName} ${actionUser.lastName || ""}`,
        activityType: `forum_member_${action}`
      },
      actionUrl: action === "added" ? `/forums/${forum.slug}` : undefined,
      isActionable: action === "added",
    };

    await notificationRepository.createNotification(notification);

    console.log("✅ Membership notification sent:", {
      forumId,
      targetUserId,
      action,
    });
  } catch (error) {
    console.error("❌ Failed to create membership notification:", error);
  }
}