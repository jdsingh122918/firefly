import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ShareNoteInput,
  NoteFilters,
  PaginatedResult,
  NoteVisibility,
  NoteType,
} from "@/lib/types";

/**
 * Note Repository - Manages personal and shared notes with collaboration features
 * Supports different note types, visibility controls, and sharing permissions
 */
export class NoteRepository {
  /**
   * Create a new note
   */
  async createNote(data: CreateNoteInput): Promise<Note> {
    try {
      // Validate required fields
      if (!data.title || !data.content || !data.createdBy) {
        throw new Error("Missing required fields: title, content, and createdBy are required");
      }

      // Verify creator exists
      const creator = await prisma.user.findUnique({
        where: { id: data.createdBy },
        select: { id: true, familyId: true },
      });

      if (!creator) {
        throw new Error("Creator not found");
      }

      // Validate family if familyId provided
      if (data.familyId) {
        const family = await prisma.family.findUnique({
          where: { id: data.familyId },
          select: { id: true },
        });

        if (!family) {
          throw new Error(`Family with ID ${data.familyId} not found`);
        }
      }

      // Validate category if provided
      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
          select: { id: true, isActive: true },
        });

        if (!category || !category.isActive) {
          throw new Error("Category not found or not active");
        }
      }

      // Validate shared users if provided
      if (data.sharedWith && data.sharedWith.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            id: { in: data.sharedWith },
          },
          select: { id: true },
        });

        if (users.length !== data.sharedWith.length) {
          throw new Error("One or more shared users not found");
        }
      }

      const note = await prisma.note.create({
        data: {
          title: data.title,
          content: data.content,
          type: data.type || NoteType.TEXT,
          visibility: data.visibility || NoteVisibility.PRIVATE,
          createdBy: data.createdBy,
          familyId: data.familyId || creator.familyId,
          sharedWith: data.sharedWith || [],
          tags: data.tags || [],
          categoryId: data.categoryId,
          attachments: data.attachments || [],
          allowComments: data.allowComments || false,
          allowEditing: data.allowEditing || false,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Create shared note records if users were specified
      if (data.sharedWith && data.sharedWith.length > 0) {
        const shareRecords = data.sharedWith.map(userId => ({
          noteId: note.id,
          userId,
          sharedBy: data.createdBy,
          canEdit: data.allowEditing || false,
          canComment: data.allowComments || false,
          canShare: false, // Default to false, can be updated later
        }));

        await prisma.noteShare.createMany({
          data: shareRecords,
        });
      }

      console.log("📝 Note created:", {
        id: note.id,
        title: note.title,
        type: note.type,
        visibility: note.visibility,
        createdBy: note.createdBy,
        sharedWith: data.sharedWith?.length || 0,
      });

      return note as unknown as Note;
    } catch (error) {
      console.error("❌ Failed to create note:", error);
      throw error;
    }
  }

  /**
   * Get note by ID with access control
   */
  async getNoteById(
    id: string,
    userId: string,
    options: {
      includeDeleted?: boolean;
      includeShares?: boolean;
      includeDocuments?: boolean;
    } = {}
  ): Promise<Note | null> {
    try {
      const whereClause: { id: string; isDeleted?: boolean } = { id };

      if (!options.includeDeleted) {
        whereClause.isDeleted = false;
      }

      const include: Prisma.NoteInclude = {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      };

      if (options.includeShares) {
        include.shares = {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            sharedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        };
      }

      if (options.includeDocuments) {
        include.documents = {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                fileName: true,
                originalFileName: true,
                fileSize: true,
                mimeType: true,
                type: true,
                status: true,
                uploadedBy: true,
                familyId: true,
                tags: true,
                filePath: true,
                duration: true,
                width: true,
                height: true,
                thumbnailPath: true,
                previewPath: true,
                metadata: true,
                isPublic: true,
                expiresAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { order: "asc" },
        };
      }

      const note = await prisma.note.findUnique({
        where: whereClause,
        include,
      });

      if (!note) {
        return null;
      }

      // Check access permissions
      if (!this.canUserAccessNote(note, userId)) {
        throw new Error("Access denied to this note");
      }

      // Update view count if not the creator
      if (note.createdBy !== userId) {
        await this.incrementViewCount(id);
      }

      // Transform documents from junction table to Document array if included
      if (options.includeDocuments && note.documents) {
        const transformedNote = {
          ...note,
          documents: note.documents.map((nd: any) => nd.document)
        };
        return transformedNote as unknown as Note;
      }

      // Return note without documents transformation
      return note as unknown as Note;
    } catch (error) {
      console.error("❌ Failed to get note by ID:", error);
      throw error;
    }
  }

  /**
   * Get notes with filtering and pagination
   */
  async getNotes(
    userId: string,
    filters: NoteFilters = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: "createdAt" | "updatedAt" | "title" | "viewCount";
      sortOrder?: "asc" | "desc";
      includeShares?: boolean;
    } = {}
  ): Promise<PaginatedResult<Note>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "updatedAt",
        sortOrder = "desc",
        includeShares = false,
      } = options;

      // Build where clause with access control
      const where: Prisma.NoteWhereInput = {};

      // Access control: user can see their own notes, shared notes, and family/public notes
      const accessConditions: Prisma.NoteWhereInput[] = [
        { createdBy: userId }, // Own notes
      ];

      // Shared notes
      accessConditions.push({
        shares: {
          some: {
            userId,
          },
        },
      });

      // Family notes if user has familyId
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { familyId: true },
      });

      if (user?.familyId) {
        accessConditions.push({
          visibility: NoteVisibility.FAMILY,
          familyId: user.familyId,
        });
      }

      // Public notes
      accessConditions.push({
        visibility: NoteVisibility.PUBLIC,
      });

      where.OR = accessConditions;

      // Apply filters
      if (filters.createdBy) where.createdBy = filters.createdBy;
      if (filters.familyId) where.familyId = filters.familyId;
      if (filters.type) where.type = filters.type;
      if (filters.visibility) where.visibility = filters.visibility;
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.isPinned !== undefined) where.isPinned = filters.isPinned;
      if (filters.isArchived !== undefined) where.isArchived = filters.isArchived;
      if (filters.isDeleted !== undefined) where.isDeleted = filters.isDeleted;

      // Default to non-deleted, non-archived notes
      if (filters.isDeleted === undefined) {
        where.isDeleted = false;
      }
      if (filters.isArchived === undefined) {
        where.isArchived = false;
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.search) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            OR: [
              { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              { content: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            ],
          },
        ];
      }

      if (filters.createdAfter || filters.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
        if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
      }

      // Include for relations
      const include: Prisma.NoteInclude = {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      };

      if (includeShares) {
        include.shares = {
          take: 5, // Limit for performance
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        };
      }

      // Get total count
      const total = await prisma.note.count({ where });

      // Get notes
      const notes = await prisma.note.findMany({
        where,
        include,
        orderBy: [
          { isPinned: "desc" }, // Pinned notes first
          { [sortBy]: sortOrder },
        ],
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: notes as unknown as Note[],
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Failed to get notes:", error);
      throw error;
    }
  }

  /**
   * Update note with access control
   */
  async updateNote(id: string, userId: string, data: UpdateNoteInput): Promise<Note> {
    try {
      // Check if note exists and user has edit permissions
      const existingNote = await this.getNoteById(id, userId);
      if (!existingNote) {
        throw new Error("Note not found");
      }

      if (!this.canUserEditNote(existingNote, userId)) {
        throw new Error("Access denied to edit this note");
      }

      // Validate category if being updated
      if (data.categoryId && data.categoryId !== existingNote.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
          select: { id: true, isActive: true },
        });

        if (!category || !category.isActive) {
          throw new Error("Category not found or not active");
        }
      }

      // Validate shared users if being updated
      if (data.sharedWith) {
        const users = await prisma.user.findMany({
          where: {
            id: { in: data.sharedWith },
          },
          select: { id: true },
        });

        if (users.length !== data.sharedWith.length) {
          throw new Error("One or more shared users not found");
        }
      }

      const updatedNote = await prisma.note.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title }),
          ...(data.content && { content: data.content }),
          ...(data.type && { type: data.type }),
          ...(data.visibility && { visibility: data.visibility }),
          ...(data.sharedWith && { sharedWith: data.sharedWith }),
          ...(data.tags && { tags: data.tags }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.attachments && { attachments: data.attachments }),
          ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
          ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
          ...(data.allowComments !== undefined && { allowComments: data.allowComments }),
          ...(data.allowEditing !== undefined && { allowEditing: data.allowEditing }),
          lastEditedBy: userId,
          lastEditedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          family: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Update shared records if sharedWith changed
      if (data.sharedWith) {
        // Remove existing shares
        await prisma.noteShare.deleteMany({
          where: { noteId: id },
        });

        // Create new shares
        if (data.sharedWith.length > 0) {
          const shareRecords = data.sharedWith.map(sharedUserId => ({
            noteId: id,
            userId: sharedUserId,
            sharedBy: userId,
            canEdit: data.allowEditing || false,
            canComment: data.allowComments || false,
            canShare: false,
          }));

          await prisma.noteShare.createMany({
            data: shareRecords,
          });
        }
      }

      console.log("📝 Note updated:", {
        id: updatedNote.id,
        title: updatedNote.title,
        changes: Object.keys(data),
        updatedBy: userId,
      });

      return updatedNote as unknown as Note;
    } catch (error) {
      console.error("❌ Failed to update note:", error);
      throw error;
    }
  }

  /**
   * Soft delete note
   */
  async deleteNote(id: string, userId: string): Promise<void> {
    try {
      // Check if note exists and user has delete permissions
      const note = await this.getNoteById(id, userId);
      if (!note) {
        throw new Error("Note not found");
      }

      // Only creator can delete notes
      if (note.createdBy !== userId) {
        throw new Error("Only the note creator can delete this note");
      }

      await prisma.note.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log("📝 Note soft deleted:", { id, deletedBy: userId });
    } catch (error) {
      console.error("❌ Failed to delete note:", error);
      throw error;
    }
  }

  /**
   * Share note with user
   */
  async shareNote(data: ShareNoteInput): Promise<void> {
    try {
      // Check if note exists and user has share permissions
      const note = await this.getNoteById(data.noteId, data.sharedBy);
      if (!note) {
        throw new Error("Note not found");
      }

      if (!this.canUserShareNote(note, data.sharedBy)) {
        throw new Error("Access denied to share this note");
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true },
      });

      if (!targetUser) {
        throw new Error("Target user not found");
      }

      // Check if already shared
      const existingShare = await prisma.noteShare.findUnique({
        where: {
          noteId_userId: {
            noteId: data.noteId,
            userId: data.userId,
          },
        },
      });

      if (existingShare) {
        // Update existing share
        await prisma.noteShare.update({
          where: {
            noteId_userId: {
              noteId: data.noteId,
              userId: data.userId,
            },
          },
          data: {
            canEdit: data.canEdit || false,
            canComment: data.canComment || true,
            canShare: data.canShare || false,
            sharedBy: data.sharedBy,
            sharedAt: new Date(),
          },
        });
      } else {
        // Create new share
        await prisma.noteShare.create({
          data: {
            noteId: data.noteId,
            userId: data.userId,
            canEdit: data.canEdit || false,
            canComment: data.canComment || true,
            canShare: data.canShare || false,
            sharedBy: data.sharedBy,
          },
        });

        // Update note's sharedWith array
        await prisma.note.update({
          where: { id: data.noteId },
          data: {
            sharedWith: {
              push: data.userId,
            },
          },
        });
      }

      console.log("📝 Note shared:", {
        noteId: data.noteId,
        userId: data.userId,
        sharedBy: data.sharedBy,
        permissions: {
          canEdit: data.canEdit,
          canComment: data.canComment,
          canShare: data.canShare,
        },
      });
    } catch (error) {
      console.error("❌ Failed to share note:", error);
      throw error;
    }
  }

  /**
   * Unshare note from user
   */
  async unshareNote(noteId: string, userId: string, sharedBy: string): Promise<void> {
    try {
      // Check permissions
      const note = await this.getNoteById(noteId, sharedBy);
      if (!note) {
        throw new Error("Note not found");
      }

      if (!this.canUserShareNote(note, sharedBy)) {
        throw new Error("Access denied to unshare this note");
      }

      // Remove share record
      await prisma.noteShare.delete({
        where: {
          noteId_userId: {
            noteId,
            userId,
          },
        },
      });

      // Update note's sharedWith array
      const updatedSharedWith = note.sharedWith.filter(id => id !== userId);
      await prisma.note.update({
        where: { id: noteId },
        data: {
          sharedWith: updatedSharedWith,
        },
      });

      console.log("📝 Note unshared:", { noteId, userId, sharedBy });
    } catch (error) {
      console.error("❌ Failed to unshare note:", error);
      throw error;
    }
  }

  /**
   * Get shared notes for a user
   */
  async getSharedNotes(userId: string): Promise<Note[]> {
    try {
      const shares = await prisma.noteShare.findMany({
        where: { userId },
        include: {
          note: {
            include: {
              creator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              family: {
                select: {
                  id: true,
                  name: true,
                },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: { sharedAt: "desc" },
      });

      return shares.map(share => share.note) as unknown as Note[];
    } catch (error) {
      console.error("❌ Failed to get shared notes:", error);
      throw error;
    }
  }

  /**
   * Get note tags with usage counts for a user
   */
  async getNoteTags(userId: string, familyId?: string): Promise<Array<{ tag: string; count: number }>> {
    try {
      const where: Prisma.NoteWhereInput = {
        isDeleted: false,
        OR: [
          { createdBy: userId },
          { shares: { some: { userId } } },
        ],
      };

      if (familyId) {
        where.familyId = familyId;
      }

      const notes = await prisma.note.findMany({
        where,
        select: { tags: true },
      });

      // Count tag occurrences
      const tagCounts: Record<string, number> = {};
      notes.forEach((note) => {
        note.tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error("❌ Failed to get note tags:", error);
      throw error;
    }
  }

  /**
   * Check if user can access note
   */
  private canUserAccessNote(note: any, userId: string): boolean {
    // Creator can always access
    if (note.createdBy === userId) {
      return true;
    }

    // Check shared access
    if (note.sharedWith && note.sharedWith.includes(userId)) {
      return true;
    }

    // Check visibility permissions
    if (note.visibility === NoteVisibility.PUBLIC) {
      return true;
    }

    // Family visibility - would need user's familyId to check
    // This would be validated in the query level

    return false;
  }

  /**
   * Check if user can edit note
   */
  private canUserEditNote(note: any, userId: string): boolean {
    // Creator can always edit
    if (note.createdBy === userId) {
      return true;
    }

    // Check if note allows editing and user has edit permission
    if (note.allowEditing) {
      const userShare = note.shares?.find((share: any) => share.userId === userId);
      return userShare?.canEdit || false;
    }

    return false;
  }

  /**
   * Check if user can share note
   */
  private canUserShareNote(note: any, userId: string): boolean {
    // Creator can always share
    if (note.createdBy === userId) {
      return true;
    }

    // Check if user has share permission
    const userShare = note.shares?.find((share: any) => share.userId === userId);
    return userShare?.canShare || false;
  }

  /**
   * Increment view count
   */
  private async incrementViewCount(noteId: string): Promise<void> {
    try {
      await prisma.note.update({
        where: { id: noteId },
        data: {
          viewCount: { increment: 1 },
        },
      });
    } catch (error) {
      console.error("❌ Failed to increment view count:", error);
    }
  }
}