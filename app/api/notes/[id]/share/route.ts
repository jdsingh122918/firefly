import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { NoteRepository } from "@/lib/db/repositories/note.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";

const noteRepository = new NoteRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Validation schema for sharing a note
const shareNoteSchema = z.object({
  userIds: z
    .array(z.string())
    .min(1, "At least one user must be specified")
    .max(50, "Cannot share with more than 50 users at once"),
  canEdit: z.boolean().default(false),
  canComment: z.boolean().default(true),
  canShare: z.boolean().default(false),
  message: z.string().max(500, "Share message must be less than 500 characters").optional(),
});

// Validation schema for unsharing a note
const unshareNoteSchema = z.object({
  userIds: z
    .array(z.string())
    .min(1, "At least one user must be specified"),
});

// POST /api/notes/[id]/share - Share note with users
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
    const validatedData = shareNoteSchema.parse(body);

    console.log("📝 Sharing note:", {
      noteId: id,
      sharedBy: user.email,
      userCount: validatedData.userIds.length,
      permissions: {
        canEdit: validatedData.canEdit,
        canComment: validatedData.canComment,
        canShare: validatedData.canShare,
      },
    });

    // Check if note exists and user has permission to share
    const note = await noteRepository.getNoteById(id, user.id);
    if (!note) {
      return NextResponse.json(
        { error: "Note not found or access denied" },
        { status: 404 }
      );
    }

    // Check sharing permissions
    const canShare = await checkNoteSharingPermissions(note, user);
    if (!canShare) {
      return NextResponse.json(
        { error: "Insufficient permissions to share this note" },
        { status: 403 }
      );
    }

    // Validate that users exist
    const targetUsers = await Promise.all(
      validatedData.userIds.map(async (targetUserId) => {
        const targetUser = await userRepository.getUserById(targetUserId);
        if (!targetUser) {
          throw new Error(`User with ID ${targetUserId} not found`);
        }
        return targetUser;
      })
    );

    console.log("📝 Note will be shared with:", {
      users: targetUsers.map(u => ({ id: u.id, email: u.email })),
    });

    // Share note with users (one by one since interface expects single user)
    const shareResults = await Promise.allSettled(
      validatedData.userIds.map(userId =>
        noteRepository.shareNote({
          noteId: id,
          userId: userId,
          sharedBy: user.id,
          canEdit: validatedData.canEdit,
          canComment: validatedData.canComment,
          canShare: validatedData.canShare,
        })
      )
    );

    // Process results from Promise.allSettled
    const successful = shareResults
      .map((result, index) => ({
        result,
        userId: validatedData.userIds[index]
      }))
      .filter(item => item.result.status === 'fulfilled')
      .map(item => ({ userId: item.userId }));

    const failed = shareResults.filter(result => result.status === 'rejected');

    console.log("✅ Note shared successfully:", {
      noteId: id,
      successfulShares: successful.length,
      failedShares: failed.length,
    });

    // Create sharing notifications (async)
    if (successful.length > 0) {
      createNoteShareNotifications(
        id,
        successful.map(s => s.userId),
        user.id,
        validatedData.message
      );
    }

    return NextResponse.json({
      success: true,
      message: `Note shared with ${successful.length} users`,
      results: {
        successful: successful,
        failed: failed,
      },
    });
  } catch (error) {
    console.error("❌ Error sharing note:", error);

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
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "One or more users not found" },
          { status: 400 },
        );
      }
      if (error.message.includes("already shared")) {
        return NextResponse.json(
          { error: "Note already shared with one or more users" },
          { status: 400 },
        );
      }
      if (error.message.includes("cannot share with yourself")) {
        return NextResponse.json(
          { error: "Cannot share note with yourself" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to share note" },
      { status: 500 },
    );
  }
}

// DELETE /api/notes/[id]/share - Unshare note from users
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = unshareNoteSchema.parse(body);

    console.log("📝 Unsharing note:", {
      noteId: id,
      unsharedBy: user.email,
      userCount: validatedData.userIds.length,
    });

    // Check if note exists and user has permission to unshare
    const note = await noteRepository.getNoteById(id, user.id);
    if (!note) {
      return NextResponse.json(
        { error: "Note not found or access denied" },
        { status: 404 }
      );
    }

    // Check unsharing permissions (only note creator or admin can unshare)
    const canUnshare = await checkNoteUnsharingPermissions(note, user);
    if (!canUnshare) {
      return NextResponse.json(
        { error: "Insufficient permissions to unshare this note" },
        { status: 403 }
      );
    }

    // Unshare note from users (one by one since method expects individual parameters)
    const unshareResults = await Promise.allSettled(
      validatedData.userIds.map(userId =>
        noteRepository.unshareNote(id, userId, user.id)
      )
    );

    // Process results from Promise.allSettled
    const successfulUnshares = unshareResults
      .map((result, index) => ({
        result,
        userId: validatedData.userIds[index]
      }))
      .filter(item => item.result.status === 'fulfilled')
      .map(item => ({ userId: item.userId }));

    const failedUnshares = unshareResults.filter(result => result.status === 'rejected');

    console.log("✅ Note unshared successfully:", {
      noteId: id,
      successfulUnshares: successfulUnshares.length,
      failedUnshares: failedUnshares.length,
    });

    return NextResponse.json({
      success: true,
      message: `Note unshared from ${successfulUnshares.length} users`,
      results: {
        successful: successfulUnshares,
        failed: failedUnshares,
      },
    });
  } catch (error) {
    console.error("❌ Error unsharing note:", error);

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
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "One or more users not found" },
          { status: 400 },
        );
      }
      if (error.message.includes("not shared")) {
        return NextResponse.json(
          { error: "Note not shared with one or more users" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to unshare note" },
      { status: 500 },
    );
  }
}

// GET /api/notes/[id]/share - Get note sharing details
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

    console.log("📝 Getting note sharing details:", {
      noteId: id,
      requestedBy: user.email,
    });

    // Get note with sharing details
    const note = await noteRepository.getNoteById(id, user.id, {
      includeShares: true,
    });

    if (!note) {
      return NextResponse.json(
        { error: "Note not found or access denied" },
        { status: 404 }
      );
    }

    // Check if user can view sharing details (note creator, shared users, or admin)
    const canViewShares = await checkNoteShareViewPermissions(note, user);
    if (!canViewShares) {
      return NextResponse.json(
        { error: "Insufficient permissions to view sharing details" },
        { status: 403 }
      );
    }

    // Format sharing details
    const sharingDetails = {
      noteId: note.id,
      noteTitle: note.title,
      visibility: note.visibility,
      isShared: note.shares && note.shares.length > 0,
      shareCount: note.shares ? note.shares.length : 0,
      shares: note.shares ? note.shares.map(share => ({
        id: share.id,
        userId: share.userId,
        canEdit: share.canEdit,
        canComment: share.canComment,
        canShare: share.canShare,
        sharedAt: share.sharedAt,
        user: share.user ? {
          id: share.user.id,
          name: share.user.firstName
            ? `${share.user.firstName} ${share.user.lastName || ""}`.trim()
            : share.user.email,
          email: share.user.email,
        } : null,
        sharedBy: share.sharedByUser ? {
          id: share.sharedByUser.id,
          name: share.sharedByUser.firstName
            ? `${share.sharedByUser.firstName} ${share.sharedByUser.lastName || ""}`.trim()
            : share.sharedByUser.email,
          email: share.sharedByUser.email,
        } : null,
      })) : [],
    };

    return NextResponse.json({
      sharing: sharingDetails,
    });
  } catch (error) {
    console.error("❌ Error getting note sharing details:", error);
    return NextResponse.json(
      { error: "Failed to get sharing details" },
      { status: 500 },
    );
  }
}

// Helper function to check note sharing permissions
async function checkNoteSharingPermissions(note: any, user: any): Promise<boolean> {
  // Note creator can share their own notes
  if (note.createdBy === user.id) {
    return true;
  }

  // Admin can share any note
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Users with sharing permissions can share
  if (note.shares) {
    const userShare = note.shares.find((share: any) => share.userId === user.id);
    if (userShare && userShare.canShare) {
      return true;
    }
  }

  return false;
}

// Helper function to check note unsharing permissions
async function checkNoteUnsharingPermissions(note: any, user: any): Promise<boolean> {
  // Note creator can unshare from anyone
  if (note.createdBy === user.id) {
    return true;
  }

  // Admin can unshare any note
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  return false;
}

// Helper function to check note share view permissions
async function checkNoteShareViewPermissions(note: any, user: any): Promise<boolean> {
  // Note creator can view sharing details
  if (note.createdBy === user.id) {
    return true;
  }

  // Admin can view any note's sharing details
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Users who have the note shared with them can view basic sharing details
  if (note.shares) {
    const userShare = note.shares.find((share: any) => share.userId === user.id);
    if (userShare) {
      return true;
    }
  }

  return false;
}

// Helper function to create note sharing notifications
async function createNoteShareNotifications(
  noteId: string,
  sharedWithUserIds: string[],
  sharedByUserId: string,
  message?: string
): Promise<void> {
  try {
    // Get note and sharer details
    const note = await noteRepository.getNoteById(noteId, sharedByUserId);
    const sharer = await userRepository.getUserById(sharedByUserId);

    if (!note || !sharer) return;

    // Create notifications for shared users
    const notifications = sharedWithUserIds.map((userId) => ({
      userId,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "Note shared with you",
      message: message
        ? `${sharer.firstName} ${sharer.lastName || ""} shared a note with you: "${note.title}" - ${message}`
        : `${sharer.firstName} ${sharer.lastName || ""} shared a note with you: "${note.title}"`,
      data: {
        noteId,
        noteTitle: note.title,
        noteType: note.type,
        sharedByUserId,
        sharedByName: `${sharer.firstName} ${sharer.lastName || ""}`,
        shareMessage: message,
        activityType: "note_shared"
      },
      actionUrl: `/notes/${noteId}`,
      isActionable: true
    }));

    // Create notifications in parallel (in batches to avoid overwhelming the system)
    const batchSize = 20;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      await Promise.all(
        batch.map((notification) =>
          notificationRepository.createNotification(notification),
        ),
      );
    }

    console.log("✅ Note sharing notifications sent:", {
      noteId,
      notificationCount: notifications.length
    });
  } catch (error) {
    console.error("❌ Failed to create note sharing notifications:", error);
    // Don't throw error as this is not critical for sharing functionality
  }
}