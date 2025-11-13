import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole, NoteType, NoteVisibility } from "@prisma/client";
import { NoteRepository } from "@/lib/db/repositories/note.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationDispatcher } from "@/lib/notifications/notification-dispatcher.service";
import { NotificationType } from "@/lib/types";

const noteRepository = new NoteRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();
const notificationDispatcher = new NotificationDispatcher();

// Validation schema for creating a note
const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, "Note title is required")
    .max(200, "Note title must be less than 200 characters"),
  content: z
    .string()
    .min(1, "Note content is required")
    .max(100000, "Note content must be less than 100,000 characters"),
  type: z.enum(["TEXT", "CHECKLIST", "JOURNAL", "MEETING", "CARE_PLAN", "RESOURCE"]).default("TEXT"),
  visibility: z.enum(["PRIVATE", "FAMILY", "SHARED", "PUBLIC"]).default("PRIVATE"),
  familyId: z.string().optional(),
  sharedWith: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
  allowComments: z.boolean().optional(),
  allowEditing: z.boolean().optional(),
});

// GET /api/notes - List notes with filtering and access control
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

    console.log("📝 GET /api/notes - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get("createdBy");
    const familyId = searchParams.get("familyId");

    // Validate note type parameter
    const typeParam = searchParams.get("type");
    const validTypes: NoteType[] = ['TEXT', 'CHECKLIST', 'JOURNAL', 'MEETING', 'CARE_PLAN', 'RESOURCE'];
    const type = (typeParam && validTypes.includes(typeParam as NoteType)) ? typeParam as NoteType : null;

    const visibility = searchParams.get("visibility") as NoteVisibility | null;
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const isPinned = searchParams.get("isPinned") === "true" ? true :
                    searchParams.get("isPinned") === "false" ? false : undefined;
    const isArchived = searchParams.get("isArchived") === "true" ? true :
                      searchParams.get("isArchived") === "false" ? false : undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") as "createdAt" | "updatedAt" | "title" | "viewCount" || "updatedAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "desc";
    const includeShares = searchParams.get("includeShares") === "true";

    // Build filters object
    const filters = {
      ...(createdBy && { createdBy }),
      ...(familyId && { familyId }),
      ...(type && { type }),
      ...(visibility && { visibility }),
      ...(categoryId && { categoryId }),
      ...(search && { search }),
      ...(tags && { tags }),
      ...(isPinned !== undefined && { isPinned }),
      ...(isArchived !== undefined && { isArchived }),
      isDeleted: false,
    };

    console.log("🔍 Note filters applied:", filters);

    // Get notes with access control and pagination
    const result = await noteRepository.getNotes(user.id, filters, {
      page,
      limit,
      sortBy,
      sortOrder,
      includeShares,
    });

    console.log("✅ Notes retrieved:", {
      total: result.total,
      page: result.page,
      filters
    });

    // Format response
    const formattedNotes = result.items.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content.substring(0, 500), // Truncate for list view
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
      } : null,
      sharedWith: note.sharedWith,
      tags: note.tags,
      attachments: note.attachments,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
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
      shares: includeShares && note.shares ? note.shares.slice(0, 5).map(share => ({
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
        } : null,
      })) : [],
    }));

    return NextResponse.json({
      notes: formattedNotes,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      filters: {
        createdBy: createdBy || null,
        familyId: familyId || null,
        type: type || null,
        visibility: visibility || null,
        categoryId: categoryId || null,
        search: search || null,
        tags: tags || null,
        isPinned,
        isArchived,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 },
    );
  }
}

// POST /api/notes - Create a new note
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
    const validatedData = createNoteSchema.parse(body);

    console.log("📝 Creating note:", {
      data: validatedData,
      createdBy: user.email,
    });

    // Validate shared users if provided
    if (validatedData.sharedWith && validatedData.sharedWith.length > 0) {
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

    // Create note
    const note = await noteRepository.createNote({
      title: validatedData.title,
      content: validatedData.content,
      type: validatedData.type as NoteType,
      visibility: validatedData.visibility as NoteVisibility,
      createdBy: user.id,
      familyId: validatedData.familyId,
      sharedWith: validatedData.sharedWith || [],
      categoryId: validatedData.categoryId,
      tags: validatedData.tags || [],
      attachments: validatedData.attachments || [],
      allowComments: validatedData.allowComments || false,
      allowEditing: validatedData.allowEditing || false,
    });

    console.log("✅ Note created successfully:", {
      noteId: note.id,
      title: note.title,
      type: note.type,
      visibility: note.visibility,
      sharedWith: validatedData.sharedWith?.length || 0,
    });

    // Create sharing notifications (async)
    if (validatedData.sharedWith && validatedData.sharedWith.length > 0) {
      createNoteSharedNotifications(note.id, validatedData.sharedWith, user.id);
    }

    return NextResponse.json(
      {
        success: true,
        note: {
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
          } : null,
          sharedWith: note.sharedWith,
          tags: note.tags,
          attachments: note.attachments,
          isPinned: note.isPinned,
          isArchived: note.isArchived,
          allowComments: note.allowComments,
          allowEditing: note.allowEditing,
          viewCount: note.viewCount,
          createdAt: note.createdAt,
          creator: note.creator ? {
            id: note.creator.id,
            name: note.creator.firstName
              ? `${note.creator.firstName} ${note.creator.lastName || ""}`.trim()
              : note.creator.email,
            email: note.creator.email,
          } : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating note:", error);

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
      { error: "Failed to create note" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications when a note is shared
async function createNoteSharedNotifications(
  noteId: string,
  sharedWith: string[],
  creatorId: string
): Promise<void> {
  try {
    // Get note and creator details
    const note = await noteRepository.getNoteById(noteId, creatorId);
    const creator = await userRepository.getUserById(creatorId);

    if (!note || !creator) return;

    // Create notifications for shared users
    const notifications = sharedWith.map((userId) => ({
      userId,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "Note shared with you",
      message: `${creator.firstName} ${creator.lastName || ""} shared a note with you: "${note.title}"`,
      data: {
        noteId,
        noteTitle: note.title,
        noteType: note.type,
        creatorId,
        creatorName: `${creator.firstName} ${creator.lastName || ""}`,
        activityType: "note_shared"
      },
      actionUrl: `/notes/${noteId}`,
      isActionable: true
    }));

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
            recipientName: "Community Member",
            senderName: `${creator.firstName} ${creator.lastName || ""}`,
            familyName: note.family?.name || "Personal",
            authorName: `${creator.firstName} ${creator.lastName || ""}`,
          }
        );
      } catch (error) {
        console.error("❌ Failed to dispatch note sharing notification:", error);
        // Continue with other notifications if one fails
      }
    }

    console.log("✅ Note sharing notifications sent:", {
      noteId,
      notificationCount: notifications.length
    });
  } catch (error) {
    console.error("❌ Failed to create note sharing notifications:", error);
    // Don't throw error as this is not critical for note creation
  }
}