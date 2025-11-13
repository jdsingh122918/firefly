import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { VoteType } from "@prisma/client";
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

// Validation schema for voting on replies
const voteSchema = z.object({
  voteType: z.enum(["UPVOTE", "DOWNVOTE"], {
    message: "Vote type must be UPVOTE or DOWNVOTE",
  }),
});

// POST /api/replies/[id]/vote - Vote on a reply
export async function POST(
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = voteSchema.parse(body);

    console.log("🗳️ Voting on reply:", {
      replyId: id,
      userId: user.id,
      voteType: validatedData.voteType,
    });

    // Check if reply exists
    const reply = await replyRepository.getReplyById(id);
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // Check if reply is deleted
    if (reply.isDeleted) {
      return NextResponse.json(
        { error: "Cannot vote on deleted replies" },
        { status: 400 }
      );
    }

    // Check access permissions via post and forum
    const post = await postRepository.getPostById(reply.postId);
    if (!post) {
      return NextResponse.json({ error: "Associated post not found" }, { status: 404 });
    }

    if (post.isDeleted) {
      return NextResponse.json(
        { error: "Cannot vote on replies to deleted posts" },
        { status: 400 }
      );
    }

    const forum = await forumRepository.getForumById(post.forumId);
    if (!forum) {
      return NextResponse.json({ error: "Associated forum not found" }, { status: 404 });
    }

    // Check if user has voting permissions
    const canVote = await checkReplyVotingPermissions(forum, user);
    if (!canVote) {
      return NextResponse.json(
        { error: "Access denied. You must be a member of this forum to vote." },
        { status: 403 }
      );
    }

    // Perform the vote
    const result = await replyRepository.voteOnReply({
      userId: user.id,
      replyId: id,
      voteType: validatedData.voteType as VoteType,
    });

    console.log("✅ Reply vote recorded:", {
      replyId: id,
      userId: user.id,
      voteType: validatedData.voteType,
      newScore: result.score,
      success: result.success,
    });

    // Create notification for reply author (if upvote and not self-vote)
    if (validatedData.voteType === VoteType.UPVOTE && reply.authorId !== user.id) {
      await createReplyVoteNotification(id, reply.authorId, user.id, "upvote");
    }

    return NextResponse.json({
      success: result.success,
      score: result.score,
      voteType: validatedData.voteType,
      message: "Vote recorded successfully",
    });
  } catch (error) {
    console.error("❌ Error voting on reply:", error);

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

    // Handle specific voting errors
    if (error instanceof Error) {
      if (error.message.includes("not a member")) {
        return NextResponse.json(
          { error: "You must be a member of this forum to vote" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 },
    );
  }
}

// DELETE /api/replies/[id]/vote - Remove vote from reply
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

    console.log("🗳️ Removing vote from reply:", {
      replyId: id,
      userId: user.id,
    });

    // Check if reply exists
    const reply = await replyRepository.getReplyById(id);
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // For removing vote, we can use the same vote endpoint with the current vote type
    // This will toggle it off (remove the vote)
    // This is a simplified approach - in a real implementation, you might want to
    // add a specific "removeVote" method to the repository

    return NextResponse.json({
      success: true,
      message: "Vote removal functionality would be implemented here",
      note: "Use POST with the same vote type to toggle/remove vote",
    });
  } catch (error) {
    console.error("❌ Error removing vote from reply:", error);
    return NextResponse.json(
      { error: "Failed to remove vote" },
      { status: 500 },
    );
  }
}

// GET /api/replies/[id]/vote - Get user's vote status for reply
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

    console.log("🗳️ Getting vote status for reply:", {
      replyId: id,
      userId: user.id,
    });

    // Get reply with user's vote status
    const reply = await replyRepository.getReplyById(id, {
      includeVotes: true,
      userId: user.id,
    });

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // Extract user's vote from the reply data
    const userVote = reply.votes && reply.votes.length > 0 ? reply.votes[0].voteType : null;

    return NextResponse.json({
      replyId: id,
      userVote,
      score: reply.score,
      upvoteCount: reply.upvoteCount,
      downvoteCount: reply.downvoteCount,
    });
  } catch (error) {
    console.error("❌ Error getting vote status:", error);
    return NextResponse.json(
      { error: "Failed to get vote status" },
      { status: 500 },
    );
  }
}

// Helper function to check reply voting permissions
async function checkReplyVotingPermissions(forum: any, user: any): Promise<boolean> {
  // Check if user is a member of the forum
  const isMember = await forumRepository.isMember(forum.id, user.id);
  if (!isMember) {
    return false;
  }

  // Check if forum is active
  if (!forum.isActive || forum.isArchived) {
    return false;
  }

  // Add additional voting permission checks based on forum settings if needed
  // For now, any forum member can vote on replies
  return true;
}

// Helper function to create reply vote notifications
async function createReplyVoteNotification(
  replyId: string,
  authorId: string,
  voterId: string,
  voteType: "upvote" | "downvote"
): Promise<void> {
  try {
    // Don't notify for downvotes to avoid negative feedback loops
    if (voteType === "downvote") return;

    // Get reply, post, and voter details
    const reply = await replyRepository.getReplyById(replyId);
    const voter = await userRepository.getUserById(voterId);

    if (!reply || !voter) return;

    // Get post details for context
    const post = await postRepository.getPostById(reply.postId);
    if (!post) return;

    // Create notification for reply author
    const notification = {
      userId: authorId,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "Your reply received an upvote",
      message: `${voter.firstName} ${voter.lastName || ""} upvoted your reply on: "${post.title}"`,
      data: {
        replyId,
        postId: reply.postId,
        postTitle: post.title,
        postSlug: post.slug,
        voterId,
        voterName: `${voter.firstName} ${voter.lastName || ""}`,
        voteType,
        activityType: "reply_upvoted"
      },
      actionUrl: `/forums/${post.forum?.slug}/posts/${post.slug}#reply-${replyId}`,
      isActionable: true
    };

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
        recipientName: "Forum Member",
        senderName: `${voter.firstName} ${voter.lastName || ""}`,
        familyName: post.forum?.title || "Forum",
        authorName: `${voter.firstName} ${voter.lastName || ""}`,
      }
    );

    console.log("✅ Reply vote notification sent:", {
      replyId,
      authorId,
      voteType,
    });
  } catch (error) {
    console.error("❌ Failed to create reply vote notification:", error);
    // Don't throw error as this is not critical for voting functionality
  }
}