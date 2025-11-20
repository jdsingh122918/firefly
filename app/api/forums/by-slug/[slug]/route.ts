import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ForumVisibility } from "@prisma/client";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const forumRepository = new ForumRepository();
const userRepository = new UserRepository();

// GET /api/forums/by-slug/[slug] - Get forum by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const includePosts = searchParams.get("includePosts") === "true";
    const includeMembers = searchParams.get("includeMembers") === "true";

    console.log("🏛️ GET /api/forums/by-slug/[slug] - User:", {
      role: user.role,
      email: user.email,
      slug: slug,
    });

    // Get forum by slug
    const forum = await forumRepository.getForumBySlug(slug);

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

    console.log("✅ Forum retrieved by slug:", {
      forumId: forum.id,
      slug: forum.slug,
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
      userMembership: isMember ? {
        role: "member", // Would need to fetch actual role
        joinedAt: new Date(), // Would need to fetch actual join date
        notifications: true, // Would need to fetch actual preference
      } : null,
      // Add membership status for UI
      isMember,
      isCreator: forum.createdBy === user.id,
    };

    return NextResponse.json({
      forum: formattedForum,
    });
  } catch (error) {
    console.error("❌ Error fetching forum by slug:", error);
    return NextResponse.json(
      { error: "Failed to fetch forum" },
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