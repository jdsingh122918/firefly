import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole, PostType } from "@prisma/client";
import { PostRepository } from "@/lib/db/repositories/post.repository";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationDispatcher } from "@/lib/notifications/notification-dispatcher.service";
import { NotificationType } from "@/lib/types";

const postRepository = new PostRepository();
const forumRepository = new ForumRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();
const notificationDispatcher = new NotificationDispatcher();

// Validation schema for creating a post
const createPostSchema = z.object({
  title: z
    .string()
    .min(1, "Post title is required")
    .max(300, "Post title must be less than 300 characters"),
  content: z
    .string()
    .min(1, "Post content is required")
    .max(50000, "Post content must be less than 50,000 characters"),
  forumId: z.string().min(1, "Forum ID is required"),
  categoryId: z.string().optional(),
  type: z.enum(["DISCUSSION", "QUESTION", "ANNOUNCEMENT", "RESOURCE", "POLL"]).default("DISCUSSION"),
  attachments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// GET /api/posts - List posts with filtering
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

    console.log("📝 GET /api/posts - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const forumId = searchParams.get("forumId");
    const categoryId = searchParams.get("categoryId");
    const authorId = searchParams.get("authorId");
    const type = searchParams.get("type") as PostType | null;
    const search = searchParams.get("search");
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const isPinned = searchParams.get("isPinned") === "true" ? true :
                    searchParams.get("isPinned") === "false" ? false : undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") as "createdAt" | "lastReplyAt" | "score" | "viewCount" | "replyCount" || "lastReplyAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "desc";
    const includeReplies = searchParams.get("includeReplies") === "true";

    // Build filters object
    const filters = {
      ...(forumId && { forumId }),
      ...(categoryId && { categoryId }),
      ...(authorId && { authorId }),
      ...(type && { type }),
      ...(search && { search }),
      ...(tags && { tags }),
      ...(isPinned !== undefined && { isPinned }),
      isDeleted: false,
    };

    console.log("🔍 Post filters applied:", filters);

    // Get posts with pagination
    const result = await postRepository.getPosts(filters, {
      page,
      limit,
      sortBy,
      sortOrder,
      includeReplies,
      userId: user.id,
    });

    // TODO: Add access control for forum visibility (similar to forum API)
    // For now, show all posts from accessible forums

    console.log("✅ Posts retrieved:", {
      total: result.total,
      page: result.page,
      filters
    });

    // Format response
    const formattedPosts = result.items.map(post => ({
      id: post.id,
      title: post.title,
      content: post.content,
      slug: post.slug,
      type: post.type,
      forumId: post.forumId,
      forum: post.forum ? {
        id: post.forum.id,
        title: post.forum.title,
        slug: post.forum.slug,
        visibility: post.forum.visibility,
      } : null,
      categoryId: post.categoryId,
      category: post.category ? {
        id: post.category.id,
        name: post.category.name,
        slug: post.category.slug,
      } : null,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      isDeleted: post.isDeleted,
      attachments: post.attachments,
      tags: post.tags,
      metadata: post.metadata,
      viewCount: post.viewCount,
      replyCount: post.replyCount,
      upvoteCount: post.upvoteCount,
      downvoteCount: post.downvoteCount,
      score: post.score,
      lastReplyAt: post.lastReplyAt,
      lastReplyBy: post.lastReplyBy,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      editedAt: post.editedAt,
      author: post.author ? {
        id: post.author.id,
        name: post.author.firstName
          ? `${post.author.firstName} ${post.author.lastName || ""}`.trim()
          : post.author.email,
        email: post.author.email,
      } : null,
      userVote: post.votes && post.votes.length > 0 ? post.votes[0].voteType : null,
      replies: includeReplies && post.replies ? post.replies.slice(0, 3).map(reply => ({
        id: reply.id,
        content: reply.content.substring(0, 200), // Truncate for list view
        score: reply.score,
        createdAt: reply.createdAt,
        author: reply.author ? {
          id: reply.author.id,
          name: reply.author.firstName
            ? `${reply.author.firstName} ${reply.author.lastName || ""}`.trim()
            : reply.author.email,
        } : null,
      })) : [],
    }));

    return NextResponse.json({
      posts: formattedPosts,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      filters: {
        forumId: forumId || null,
        categoryId: categoryId || null,
        authorId: authorId || null,
        type: type || null,
        search: search || null,
        tags: tags || null,
        isPinned: isPinned,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 },
    );
  }
}

// POST /api/posts - Create a new post
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createPostSchema.parse(body);

    console.log("📝 Creating post:", {
      data: validatedData,
      createdBy: user.email,
    });

    // Check if forum exists and user has access
    const forum = await forumRepository.getForumById(validatedData.forumId);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check if user is a member of the forum
    let isMember = await forumRepository.isMember(validatedData.forumId, user.id);

    // Auto-enroll user in PUBLIC forums if not already a member
    if (!isMember && forum.visibility === "PUBLIC") {
      try {
        await forumRepository.addMember({
          forumId: validatedData.forumId,
          userId: user.id,
          role: "member",
          notifications: true, // Enable notifications by default
        });
        isMember = true;
        console.log("✅ Auto-enrolled user in PUBLIC forum during post creation:", {
          forumId: validatedData.forumId,
          userId: user.id,
          forumTitle: forum.title,
        });
      } catch (error) {
        // If enrollment fails (e.g., user already a member due to race condition),
        // continue - they might already be a member now
        console.error("⚠️ Failed to auto-enroll user in forum during post creation:", error);
        // Re-check membership after potential race condition
        isMember = await forumRepository.isMember(validatedData.forumId, user.id);
      }
    }

    // Final membership check
    if (!isMember) {
      return NextResponse.json(
        { error: "You must be a member of this forum to create posts" },
        { status: 403 }
      );
    }

    // Check if forum is locked/archived
    if (!forum.isActive || forum.isArchived) {
      return NextResponse.json(
        { error: "Cannot create posts in inactive or archived forums" },
        { status: 403 }
      );
    }

    // Check permissions for announcement posts
    if (validatedData.type === PostType.ANNOUNCEMENT) {
      const canCreateAnnouncements = user.role === UserRole.ADMIN ||
        forum.moderators.includes(user.id) ||
        forum.createdBy === user.id;

      if (!canCreateAnnouncements) {
        return NextResponse.json(
          { error: "Only moderators and admins can create announcement posts" },
          { status: 403 }
        );
      }
    }

    // Create post
    const post = await postRepository.createPost({
      title: validatedData.title,
      content: validatedData.content,
      forumId: validatedData.forumId,
      categoryId: validatedData.categoryId,
      authorId: user.id,
      type: validatedData.type,
      attachments: validatedData.attachments || [],
      tags: validatedData.tags || [],
      metadata: validatedData.metadata || {},
    });

    console.log("✅ Post created successfully:", {
      postId: post.id,
      title: post.title,
      slug: post.slug,
      forumId: post.forumId,
    });

    // Create post notification for forum members (async)
    createPostNotifications(post.id, validatedData.forumId, user.id);

    return NextResponse.json(
      {
        success: true,
        post: {
          id: post.id,
          title: post.title,
          content: post.content,
          slug: post.slug,
          type: post.type,
          forumId: post.forumId,
          forum: post.forum ? {
            id: post.forum.id,
            title: post.forum.title,
            slug: post.forum.slug,
          } : null,
          categoryId: post.categoryId,
          category: post.category ? {
            id: post.category.id,
            name: post.category.name,
            slug: post.category.slug,
          } : null,
          isPinned: post.isPinned,
          isLocked: post.isLocked,
          attachments: post.attachments,
          tags: post.tags,
          viewCount: post.viewCount,
          replyCount: post.replyCount,
          upvoteCount: post.upvoteCount,
          downvoteCount: post.downvoteCount,
          score: post.score,
          lastReplyAt: post.lastReplyAt,
          createdAt: post.createdAt,
          author: post.author ? {
            id: post.author.id,
            name: post.author.firstName
              ? `${post.author.firstName} ${post.author.lastName || ""}`.trim()
              : post.author.email,
            email: post.author.email,
          } : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating post:", error);

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

    // Handle specific repository errors
    if (error instanceof Error && error.message.includes("not a member")) {
      return NextResponse.json(
        { error: "You must be a member of this forum to create posts" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications for new posts
async function createPostNotifications(
  postId: string,
  forumId: string,
  authorId: string
): Promise<void> {
  try {
    // Get post and forum details
    const post = await postRepository.getPostById(postId);
    const forum = await forumRepository.getForumById(forumId, { includeMembers: true });
    const author = await userRepository.getUserById(authorId);

    if (!post || !forum || !author) return;

    // Get forum members (exclude post author)
    const membersToNotify = forum.members?.filter(member =>
      member.userId !== authorId && member.notifications
    ) || [];

    if (membersToNotify.length === 0) return;

    // Get user details for each member to determine their role
    const memberUsers = await Promise.all(
      membersToNotify.map(member => userRepository.getUserById(member.userId))
    );

    // Create notifications for forum members
    const notifications = membersToNotify.map((member, index) => {
      const memberUser = memberUsers[index];
      const memberRole = memberUser?.role?.toLowerCase() || 'member';

      return {
        userId: member.userId,
        type: NotificationType.FAMILY_ACTIVITY,
        title: `New Post in ${forum.title}`,
        message: `${author.firstName || author.email || "A user"} ${author.lastName || ""} posted: "${post.title}"`,
        data: {
          postId,
          postTitle: post.title,
          postSlug: post.slug,
          forumId,
          forumTitle: forum.title,
          forumSlug: forum.slug,
          authorId,
          authorName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
          activityType: "post_created"
        },
        actionUrl: `/${memberRole}/forums/${forum.slug}/posts/${post.slug}`,
        isActionable: true
      };
    });

    // Create and dispatch notifications with real-time SSE broadcasting
    // Process notifications individually to ensure proper SSE delivery
    for (const notification of notifications) {
      try {
        await notificationDispatcher.dispatchNotification(
          notification.userId,
          notification.type,
          {
            title: notification.title,
            message: notification.message,
            data: notification.data,
            isActionable: notification.isActionable,
            actionUrl: notification.actionUrl,
          },
          {
            recipientName: "Forum Member", // Could be enhanced with actual names
            senderName: `${author.firstName} ${author.lastName || ""}`,
            familyName: forum.title,
            authorName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
          }
        );
      } catch (error) {
        console.error("❌ Failed to dispatch notification:", error);
        // Continue with other notifications if one fails
      }
    }

    console.log("✅ Post notifications sent:", {
      postId,
      forumId,
      notificationCount: notifications.length
    });
  } catch (error) {
    console.error("❌ Failed to create post notifications:", error);
    // Don't throw error as this is not critical for post creation
  }
}