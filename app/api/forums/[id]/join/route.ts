import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";

const forumRepository = new ForumRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// POST /api/forums/[id]/join - Join a forum
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Get forum to check if it exists and permissions
    const forum = await forumRepository.getForumById(id);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check if forum allows joining
    if (forum.visibility === "PRIVATE") {
      return NextResponse.json(
        { error: "This forum is private and requires an invitation" },
        { status: 403 }
      );
    }

    // For FAMILY forums, check if user is in the same family
    if (forum.visibility === "FAMILY" && forum.familyId !== user.familyId) {
      return NextResponse.json(
        { error: "This forum is only available to family members" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const isMember = await forumRepository.isMember(id, user.id);
    if (isMember) {
      return NextResponse.json(
        { error: "You are already a member of this forum" },
        { status: 400 }
      );
    }

    console.log("👥 User joining forum:", {
      forumId: id,
      forumTitle: forum.title,
      userId: user.id,
      userEmail: user.email,
    });

    // Add user as member
    await forumRepository.addMember({
      forumId: id,
      userId: user.id,
      role: "member",
      notifications: true,
    });

    console.log("✅ User successfully joined forum:", {
      forumId: id,
      userId: user.id,
    });

    // Create notification for forum creator about new member
    try {
      await notificationRepository.createNotification({
        userId: forum.createdBy,
        type: NotificationType.FAMILY_ACTIVITY,
        title: "New Forum Member",
        message: `${user.firstName} ${user.lastName || ""} joined your forum "${forum.title}"`,
        data: {
          forumId: id,
          forumTitle: forum.title,
          forumSlug: forum.slug,
          newMemberId: user.id,
          newMemberName: `${user.firstName} ${user.lastName || ""}`,
          activityType: "forum_member_joined"
        },
        actionUrl: `/forums/${forum.slug}`,
        isActionable: true,
      });
    } catch (notifError) {
      console.warn("⚠️ Failed to send forum join notification:", notifError);
      // Don't fail the whole request for notification errors
    }

    return NextResponse.json({
      success: true,
      message: "Successfully joined forum",
      forum: {
        id: forum.id,
        title: forum.title,
        slug: forum.slug,
        memberCount: forum.memberCount + 1, // Updated count
      },
    }, { status: 200 });
  } catch (error) {
    console.error("❌ Error joining forum:", error);
    return NextResponse.json(
      { error: "Failed to join forum" },
      { status: 500 },
    );
  }
}

// DELETE /api/forums/[id]/join - Leave a forum
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Get forum to check if it exists
    const forum = await forumRepository.getForumById(id);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check if user is a member
    const isMember = await forumRepository.isMember(id, user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this forum" },
        { status: 400 }
      );
    }

    // Prevent forum creator from leaving their own forum
    if (forum.createdBy === user.id) {
      return NextResponse.json(
        { error: "Forum creators cannot leave their own forum" },
        { status: 403 }
      );
    }

    console.log("👥 User leaving forum:", {
      forumId: id,
      forumTitle: forum.title,
      userId: user.id,
      userEmail: user.email,
    });

    // Remove user from forum
    await forumRepository.removeMember(id, user.id);

    console.log("✅ User successfully left forum:", {
      forumId: id,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Successfully left forum",
      forum: {
        id: forum.id,
        title: forum.title,
        slug: forum.slug,
        memberCount: Math.max(0, forum.memberCount - 1), // Updated count
      },
    }, { status: 200 });
  } catch (error) {
    console.error("❌ Error leaving forum:", error);
    return NextResponse.json(
      { error: "Failed to leave forum" },
      { status: 500 },
    );
  }
}