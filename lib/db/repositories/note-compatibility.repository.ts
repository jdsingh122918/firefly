import { ContentRepository, ContentFilters, CreateContentInput, UpdateContentInput, AssignmentInput } from './content.repository';
import { PrismaClient, ContentType, NoteType, NoteVisibility, UserRole, AssignmentStatus } from '@prisma/client';

/**
 * Backward Compatibility Layer for Note Repository
 *
 * This facade provides the existing NoteRepository interface while
 * delegating to the unified ContentRepository underneath.
 *
 * This allows existing code to continue working during the migration
 * without requiring immediate changes to all API endpoints and services.
 */

export interface NoteFilters {
  createdBy?: string;
  familyId?: string;
  type?: NoteType[];
  visibility?: NoteVisibility[];
  categoryId?: string;
  tags?: string[];
  search?: string;
  hasAssignments?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateNoteInput {
  title: string;
  content: string;
  type?: NoteType;
  visibility?: NoteVisibility;
  familyId?: string;
  categoryId?: string;
  tags?: string[];
  isPinned?: boolean;
  allowComments?: boolean;
  allowEditing?: boolean;
}

export interface UpdateNoteInput extends Partial<CreateNoteInput> {
  lastEditedBy?: string;
}

class NoteCompatibilityRepository {
  private contentRepository: ContentRepository;

  constructor(private prisma: PrismaClient) {
    this.contentRepository = new ContentRepository(prisma);
  }

  /**
   * Create a new note (maps to Content with NOTE type)
   */
  async create(data: CreateNoteInput, userId: string, userRole: UserRole) {
    const contentData: CreateContentInput = {
      title: data.title,
      body: data.content, // Map 'content' field to 'body'
      contentType: ContentType.NOTE,
      noteType: data.type || NoteType.TEXT,
      visibility: data.visibility,
      familyId: data.familyId,
      categoryId: data.categoryId,
      tags: data.tags,
      isPinned: data.isPinned,
      allowComments: data.allowComments,
      allowEditing: data.allowEditing,
      hasAssignments: false, // Notes start without assignments
      hasSharing: false
    };

    const content = await this.contentRepository.create(contentData, userId, userRole);

    // Transform back to note-like structure for compatibility
    return this.transformContentToNote(content);
  }

  /**
   * Find note by ID
   */
  async findById(id: string, userId: string, userRole: UserRole) {
    const content = await this.contentRepository.findById(id, userId, userRole, {
      includeDocuments: true,
      includeShares: true,
      includeAssignments: true,
      includeStructuredTags: true,
      includeCreator: true,
      includeFamily: true,
      includeCategory: true
    });

    if (!content || content.contentType !== ContentType.NOTE) {
      return null;
    }

    return this.transformContentToNote(content);
  }

  /**
   * Filter notes
   */
  async filter(filters: NoteFilters, userId: string, userRole: UserRole) {
    const contentFilters: ContentFilters = {
      contentType: [ContentType.NOTE], // Only NOTE content
      noteType: filters.type,
      createdBy: filters.createdBy,
      familyId: filters.familyId,
      visibility: filters.visibility,
      categoryId: filters.categoryId,
      tags: filters.tags,
      search: filters.search,
      hasAssignments: filters.hasAssignments,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    };

    // Add note-specific filters
    if (filters.isPinned !== undefined) {
      // Add custom where clause for isPinned
      contentFilters.search = contentFilters.search || '';
    }

    if (filters.isArchived !== undefined) {
      // Add custom where clause for isArchived
      contentFilters.search = contentFilters.search || '';
    }

    const result = await this.contentRepository.filter(contentFilters, userId, userRole, {
      includeCreator: true,
      includeFamily: true,
      includeCategory: true
    });

    return {
      ...result,
      content: result.content.map(content => this.transformContentToNote(content))
    };
  }

  /**
   * Update note
   */
  async update(id: string, data: UpdateNoteInput, userId: string, userRole: UserRole) {
    const updateData: UpdateContentInput = {
      title: data.title,
      body: data.content, // Map 'content' field to 'body'
      noteType: data.type,
      visibility: data.visibility,
      familyId: data.familyId,
      categoryId: data.categoryId,
      tags: data.tags,
      isPinned: data.isPinned,
      allowComments: data.allowComments,
      allowEditing: data.allowEditing,
      lastEditedBy: data.lastEditedBy
    };

    const content = await this.contentRepository.update(id, updateData, userId, userRole);
    return this.transformContentToNote(content);
  }

  /**
   * Delete note
   */
  async delete(id: string, userId: string, userRole: UserRole) {
    return await this.contentRepository.delete(id, userId, userRole);
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id: string) {
    return await this.contentRepository.incrementViewCount(id);
  }

  // ========================================
  // ASSIGNMENT METHODS (unchanged interface)
  // ========================================

  /**
   * Create assignment for note
   */
  async createAssignment(
    noteId: string,
    assignmentData: AssignmentInput,
    assignerId: string,
    assignerRole: UserRole
  ) {
    return await this.contentRepository.createAssignment(
      noteId,
      assignmentData,
      assignerId,
      assignerRole
    );
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(
    assignmentId: string,
    status: AssignmentStatus,
    userId: string,
    completionNotes?: string
  ) {
    return await this.contentRepository.updateAssignmentStatus(
      assignmentId,
      status,
      userId,
      completionNotes
    );
  }

  /**
   * Get assignments for user
   */
  async getAssignedTasks(userId: string, status?: AssignmentStatus[]) {
    return await this.contentRepository.getAssignedTasks(userId, status);
  }

  // ========================================
  // DOCUMENT METHODS (unchanged interface)
  // ========================================

  /**
   * Attach document to note
   */
  async attachDocument(
    noteId: string,
    documentId: string,
    attachedBy: string,
    order: number = 0
  ) {
    return await this.contentRepository.attachDocument(
      noteId,
      documentId,
      attachedBy,
      order,
      false // Notes don't have "main" documents like resources
    );
  }

  /**
   * Detach document from note
   */
  async detachDocument(
    noteId: string,
    documentId: string,
    userId: string,
    userRole: UserRole
  ) {
    return await this.contentRepository.detachDocument(
      noteId,
      documentId,
      userId,
      userRole
    );
  }

  // ========================================
  // SHARING METHODS (unchanged interface)
  // ========================================

  /**
   * Share note with user
   */
  async shareNote(
    noteId: string,
    sharedBy: string,
    userId: string,
    permissions: {
      canEdit?: boolean;
      canComment?: boolean;
      canShare?: boolean;
    } = {}
  ) {
    return await this.contentRepository.shareContent(
      noteId,
      sharedBy,
      userId,
      permissions
    );
  }

  // ========================================
  // PRIVATE TRANSFORMATION METHODS
  // ========================================

  /**
   * Transform Content model back to Note-like structure for compatibility
   */
  private transformContentToNote(content: any) {
    return {
      id: content.id,
      title: content.title,
      content: content.body, // Map 'body' back to 'content'
      type: content.noteType,
      visibility: content.visibility,

      // Ownership and access
      createdBy: content.createdBy,
      familyId: content.familyId,
      sharedWith: content.sharedWith || [],

      // Content organization
      tags: content.tags || [],
      categoryId: content.categoryId,
      attachments: content.attachments || [], // Legacy field

      // Note metadata
      isPinned: content.isPinned || false,
      isArchived: content.isArchived || false,
      isDeleted: content.isDeleted || false,
      deletedAt: content.deletedAt,

      // Collaboration features
      allowComments: content.allowComments || false,
      allowEditing: content.allowEditing || false,

      // Activity tracking
      lastEditedBy: content.lastEditedBy,
      lastEditedAt: content.lastEditedAt,
      viewCount: content.viewCount || 0,

      // Timestamps
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,

      // Relations (passed through)
      creator: content.creator,
      family: content.family,
      category: content.category,
      documents: content.documents,
      shares: content.shares,
      assignments: content.assignments,
      structuredTags: content.structuredTags,

      // Additional computed fields for compatibility
      hasAssignments: content.hasAssignments || false
    };
  }
}

export { NoteCompatibilityRepository };