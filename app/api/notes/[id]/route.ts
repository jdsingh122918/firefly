import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole, NoteType, NoteVisibility } from "@prisma/client";
import { NoteRepository } from "@/lib/db/repositories/note.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationDispatcher } from "@/lib/notifications/notification-dispatcher.service";
import { NotificationType } from "@/lib/types";

const noteRepository = new NoteRepository();
const userRepository = new UserRepository();
const notificationDispatcher = new NotificationDispatcher();

// Validation schema for updating a note
const updateNoteSchema = z.object({
  title: z
    .string()
    .min(1, "Note title is required")
    .max(200, "Note title must be less than 200 characters")
    .optional(),
  content: z
    .string()
    .min(1, "Note content is required")
    .max(100000, "Note content must be less than 100,000 characters")
    .optional(),
  type: z.enum(["TEXT", "CHECKLIST", "JOURNAL", "MEETING", "CARE_PLAN", "RESOURCE"]).optional(),
  visibility: z.enum(["PRIVATE", "FAMILY", "SHARED", "PUBLIC"]).optional(),
  sharedWith: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  allowEditing: z.boolean().optional(),
});

// GET /api/notes/[id] - Get note by ID with access control
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
    const includeShares = searchParams.get("includeShares") === "true";
    const includeDocuments = searchParams.get("includeDocuments") === "true";

    console.log("📝 GET /api/notes/[id] - User:", {
      role: user.role,
      email: user.email,
      noteId: id,
    });

    // Get note with access control
    const note = await noteRepository.getNoteById(id, user.id, {
      includeDeleted: false,
      includeShares,
      includeDocuments,
    });

    if (!note) {
      return NextResponse.json(
        { error: "Note not found or access denied" },
        { status: 404 }
      );
    }

    console.log("✅ Note retrieved:", {
      noteId: note.id,
      title: note.title,
      type: note.type,
      visibility: note.visibility,
      viewCount: note.viewCount,
    });

    // Format response
    const formattedNote = {
      id: note.id,
      title: note.title,
      content: note.content,
      type: note.type,
      visibility: note.visibility,
      familyId: note.familyId,
      family: note.family ? {
        id: note.family.id,
        name: note.family.name,
      } : null,
      categoryId: note.categoryId,
      category: note.category ? {
        id: note.category.id,
        name: note.category.name,
        color: note.category.color,
        icon: note.category.icon,
      } : null,
      sharedWith: note.sharedWith,
      tags: note.tags,
      attachments: note.attachments,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      isDeleted: note.isDeleted,
      allowComments: note.allowComments,
      allowEditing: note.allowEditing,
      viewCount: note.viewCount,
      lastEditedBy: note.lastEditedBy,
      lastEditedAt: note.lastEditedAt,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      creator: note.creator ? {
        id: note.creator.id,
        name: note.creator.firstName
          ? `${note.creator.firstName} ${note.creator.lastName || ""}`.trim()
          : note.creator.email,
        email: note.creator.email,
      } : null,
      shares: includeShares && note.shares ? note.shares.map(share => ({
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
        sharedByUser: share.sharedByUser ? {
          id: share.sharedByUser.id,
          name: share.sharedByUser.firstName
            ? `${share.sharedByUser.firstName} ${share.sharedByUser.lastName || ""}`.trim()
            : share.sharedByUser.email,
        } : null,
      })) : [],
      documents: includeDocuments && note.documents ? note.documents.map(doc => ({
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
      note: formattedNote,
    });
  } catch (error) {
    console.error("❌ Error fetching note:", error);

    // Handle access denied errors specifically
    if (error instanceof Error && error.message.includes("Access denied")) {
      return NextResponse.json(
        { error: "Access denied to this note" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch note" },
      { status: 500 },
    );
  }
}

// PUT /api/notes/[id] - Update note
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateNoteSchema.parse(body);

    console.log("📝 Updating note:", {
      noteId: id,
      data: validatedData,
      updatedBy: user.email,
    });

    // Validate shared users if being updated
    if (validatedData.sharedWith) {
      const sharedUsers = await Promise.all(
        validatedData.sharedWith.map(async (sharedUserId) => {
          const sharedUser = await userRepository.getUserById(sharedUserId);
          if (!sharedUser) {
            throw new Error(`User with ID ${sharedUserId} not found`);
          }
          return sharedUser;
        })
      );

      console.log("📝 Note will be shared with:", {
        userCount: sharedUsers.length,
        users: sharedUsers.map(u => ({ id: u.id, email: u.email })),
      });
    }

    // Update note with access control
    const updatedNote = await noteRepository.updateNote(id, user.id, validatedData);

    console.log("✅ Note updated successfully:", {
      noteId: updatedNote.id,
      title: updatedNote.title,
      changes: Object.keys(validatedData),
    });

    // Create update notifications (async)
    createNoteUpdateNotifications(id, user.id, Object.keys(validatedData));

    return NextResponse.json({
      success: true,
      note: {
        id: updatedNote.id,
        title: updatedNote.title,
        content: updatedNote.content,
        type: updatedNote.type,
        visibility: updatedNote.visibility,
        familyId: updatedNote.familyId,
        family: updatedNote.family ? {
          id: updatedNote.family.id,
          name: updatedNote.family.name,
        } : null,
        categoryId: updatedNote.categoryId,
        category: updatedNote.category ? {
          id: updatedNote.category.id,
          name: updatedNote.category.name,
          color: updatedNote.category.color,
        } : null,
        sharedWith: updatedNote.sharedWith,
        tags: updatedNote.tags,
        attachments: updatedNote.attachments,
        isPinned: updatedNote.isPinned,
        isArchived: updatedNote.isArchived,
        allowComments: updatedNote.allowComments,
        allowEditing: updatedNote.allowEditing,
        lastEditedBy: updatedNote.lastEditedBy,
        lastEditedAt: updatedNote.lastEditedAt,
        updatedAt: updatedNote.updatedAt,
        creator: updatedNote.creator ? {
          id: updatedNote.creator.id,
          name: updatedNote.creator.firstName
            ? `${updatedNote.creator.firstName} ${updatedNote.creator.lastName || ""}`.trim()
            : updatedNote.creator.email,
        } : null,
      },
    });
  } catch (error) {
    console.error("❌ Error updating note:", error);

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
      if (error.message.includes("Note not found")) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 },
        );
      }
      if (error.message.includes("Access denied")) {
        return NextResponse.json(
          { error: "Access denied to edit this note" },
          { status: 403 },
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "One or more shared users not found" },
          { status: 400 },
        );
      }
      if (error.message.includes("Category not found")) {
        return NextResponse.json(
          { error: "Category not found or not active" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 },
    );
  }
}

// DELETE /api/notes/[id] - Soft delete note
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

    console.log("📝 Deleting note:", {
      noteId: id,
      deletedBy: user.email,
    });

    // Delete note with access control (only creator can delete)
    await noteRepository.deleteNote(id, user.id);

    console.log("✅ Note deleted successfully:", {
      noteId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting note:", error);

    // Handle specific repository errors
    if (error instanceof Error) {
      if (error.message.includes("Note not found")) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 },
        );
      }
      if (error.message.includes("Only the note creator")) {
        return NextResponse.json(
          { error: "Only the note creator can delete this note" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications when a note is updated
async function createNoteUpdateNotifications(
  noteId: string,
  editorId: string,
  changedFields: string[]
): Promise<void> {
  try {
    // Get note details with shares
    const note = await noteRepository.getNoteById(noteId, editorId, {
      includeShares: true,
      includeDeleted: false
    });

    const editor = await userRepository.getUserById(editorId);

    if (!note || !editor) return;

    const notifications: any[] = [];
    const notifiedUserIds = new Set<string>();

    // Determine what was changed to customize the notification message
    const significantChanges = changedFields.filter(field =>
      ['title', 'content', 'visibility', 'sharedWith'].includes(field)
    );

    const changeDescription = significantChanges.length > 0 ?
      `updated ${significantChanges.join(', ')}` : 'made changes to';

    // Notify original creator if someone else is editing
    if (note.createdBy !== editorId) {
      notifications.push({
        userId: note.createdBy,
        type: NotificationType.FAMILY_ACTIVITY,
        title: "Your note was updated",
        message: `${editor.firstName} ${editor.lastName || ""} ${changeDescription} your note: "${note.title}"`,
        data: {
          noteId,
          noteTitle: note.title,
          noteType: note.type,
          editorId,
          editorName: `${editor.firstName} ${editor.lastName || ""}`,
          changedFields,
          activityType: "note_updated"
        },
        actionUrl: `/notes/${noteId}`,
        isActionable: true
      });
      notifiedUserIds.add(note.createdBy);
    }

    // Notify users who have the note shared with them (except the editor)
    if (note.shares && note.shares.length > 0) {
      note.shares.forEach(share => {
        if (share.userId !== editorId && !notifiedUserIds.has(share.userId)) {
          notifications.push({
            userId: share.userId,
            type: NotificationType.FAMILY_ACTIVITY,
            title: "A shared note was updated",
            message: `${editor.firstName} ${editor.lastName || ""} ${changeDescription} a shared note: "${note.title}"`,
            data: {
              noteId,
              noteTitle: note.title,
              noteType: note.type,
              editorId,
              editorName: `${editor.firstName} ${editor.lastName || ""}`,
              changedFields,
              activityType: "shared_note_updated"
            },
            actionUrl: `/notes/${noteId}`,
            isActionable: true
          });
          notifiedUserIds.add(share.userId);
        }
      });
    }

    // For family-visible notes, notify family members with appropriate access
    if (note.visibility === NoteVisibility.FAMILY && note.familyId) {
      // Note: This would require family member lookup which isn't implemented yet
      // For now, skip family notifications until family repository is available
    }

    // Create and dispatch notifications with real-time SSE broadcasting
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
            recipientName: "Community Member",
            senderName: `${editor.firstName} ${editor.lastName || ""}`,
            familyName: note.family?.name || "Personal",
            authorName: `${editor.firstName} ${editor.lastName || ""}`,
          }
        );
      } catch (error) {
        console.error("❌ Failed to dispatch note update notification:", error);
        // Continue with other notifications if one fails
      }
    }

    console.log("✅ Note update notifications sent:", {
      noteId,
      editorId,
      notificationCount: notifications.length,
      changedFields
    });
  } catch (error) {
    console.error("❌ Failed to create note update notifications:", error);
    // Don't throw error as this is not critical for note update
  }
}