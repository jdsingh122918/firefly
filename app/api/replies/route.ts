import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { ReplyRepository } from "@/lib/db/repositories/reply.repository";
import { PostRepository } from "@/lib/db/repositories/post.repository";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationDispatcher } from "@/lib/notifications/notification-dispatcher.service";
import { NotificationType } from "@/lib/types";

const replyRepository = new ReplyRepository();
const postRepository = new PostRepository();
const forumRepository = new ForumRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();
const notificationDispatcher = new NotificationDispatcher();

// Validation schema for creating a reply
const createReplySchema = z.object({
  content: z
    .string()
    .min(1, "Reply content is required")
    .max(10000, "Reply content must be less than 10,000 characters"),
  postId: z.string().min(1, "Post ID is required"),
  parentId: z.string().optional(), // For threaded replies
  attachments: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// GET /api/replies - List replies with filtering
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

    console.log("💬 GET /api/replies - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const authorId = searchParams.get("authorId");
    const parentId = searchParams.get("parentId");
    const depth = searchParams.get("depth") ? parseInt(searchParams.get("depth")!) : undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") as "createdAt" | "score" | "depth" || "createdAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "asc";
    const includeChildren = searchParams.get("includeChildren") === "true";
    const threaded = searchParams.get("threaded") !== "false"; // Default to threaded

    // Build filters object
    const filters = {
      ...(postId && { postId }),
      ...(authorId && { authorId }),
      ...(parentId && { parentId }),
      ...(depth !== undefined && { depth }),
      isDeleted: false,
    };

    console.log("🔍 Reply filters applied:", filters);

    // Get replies with pagination
    const result = await replyRepository.getReplies(filters, {
      page,
      limit,
      sortBy,
      sortOrder,
      includeChildren,
      userId: user.id,
      threaded,
    });

    console.log("✅ Replies retrieved:", {
      total: result.total,
      page: result.page,
      threaded,
      filters
    });

    // Format response
    const formattedReplies = result.items.map(reply => ({
      id: reply.id,
      content: reply.content,
      postId: reply.postId,
      post: reply.post ? {
        id: reply.post.id,
        title: reply.post.title,
        forumId: reply.post.forumId,
      } : null,
      parentId: reply.parentId,
      parent: reply.parent ? {
        id: reply.parent.id,
        authorId: reply.parent.authorId,
        depth: reply.parent.depth,
      } : null,
      depth: reply.depth,
      attachments: reply.attachments,
      metadata: reply.metadata,
      isDeleted: reply.isDeleted,
      upvoteCount: reply.upvoteCount,
      downvoteCount: reply.downvoteCount,
      score: reply.score,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      editedAt: reply.editedAt,
      author: reply.author ? {
        id: reply.author.id,
        name: reply.author.firstName
          ? `${reply.author.firstName} ${reply.author.lastName || ""}`.trim()
          : reply.author.email,
        email: reply.author.email,
      } : null,
      userVote: reply.votes && reply.votes.length > 0 ? reply.votes[0].voteType : null,
      children: includeChildren && reply.children ? reply.children.map(child => ({
        id: child.id,
        content: child.content.substring(0, 200), // Truncate for list view
        depth: child.depth,
        score: child.score,
        createdAt: child.createdAt,
        author: child.author ? {
          id: child.author.id,
          name: child.author.firstName
            ? `${child.author.firstName} ${child.author.lastName || ""}`.trim()
            : child.author.email,
        } : null,
        userVote: child.votes && child.votes.length > 0 ? child.votes[0].voteType : null,
      })) : [],
    }));

    return NextResponse.json({
      replies: formattedReplies,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      threaded,
      filters: {
        postId: postId || null,
        authorId: authorId || null,
        parentId: parentId || null,
        depth,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching replies:", error);
    return NextResponse.json(
      { error: "Failed to fetch replies" },
      { status: 500 },
    );
  }
}

// POST /api/replies - Create a new reply
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
    const validatedData = createReplySchema.parse(body);

    console.log("💬 Creating reply:", {
      data: validatedData,
      createdBy: user.email,
    });

    // Check if post exists and user has access
    const post = await postRepository.getPostById(validatedData.postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if post is locked
    if (post.isLocked) {
      return NextResponse.json(
        { error: "Cannot reply to a locked post" },
        { status: 403 }
      );
    }

    // Check if post is deleted
    if (post.isDeleted) {
      return NextResponse.json(
        { error: "Cannot reply to a deleted post" },
        { status: 403 }
      );
    }

    // Check forum access and membership
    const forum = await forumRepository.getForumById(post.forumId);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check if user is a member of the forum
    const isMember = await forumRepository.isMember(post.forumId, user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You must be a member of this forum to reply" },
        { status: 403 }
      );
    }

    // Check if forum is active
    if (!forum.isActive || forum.isArchived) {
      return NextResponse.json(
        { error: "Cannot reply in inactive or archived forums" },
        { status: 403 }
      );
    }

    // If replying to another reply, validate parent exists and depth limits
    if (validatedData.parentId) {
      const parentReply = await replyRepository.getReplyById(validatedData.parentId);
      if (!parentReply) {
        return NextResponse.json({ error: "Parent reply not found" }, { status: 404 });
      }

      if (parentReply.postId !== validatedData.postId) {
        return NextResponse.json(
          { error: "Parent reply is not from the same post" },
          { status: 400 }
        );
      }

      // Check maximum depth (handled by repository, but good to inform user)
      if (parentReply.depth >= 2) { // Assuming max depth of 3 (0, 1, 2)
        return NextResponse.json(
          { error: "Maximum reply depth reached. Please start a new thread." },
          { status: 400 }
        );
      }
    }

    // Create reply
    const reply = await replyRepository.createReply({
      content: validatedData.content,
      postId: validatedData.postId,
      parentId: validatedData.parentId,
      authorId: user.id,
      attachments: validatedData.attachments || [],
      metadata: validatedData.metadata || {},
    });

    console.log("✅ Reply created successfully:", {
      replyId: reply.id,
      postId: reply.postId,
      parentId: reply.parentId,
      depth: reply.depth,
    });

    // Create reply notifications (async)
    createReplyNotifications(reply.id, validatedData.postId, validatedData.parentId, user.id);

    return NextResponse.json(
      {
        success: true,
        reply: {
          id: reply.id,
          content: reply.content,
          postId: reply.postId,
          post: reply.post ? {
            id: reply.post.id,
            title: reply.post.title,
            forumId: reply.post.forumId,
          } : null,
          parentId: reply.parentId,
          parent: reply.parent ? {
            id: reply.parent.id,
            authorId: reply.parent.authorId,
            depth: reply.parent.depth,
          } : null,
          depth: reply.depth,
          attachments: reply.attachments,
          upvoteCount: reply.upvoteCount,
          downvoteCount: reply.downvoteCount,
          score: reply.score,
          createdAt: reply.createdAt,
          author: reply.author ? {
            id: reply.author.id,
            name: reply.author.firstName
              ? `${reply.author.firstName} ${reply.author.lastName || ""}`.trim()
              : reply.author.email,
            email: reply.author.email,
          } : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating reply:", error);

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
    if (error instanceof Error) {
      if (error.message.includes("not a member")) {
        return NextResponse.json(
          { error: "You must be a member of this forum to reply" },
          { status: 403 },
        );
      }
      if (error.message.includes("maximum depth")) {
        return NextResponse.json(
          { error: "Maximum reply depth reached" },
          { status: 400 },
        );
      }
      if (error.message.includes("locked")) {
        return NextResponse.json(
          { error: "Cannot reply to a locked post" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create reply" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications for new replies
async function createReplyNotifications(
  replyId: string,
  postId: string,
  parentId: string | undefined,
  authorId: string
): Promise<void> {
  try {
    // Get reply, post, and author details
    const reply = await replyRepository.getReplyById(replyId);
    const post = await postRepository.getPostById(postId);
    const author = await userRepository.getUserById(authorId);

    if (!reply || !post || !author) return;

    const notifications: any[] = [];

    // Notify post author (if different from reply author)
    if (post.authorId !== authorId) {
      notifications.push({
        userId: post.authorId,
        type: NotificationType.FAMILY_ACTIVITY,
        title: "New reply to your post",
        message: `${author.firstName || author.email || "A user"} ${author.lastName || ""} replied to your post: "${post.title}"`,
        data: {
          replyId,
          postId,
          postTitle: post.title,
          postSlug: post.slug,
          authorId,
          authorName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
          activityType: "post_replied"
        },
        actionUrl: post.forum ? `/forums/${post.forum.slug}/posts/${post.slug}#reply-${replyId}` : `/posts/${post.slug}#reply-${replyId}`,
        isActionable: true
      });
    }

    // Notify parent reply author (if replying to a reply and different from reply author)
    if (parentId) {
      const parentReply = await replyRepository.getReplyById(parentId);
      if (parentReply && parentReply.authorId !== authorId && parentReply.authorId !== post.authorId) {
        notifications.push({
          userId: parentReply.authorId,
          type: NotificationType.FAMILY_ACTIVITY,
          title: "Someone replied to your comment",
          message: `${author.firstName || author.email || "A user"} ${author.lastName || ""} replied to your comment on: "${post.title}"`,
          data: {
            replyId,
            parentReplyId: parentId,
            postId,
            postTitle: post.title,
            postSlug: post.slug,
            authorId,
            authorName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
            activityType: "reply_replied"
          },
          actionUrl: post.forum ? `/forums/${post.forum.slug}/posts/${post.slug}#reply-${replyId}` : `/posts/${post.slug}#reply-${replyId}`,
          isActionable: true
        });
      }
    }

    // Notify other participants in the conversation (other reply authors)
    const existingReplies = await replyRepository.getReplies(
      { postId, isDeleted: false },
      { page: 1, limit: 100, sortBy: "createdAt", sortOrder: "asc" }
    );

    const participantIds = new Set<string>();
    existingReplies.items.forEach(existingReply => {
      if (existingReply.authorId !== authorId &&
          existingReply.authorId !== post.authorId &&
          (parentId ? existingReply.authorId !== parentId : true)) {
        participantIds.add(existingReply.authorId);
      }
    });

    // Add notifications for conversation participants
    for (const participantId of participantIds) {
      notifications.push({
        userId: participantId,
        type: NotificationType.FAMILY_ACTIVITY,
        title: "New activity in a conversation you're part of",
        message: `${author.firstName || author.email || "A user"} ${author.lastName || ""} added a reply to: "${post.title}"`,
        data: {
          replyId,
          postId,
          postTitle: post.title,
          postSlug: post.slug,
          authorId,
          authorName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
          activityType: "conversation_activity"
        },
        actionUrl: post.forum ? `/forums/${post.forum.slug}/posts/${post.slug}#reply-${replyId}` : `/posts/${post.slug}#reply-${replyId}`,
        isActionable: true
      });
    }

    // Notify forum moderators (if they have notifications enabled)
    const forumMembers = await forumRepository.getForumMembers(post.forumId);

    const moderators = forumMembers.filter(member =>
      (member.role === 'moderator' || member.role === 'admin') &&
      member.notifications === true &&
      member.userId !== authorId &&
      member.userId !== post.authorId &&
      !participantIds.has(member.userId) &&
      (parentId ? member.userId !== parentId : true)
    );

    for (const moderator of moderators) {
      notifications.push({
        userId: moderator.userId,
        type: NotificationType.FAMILY_ACTIVITY,
        title: "New reply in your moderated forum",
        message: `${author.firstName || author.email || "A user"} ${author.lastName || ""} replied in ${post.forum?.title || "Forum"}: "${post.title}"`,
        data: {
          replyId,
          postId,
          postTitle: post.title,
          postSlug: post.slug,
          forumId: post.forumId,
          forumTitle: post.forum?.title || "Forum",
          authorId,
          authorName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
          activityType: "moderation_activity"
        },
        actionUrl: post.forum ? `/forums/${post.forum.slug}/posts/${post.slug}#reply-${replyId}` : `/posts/${post.slug}#reply-${replyId}`,
        isActionable: true
      });
    }

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
            senderName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
            familyName: post.forum?.title || "Forum",
            authorName: `${author.firstName || author.email || "A user"} ${author.lastName || ""}`,
          }
        );
      } catch (error) {
        console.error("❌ Failed to dispatch notification:", error);
        // Continue with other notifications if one fails
      }
    }

    console.log("✅ Reply notifications sent:", {
      replyId,
      postId,
      notificationCount: notifications.length
    });
  } catch (error) {
    console.error("❌ Failed to create reply notifications:", error);
    // Don't throw error as this is not critical for reply creation
  }
}