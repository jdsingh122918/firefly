import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { VoteType } from "@prisma/client";
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

// Validation schema for voting
const voteSchema = z.object({
  voteType: z.enum(["UPVOTE", "DOWNVOTE"], {
    message: "Vote type must be UPVOTE or DOWNVOTE",
  }),
});

// POST /api/posts/[id]/vote - Vote on a post
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

    console.log("🗳️ Voting on post:", {
      postId: id,
      userId: user.id,
      voteType: validatedData.voteType,
    });

    // Check if post exists
    const post = await postRepository.getPostById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if post is deleted
    if (post.isDeleted) {
      return NextResponse.json(
        { error: "Cannot vote on deleted posts" },
        { status: 400 }
      );
    }

    // Check forum access permissions
    const forum = await forumRepository.getForumById(post.forumId);
    if (!forum) {
      return NextResponse.json({ error: "Forum not found" }, { status: 404 });
    }

    // Check if user has access to the forum and can vote
    const canVote = await checkVotingPermissions(forum, user);
    if (!canVote) {
      return NextResponse.json(
        { error: "Access denied. You must be a member of this forum to vote." },
        { status: 403 }
      );
    }

    // Perform the vote
    const result = await postRepository.voteOnPost({
      userId: user.id,
      postId: id,
      voteType: validatedData.voteType as VoteType,
    });

    console.log("✅ Post vote recorded:", {
      postId: id,
      userId: user.id,
      voteType: validatedData.voteType,
      newScore: result.score,
      success: result.success,
    });

    // Create notification for post author (if upvote and not self-vote)
    if (validatedData.voteType === VoteType.UPVOTE && post.authorId !== user.id) {
      await createVoteNotification(id, post.authorId, user.id, "upvote");
    }

    return NextResponse.json({
      success: result.success,
      score: result.score,
      voteType: validatedData.voteType,
      message: "Vote recorded successfully",
    });
  } catch (error) {
    console.error("❌ Error voting on post:", error);

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

// DELETE /api/posts/[id]/vote - Remove vote from post
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

    console.log("🗳️ Removing vote from post:", {
      postId: id,
      userId: user.id,
    });

    // Check if post exists
    const post = await postRepository.getPostById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // For removing vote, we can use the same vote endpoint with the current vote type
    // This will toggle it off (remove the vote)
    // First, we need to get the current vote to know what type to "toggle"

    // This is a simplified approach - in a real implementation, you might want to
    // add a specific "removeVote" method to the repository
    // For now, we'll indicate this endpoint exists but might need enhancement

    return NextResponse.json({
      success: true,
      message: "Vote removal functionality would be implemented here",
      note: "Use POST with the same vote type to toggle/remove vote",
    });
  } catch (error) {
    console.error("❌ Error removing vote from post:", error);
    return NextResponse.json(
      { error: "Failed to remove vote" },
      { status: 500 },
    );
  }
}

// GET /api/posts/[id]/vote - Get user's vote status for post
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

    console.log("🗳️ Getting vote status for post:", {
      postId: id,
      userId: user.id,
    });

    // Get post with user's vote status
    const post = await postRepository.getPostById(id, {
      includeVotes: true,
      userId: user.id,
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Extract user's vote from the post data
    const userVote = post.votes && post.votes.length > 0 ? post.votes[0].voteType : null;

    return NextResponse.json({
      postId: id,
      userVote,
      score: post.score,
      upvoteCount: post.upvoteCount,
      downvoteCount: post.downvoteCount,
    });
  } catch (error) {
    console.error("❌ Error getting vote status:", error);
    return NextResponse.json(
      { error: "Failed to get vote status" },
      { status: 500 },
    );
  }
}

// Helper function to check voting permissions
async function checkVotingPermissions(forum: any, user: any): Promise<boolean> {
  // Check if user is a member of the forum
  let isMember = await forumRepository.isMember(forum.id, user.id);

  // Auto-enroll user in PUBLIC forums if not already a member
  if (!isMember && forum.visibility === "PUBLIC") {
    try {
      await forumRepository.addMember({
        forumId: forum.id,
        userId: user.id,
        role: "member",
        notifications: true, // Enable notifications by default
      });
      isMember = true;
      console.log("✅ Auto-enrolled user in PUBLIC forum during vote:", {
        forumId: forum.id,
        userId: user.id,
        forumTitle: forum.title,
      });
    } catch (error) {
      // If enrollment fails (e.g., user already a member due to race condition),
      // continue - they might already be a member now
      console.error("⚠️ Failed to auto-enroll user in forum during vote:", error);
      // Re-check membership after potential race condition
      isMember = await forumRepository.isMember(forum.id, user.id);
    }
  }

  if (!isMember) {
    return false;
  }

  // Check if forum is active
  if (!forum.isActive || forum.isArchived) {
    return false;
  }

  // Add additional voting permission checks based on forum settings if needed
  // For now, any forum member can vote
  return true;
}

// Helper function to create vote notifications
async function createVoteNotification(
  postId: string,
  authorId: string,
  voterId: string,
  voteType: "upvote" | "downvote"
): Promise<void> {
  try {
    // Don't notify for downvotes to avoid negative feedback loops
    if (voteType === "downvote") return;

    // Get post and voter details
    const post = await postRepository.getPostById(postId);
    const voter = await userRepository.getUserById(voterId);

    if (!post || !voter) return;

    // Create notification for post author
    const notification = {
      userId: authorId,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "Your post received an upvote",
      message: `${voter.firstName} ${voter.lastName || ""} upvoted your post: "${post.title}"`,
      data: {
        postId,
        postTitle: post.title,
        postSlug: post.slug,
        voterId,
        voterName: `${voter.firstName} ${voter.lastName || ""}`,
        voteType,
        activityType: "post_upvoted"
      },
      actionUrl: post.forum ? `/forums/${post.forum.slug}/posts/${post.slug}` : `/posts/${post.slug}`,
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

    console.log("✅ Vote notification sent:", {
      postId,
      authorId,
      voteType,
    });
  } catch (error) {
    console.error("❌ Failed to create vote notification:", error);
    // Don't throw error as this is not critical for voting functionality
  }
}