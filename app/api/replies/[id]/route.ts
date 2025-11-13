import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { ReplyRepository } from "@/lib/db/repositories/reply.repository";
import { PostRepository } from "@/lib/db/repositories/post.repository";
import { ForumRepository } from "@/lib/db/repositories/forum.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const replyRepository = new ReplyRepository();
const postRepository = new PostRepository();
const forumRepository = new ForumRepository();
const userRepository = new UserRepository();

// Validation schema for updating a reply
const updateReplySchema = z.object({
  content: z
    .string()
    .min(1, "Reply content is required")
    .max(10000, "Reply content must be less than 10,000 characters")
    .optional(),
  attachments: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// GET /api/replies/[id] - Get reply by ID with threading context
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
    const includeChildren = searchParams.get("includeChildren") === "true";
    const includeVotes = searchParams.get("includeVotes") === "true";
    const includeDocuments = searchParams.get("includeDocuments") === "true";
    const includeThread = searchParams.get("includeThread") === "true"; // Get full thread context

    console.log("💬 GET /api/replies/[id] - User:", {
      role: user.role,
      email: user.email,
      replyId: id,
    });

    // Get reply with related data
    let reply;
    if (includeThread) {
      // Get the full thread context using the special method
      reply = await replyRepository.getReplyThread(id, user.id);
    } else {
      reply = await replyRepository.getReplyById(id, {
        includeDeleted: false,
        includeChildren,
        includeVotes,
        includeDocuments,
        userId: user.id,
      });
    }

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // Check access permissions via post and forum
    const post = await postRepository.getPostById(reply.postId);
    if (!post) {
      return NextResponse.json({ error: "Associated post not found" }, { status: 404 });
    }

    const forum = await forumRepository.getForumById(post.forumId);
    if (!forum) {
      return NextResponse.json({ error: "Associated forum not found" }, { status: 404 });
    }

    // TODO: Add proper forum access control
    // For now, assume user has access if they can see the reply

    console.log("✅ Reply retrieved:", {
      replyId: reply.id,
      postId: reply.postId,
      depth: reply.depth,
      hasChildren: reply.children && reply.children.length > 0,
    });

    // Format response
    const formattedReply = {
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
        content: reply.parent.content.substring(0, 200), // Truncate for context
        authorId: reply.parent.authorId,
        depth: reply.parent.depth,
        author: reply.parent.author ? {
          id: reply.parent.author.id,
          name: reply.parent.author.firstName
            ? `${reply.parent.author.firstName} ${reply.parent.author.lastName || ""}`.trim()
            : reply.parent.author.email,
        } : null,
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
      userVote: includeVotes && reply.votes && reply.votes.length > 0 ? reply.votes[0].voteType : null,
      children: formatChildReplies(reply.children || [], includeVotes),
      documents: includeDocuments && reply.documents ? reply.documents.map(doc => ({
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
      reply: formattedReply,
      threadContext: includeThread,
    });
  } catch (error) {
    console.error("❌ Error fetching reply:", error);
    return NextResponse.json(
      { error: "Failed to fetch reply" },
      { status: 500 },
    );
  }
}

// PUT /api/replies/[id] - Update reply
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

    // Get reply to check permissions
    const reply = await replyRepository.getReplyById(id);
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // Check permissions
    const canEdit = await checkReplyEditPermissions(reply, user);
    if (!canEdit) {
      return NextResponse.json(
        { error: "Insufficient permissions to edit this reply" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateReplySchema.parse(body);

    console.log("💬 Updating reply:", {
      replyId: id,
      data: validatedData,
      updatedBy: user.email,
    });

    // Update reply
    const updatedReply = await replyRepository.updateReply(id, validatedData);

    console.log("✅ Reply updated successfully:", {
      replyId: updatedReply.id,
      changes: Object.keys(validatedData),
    });

    return NextResponse.json({
      success: true,
      reply: {
        id: updatedReply.id,
        content: updatedReply.content,
        postId: updatedReply.postId,
        post: updatedReply.post ? {
          id: updatedReply.post.id,
          title: updatedReply.post.title,
          forumId: updatedReply.post.forumId,
        } : null,
        parentId: updatedReply.parentId,
        parent: updatedReply.parent ? {
          id: updatedReply.parent.id,
          authorId: updatedReply.parent.authorId,
        } : null,
        depth: updatedReply.depth,
        attachments: updatedReply.attachments,
        score: updatedReply.score,
        updatedAt: updatedReply.updatedAt,
        editedAt: updatedReply.editedAt,
        author: updatedReply.author ? {
          id: updatedReply.author.id,
          name: updatedReply.author.firstName
            ? `${updatedReply.author.firstName} ${updatedReply.author.lastName || ""}`.trim()
            : updatedReply.author.email,
        } : null,
      },
    });
  } catch (error) {
    console.error("❌ Error updating reply:", error);

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
      { error: "Failed to update reply" },
      { status: 500 },
    );
  }
}

// DELETE /api/replies/[id] - Soft delete reply
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

    // Get reply to check permissions
    const reply = await replyRepository.getReplyById(id);
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // Check permissions
    const canDelete = await checkReplyDeletePermissions(reply, user);
    if (!canDelete) {
      return NextResponse.json(
        { error: "Insufficient permissions to delete this reply" },
        { status: 403 },
      );
    }

    // Get deletion reason from request body if provided
    const body = await request.json().catch(() => ({}));
    const deleteReason = body.reason || "Reply deleted by user";

    console.log("💬 Deleting reply:", {
      replyId: id,
      postId: reply.postId,
      deletedBy: user.email,
      reason: deleteReason,
    });

    // Soft delete reply
    await replyRepository.deleteReply(id, user.id, deleteReason);

    console.log("✅ Reply deleted successfully:", {
      replyId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Reply deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting reply:", error);
    return NextResponse.json(
      { error: "Failed to delete reply" },
      { status: 500 },
    );
  }
}

// Helper function to format child replies recursively
function formatChildReplies(children: any[], includeVotes: boolean): any[] {
  if (!children || children.length === 0) return [];

  return children.map(child => ({
    id: child.id,
    content: child.content,
    parentId: child.parentId,
    depth: child.depth,
    upvoteCount: child.upvoteCount,
    downvoteCount: child.downvoteCount,
    score: child.score,
    isDeleted: child.isDeleted,
    createdAt: child.createdAt,
    editedAt: child.editedAt,
    author: {
      id: child.author.id,
      name: child.author.firstName
        ? `${child.author.firstName} ${child.author.lastName || ""}`.trim()
        : child.author.email,
    },
    userVote: includeVotes && child.votes && child.votes.length > 0 ? child.votes[0].voteType : null,
    children: formatChildReplies(child.children || [], includeVotes),
  }));
}

// Helper function to check reply edit permissions
async function checkReplyEditPermissions(reply: any, user: any): Promise<boolean> {
  // Reply author can edit their own replies
  if (reply.authorId === user.id) {
    return true;
  }

  // Admin can edit any reply
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Get forum to check moderator status
  const post = await postRepository.getPostById(reply.postId);
  if (!post) return false;

  const forum = await forumRepository.getForumById(post.forumId);
  if (!forum) return false;

  // Forum moderators can edit replies
  if (forum.moderators && forum.moderators.includes(user.id)) {
    return true;
  }

  // Forum creator can edit replies
  if (forum.createdBy === user.id) {
    return true;
  }

  return false;
}

// Helper function to check reply deletion permissions
async function checkReplyDeletePermissions(reply: any, user: any): Promise<boolean> {
  // Reply author can delete their own replies
  if (reply.authorId === user.id) {
    return true;
  }

  // Admin can delete any reply
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Get forum to check moderator status
  const post = await postRepository.getPostById(reply.postId);
  if (!post) return false;

  const forum = await forumRepository.getForumById(post.forumId);
  if (!forum) return false;

  // Forum moderators can delete replies
  if (forum.moderators && forum.moderators.includes(user.id)) {
    return true;
  }

  // Forum creator can delete replies
  if (forum.createdBy === user.id) {
    return true;
  }

  return false;
}