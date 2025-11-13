import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole, PostType } from "@prisma/client";
import { PostRepository } from "@/lib/db/repositories/post.repository";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const postRepository = new PostRepository();
const forumRepository = new ForumRepository();
const userRepository = new UserRepository();

// Validation schema for updating a post
const updatePostSchema = z.object({
  title: z
    .string()
    .min(1, "Post title is required")
    .max(300, "Post title must be less than 300 characters")
    .optional(),
  content: z
    .string()
    .min(1, "Post content is required")
    .max(50000, "Post content must be less than 50,000 characters")
    .optional(),
  categoryId: z.string().optional(),
  type: z.enum(["DISCUSSION", "QUESTION", "ANNOUNCEMENT", "RESOURCE", "POLL"]).optional(),
  attachments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

// GET /api/posts/[id] - Get post by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const { searchParams } = new URL(request.url);
    const includeReplies = searchParams.get("includeReplies") === "true";
    const includeVotes = searchParams.get("includeVotes") === "true";
    const includeDocuments = searchParams.get("includeDocuments") === "true";

    console.log("📝 GET /api/posts/[id] - User:", {
      role: user.role,
      email: user.email,
      postId: id,
    });

    // Get post with all related data
    const post = await postRepository.getPostById(id, {
      includeDeleted: false,
      includeReplies,
      includeVotes,
      includeDocuments,
      userId: user.id,
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check forum access permissions
    const forum = await forumRepository.getForumById(post.forumId);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // TODO: Add proper forum access control
    // For now, assume user has access if they can see the post

    console.log("✅ Post retrieved:", {
      postId: post.id,
      title: post.title,
      forumId: post.forumId,
      viewCount: post.viewCount,
    });

    // Format response
    const formattedPost = {
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
      userVote: includeVotes && post.votes && post.votes.length > 0 ? post.votes[0].voteType : null,
      replies: includeReplies && post.replies ? post.replies.map(reply => ({
        id: reply.id,
        content: reply.content,
        parentId: reply.parentId,
        depth: reply.depth,
        upvoteCount: reply.upvoteCount,
        downvoteCount: reply.downvoteCount,
        score: reply.score,
        isDeleted: reply.isDeleted,
        createdAt: reply.createdAt,
        editedAt: reply.editedAt,
        author: reply.author ? {
          id: reply.author.id,
          name: reply.author.firstName
            ? `${reply.author.firstName} ${reply.author.lastName || ""}`.trim()
            : reply.author.email,
        } : null,
        userVote: reply.votes && reply.votes.length > 0 ? reply.votes[0].voteType : null,
      })) : [],
      documents: includeDocuments && post.documents ? post.documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
        originalFileName: doc.originalFileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        type: doc.type,
        filePath: doc.filePath,
        duration: doc.duration,
        width: doc.width,
        height: doc.height,
        thumbnailPath: doc.thumbnailPath,
      })) : [],
    };

    return NextResponse.json({
      post: formattedPost,
    });
  } catch (error) {
    console.error("❌ Error fetching post:", error);
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 },
    );
  }
}

// PUT /api/posts/[id] - Update post
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Get post to check permissions
    const post = await postRepository.getPostById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check permissions
    const canEdit = await checkPostEditPermissions(post, user);
    if (!canEdit) {
      return NextResponse.json(
        { error: "Insufficient permissions to edit this post" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updatePostSchema.parse(body);

    // Check if moderation actions require higher permissions
    if ((validatedData.isPinned !== undefined || validatedData.isLocked !== undefined) &&
        !await checkPostModerationPermissions(post, user)) {
      return NextResponse.json(
        { error: "Insufficient permissions for moderation actions" },
        { status: 403 },
      );
    }

    console.log("📝 Updating post:", {
      postId: id,
      data: validatedData,
      updatedBy: user.email,
    });

    // Update post
    const updatedPost = await postRepository.updatePost(id, validatedData);

    console.log("✅ Post updated successfully:", {
      postId: updatedPost.id,
      title: updatedPost.title,
      changes: Object.keys(validatedData),
    });

    return NextResponse.json({
      success: true,
      post: {
        id: updatedPost.id,
        title: updatedPost.title,
        content: updatedPost.content,
        slug: updatedPost.slug,
        type: updatedPost.type,
        forumId: updatedPost.forumId,
        forum: updatedPost.forum ? {
          id: updatedPost.forum.id,
          title: updatedPost.forum.title,
          slug: updatedPost.forum.slug,
        } : null,
        categoryId: updatedPost.categoryId,
        category: updatedPost.category ? {
          id: updatedPost.category.id,
          name: updatedPost.category.name,
          slug: updatedPost.category.slug,
        } : null,
        isPinned: updatedPost.isPinned,
        isLocked: updatedPost.isLocked,
        attachments: updatedPost.attachments,
        tags: updatedPost.tags,
        viewCount: updatedPost.viewCount,
        replyCount: updatedPost.replyCount,
        score: updatedPost.score,
        lastReplyAt: updatedPost.lastReplyAt,
        updatedAt: updatedPost.updatedAt,
        editedAt: updatedPost.editedAt,
        author: updatedPost.author ? {
          id: updatedPost.author.id,
          name: updatedPost.author.firstName
            ? `${updatedPost.author.firstName} ${updatedPost.author.lastName || ""}`.trim()
            : updatedPost.author.email,
        } : null,
      },
    });
  } catch (error) {
    console.error("❌ Error updating post:", error);

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
      { error: "Failed to update post" },
      { status: 500 },
    );
  }
}

// DELETE /api/posts/[id] - Soft delete post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Get post to check permissions
    const post = await postRepository.getPostById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check permissions - only author, moderator, or admin can delete
    const canDelete = await checkPostDeletePermissions(post, user);
    if (!canDelete) {
      return NextResponse.json(
        { error: "Insufficient permissions to delete this post" },
        { status: 403 },
      );
    }

    // Get deletion reason from request body if provided
    const body = await request.json().catch(() => ({}));
    const deleteReason = body.reason || "Post deleted by user";

    console.log("📝 Deleting post:", {
      postId: id,
      title: post.title,
      deletedBy: user.email,
      reason: deleteReason,
    });

    // Soft delete post
    await postRepository.deletePost(id, user.id, deleteReason);

    console.log("✅ Post deleted successfully:", {
      postId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 },
    );
  }
}

// Helper function to check post edit permissions
async function checkPostEditPermissions(post: any, user: any): Promise<boolean> {
  // Post author can edit their own posts
  if (post.authorId === user.id) {
    return true;
  }

  // Admin can edit any post
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Get forum to check moderator status
  const forum = await forumRepository.getForumById(post.forumId);
  if (!forum) return false;

  // Forum moderators can edit posts
  if (forum.moderators && forum.moderators.includes(user.id)) {
    return true;
  }

  // Forum creator can edit posts
  if (forum.createdBy === user.id) {
    return true;
  }

  return false;
}

// Helper function to check post moderation permissions (pin/lock)
async function checkPostModerationPermissions(post: any, user: any): Promise<boolean> {
  // Admin can perform any moderation action
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Get forum to check moderator status
  const forum = await forumRepository.getForumById(post.forumId);
  if (!forum) return false;

  // Forum moderators can moderate posts
  if (forum.moderators && forum.moderators.includes(user.id)) {
    return true;
  }

  // Forum creator can moderate posts
  if (forum.createdBy === user.id) {
    return true;
  }

  return false;
}

// Helper function to check post deletion permissions
async function checkPostDeletePermissions(post: any, user: any): Promise<boolean> {
  // Post author can delete their own posts
  if (post.authorId === user.id) {
    return true;
  }

  // Admin can delete any post
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Get forum to check moderator status
  const forum = await forumRepository.getForumById(post.forumId);
  if (!forum) return false;

  // Forum moderators can delete posts
  if (forum.moderators && forum.moderators.includes(user.id)) {
    return true;
  }

  // Forum creator can delete posts
  if (forum.createdBy === user.id) {
    return true;
  }

  return false;
}