import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentType,
  DocumentStatus,
  PaginatedResult,
} from "@/lib/types";
import { fileStorageService } from "@/lib/storage/file-storage.service";

export class DocumentRepository {
  /**
   * Create a new document
   */
  async createDocument(data: CreateDocumentInput): Promise<Document> {
    try {
      // Validate required fields
      if (!data.title || !data.filePath || !data.uploadedBy) {
        throw new Error(
          "Missing required fields: title, filePath, and uploadedBy are required",
        );
      }

      // Validate file exists if filePath is provided
      if (data.filePath) {
        const [category, fileName] = data.filePath.split("/");
        const fileInfo = await fileStorageService.getFileInfo(
          category,
          fileName,
        );

        if (!fileInfo.success || !fileInfo.exists) {
          throw new Error(`File does not exist: ${data.filePath}`);
        }

        // Update document with file info if not provided
        if (!data.fileSize && fileInfo.size) {
          data.fileSize = fileInfo.size;
        }
        if (!data.mimeType && fileInfo.mimeType) {
          data.mimeType = fileInfo.mimeType;
        }
      }

      const document = await prisma.document.create({
        data: {
          title: data.title,
          description: data.description,
          filePath: data.filePath,
          fileName: data.fileName,
          originalFileName: data.originalFileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          type: data.type || DocumentType.OTHER,
          status: data.status || DocumentStatus.ACTIVE,
          uploadedBy: data.uploadedBy,
          familyId: data.familyId,
          tags: data.tags || [],
          metadata: (data.metadata || {}) as Prisma.InputJsonValue,
          isPublic: data.isPublic || false,
          expiresAt: data.expiresAt,
        },
        include: {
          uploadedByUser: {
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
        },
      });

      console.log("📄 Document created:", {
        id: document.id,
        title: document.title,
        type: document.type,
        uploadedBy: document.uploadedBy,
      });

      return document as Document;
    } catch (error) {
      console.error("❌ Failed to create document:", error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(
    id: string,
    options: {
      includeDeleted?: boolean;
      includeFileData?: boolean;
    } = {},
  ): Promise<Document | null> {
    try {
      const whereClause: { id: string; status?: { not: DocumentStatus } } = { id };

      if (!options.includeDeleted) {
        whereClause.status = { not: DocumentStatus.DELETED };
      }

      // Build query options - use either include OR select, not both
      // Prisma doesn't allow both at the same time
      let queryOptions: any = {
        where: whereClause,
      };

      // Exclude fileData by default for performance, unless specifically requested
      if (!options.includeFileData) {
        // Use select to exclude fileData (can't use include with select)
        queryOptions.select = {
          id: true,
          title: true,
          description: true,
          filePath: true,
          fileName: true,
          originalFileName: true,
          fileSize: true,
          mimeType: true,
          type: true,
          status: true,
          uploadedBy: true,
          familyId: true,
          tags: true,
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
          // Include relations
          uploadedByUser: {
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
        };
      } else {
        // When including fileData, use include for relations
        queryOptions.include = {
          uploadedByUser: {
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
        };
      }

      const document = await prisma.document.findUnique(queryOptions);

      return document as Document | null;
    } catch (error) {
      console.error("❌ Failed to get document by ID:", error);
      throw error;
    }
  }

  /**
   * Get documents with filtering and pagination
   */
  async getDocuments(
    filters: {
      familyId?: string;
      uploadedBy?: string;
      type?: DocumentType;
      status?: DocumentStatus;
      isPublic?: boolean;
      tags?: string[];
      search?: string;
      mimeType?: string;
      createdAfter?: Date;
      createdBefore?: Date;
    } = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: "createdAt" | "updatedAt" | "title" | "fileSize";
      sortOrder?: "asc" | "desc";
      includeDeleted?: boolean;
    } = {},
  ): Promise<PaginatedResult<Document>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
        includeDeleted = false,
      } = options;

      // Build where clause
      const where: Prisma.DocumentWhereInput = {};

      if (filters.familyId) where.familyId = filters.familyId;
      if (filters.uploadedBy) where.uploadedBy = filters.uploadedBy;
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.isPublic !== undefined) where.isPublic = filters.isPublic;
      if (filters.mimeType) where.mimeType = { contains: filters.mimeType };

      if (!includeDeleted) {
        where.status = { not: DocumentStatus.DELETED };
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          {
            originalFileName: { contains: filters.search, mode: Prisma.QueryMode.insensitive },
          },
        ];
      }

      if (filters.createdAfter || filters.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
        if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
      }

      // Get total count
      const total = await prisma.document.count({ where });

      // Get documents
      const documents = await prisma.document.findMany({
        where,
        include: {
          uploadedByUser: {
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
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: documents as Document[],
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error("❌ Failed to get documents:", error);
      throw error;
    }
  }

  /**
   * Update document
   */
  async updateDocument(
    id: string,
    data: UpdateDocumentInput,
  ): Promise<Document> {
    try {
      // Check if document exists
      const existingDocument = await this.getDocumentById(id);
      if (!existingDocument) {
        throw new Error("Document not found");
      }

      // Validate new file path if provided
      if (data.filePath && data.filePath !== existingDocument.filePath) {
        const [category, fileName] = data.filePath.split("/");
        const fileInfo = await fileStorageService.getFileInfo(
          category,
          fileName,
        );

        if (!fileInfo.success || !fileInfo.exists) {
          throw new Error(`File does not exist: ${data.filePath}`);
        }
      }

      const updatedDocument = await prisma.document.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.filePath && { filePath: data.filePath }),
          ...(data.fileName && { fileName: data.fileName }),
          ...(data.type && { type: data.type }),
          ...(data.status && { status: data.status }),
          ...(data.tags && { tags: data.tags }),
          ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonValue }),
          ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
          ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
          updatedAt: new Date(),
        },
        include: {
          uploadedByUser: {
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
        },
      });

      console.log("📄 Document updated:", {
        id: updatedDocument.id,
        title: updatedDocument.title,
        changes: Object.keys(data),
      });

      return updatedDocument as Document;
    } catch (error) {
      console.error("❌ Failed to update document:", error);
      throw error;
    }
  }

  /**
   * Soft delete document
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      await prisma.document.update({
        where: { id },
        data: {
          status: DocumentStatus.DELETED,
          updatedAt: new Date(),
        },
      });

      console.log("📄 Document soft deleted:", id);
    } catch (error) {
      console.error("❌ Failed to delete document:", error);
      throw error;
    }
  }

  /**
   * Permanently delete document and its file
   */
  async permanentlyDeleteDocument(id: string): Promise<void> {
    try {
      // Get document to find file path
      const document = await this.getDocumentById(id, { includeDeleted: true });
      if (!document) {
        throw new Error("Document not found");
      }

      // Delete file from storage if it exists
      if (document.filePath) {
        try {
          const [category, fileName] = document.filePath.split("/");
          await fileStorageService.deleteFile(category, fileName);
          console.log("🗑️ Document file deleted:", document.filePath);
        } catch (error) {
          console.warn("⚠️ Failed to delete document file:", error);
          // Continue with database deletion even if file deletion fails
        }
      }

      // Delete from database
      await prisma.document.delete({
        where: { id },
      });

      console.log("🗑️ Document permanently deleted:", id);
    } catch (error) {
      console.error("❌ Failed to permanently delete document:", error);
      throw error;
    }
  }

  /**
   * Get documents by family
   */
  async getDocumentsByFamily(
    familyId: string,
    options: {
      type?: DocumentType;
      status?: DocumentStatus;
      page?: number;
      limit?: number;
      includePublic?: boolean;
    } = {},
  ): Promise<PaginatedResult<Document>> {
    try {
      const filters: {
        familyId?: string;
        type?: DocumentType;
        status?: DocumentStatus;
        OR?: Array<{ familyId: string } | { isPublic: boolean }>;
      } = { familyId };

      if (options.type) filters.type = options.type;
      if (options.status) filters.status = options.status;

      if (options.includePublic) {
        // Include both family documents and public documents
        delete filters.familyId;
        filters.OR = [{ familyId }, { isPublic: true }];
      }

      return await this.getDocuments(filters, {
        page: options.page,
        limit: options.limit,
      });
    } catch (error) {
      console.error("❌ Failed to get family documents:", error);
      throw error;
    }
  }

  /**
   * Get documents by user
   */
  async getDocumentsByUser(
    userId: string,
    options: {
      type?: DocumentType;
      status?: DocumentStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<PaginatedResult<Document>> {
    try {
      const filters: {
        uploadedBy: string;
        type?: DocumentType;
        status?: DocumentStatus;
      } = { uploadedBy: userId };

      if (options.type) filters.type = options.type;
      if (options.status) filters.status = options.status;

      return await this.getDocuments(filters, {
        page: options.page,
        limit: options.limit,
      });
    } catch (error) {
      console.error("❌ Failed to get user documents:", error);
      throw error;
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(
    query: string,
    filters: {
      familyId?: string;
      type?: DocumentType;
      tags?: string[];
    } = {},
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<PaginatedResult<Document>> {
    try {
      return await this.getDocuments(
        {
          ...filters,
          search: query,
        },
        options,
      );
    } catch (error) {
      console.error("❌ Failed to search documents:", error);
      throw error;
    }
  }

  /**
   * Get document tags with usage counts
   */
  async getDocumentTags(
    familyId?: string,
  ): Promise<Array<{ tag: string; count: number }>> {
    try {
      const where: {
        status: { not: DocumentStatus };
        familyId?: string;
      } = {
        status: { not: DocumentStatus.DELETED },
      };

      if (familyId) {
        where.familyId = familyId;
      }

      // This is a complex query - we'll need to do it in multiple steps
      // since Prisma doesn't have great support for array aggregation
      const documents = await prisma.document.findMany({
        where,
        select: { tags: true },
      });

      // Count tag occurrences
      const tagCounts: Record<string, number> = {};
      documents.forEach((doc) => {
        doc.tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error("❌ Failed to get document tags:", error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(familyId?: string): Promise<{
    totalDocuments: number;
    totalSize: number;
    documentsByType: Record<DocumentType, number>;
    documentsByStatus: Record<DocumentStatus, number>;
    averageFileSize: number;
  }> {
    try {
      const where: { familyId?: string } = {};
      if (familyId) where.familyId = familyId;

      const documents = await prisma.document.findMany({
        where,
        select: {
          type: true,
          status: true,
          fileSize: true,
        },
      });

      const stats = {
        totalDocuments: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0),
        documentsByType: {} as Record<DocumentType, number>,
        documentsByStatus: {} as Record<DocumentStatus, number>,
        averageFileSize: 0,
      };

      // Initialize counters
      Object.values(DocumentType).forEach((type) => {
        stats.documentsByType[type] = 0;
      });
      Object.values(DocumentStatus).forEach((status) => {
        stats.documentsByStatus[status] = 0;
      });

      // Count documents
      documents.forEach((doc) => {
        const docType = doc.type as keyof typeof stats.documentsByType;
        const docStatus = doc.status as keyof typeof stats.documentsByStatus;

        if (docType && stats.documentsByType[docType] !== undefined) {
          stats.documentsByType[docType]++;
        }
        if (docStatus && stats.documentsByStatus[docStatus] !== undefined) {
          stats.documentsByStatus[docStatus]++;
        }
      });

      // Calculate average
      stats.averageFileSize =
        documents.length > 0 ? stats.totalSize / documents.length : 0;

      return stats;
    } catch (error) {
      console.error("❌ Failed to get document statistics:", error);
      throw error;
    }
  }

  /**
   * Clean up expired documents
   */
  async cleanupExpiredDocuments(): Promise<number> {
    try {
      const expiredDocuments = await prisma.document.findMany({
        where: {
          expiresAt: { lt: new Date() },
          status: { not: DocumentStatus.DELETED },
        },
        select: { id: true, filePath: true },
      });

      let deletedCount = 0;

      for (const doc of expiredDocuments) {
        try {
          await this.permanentlyDeleteDocument(doc.id);
          deletedCount++;
        } catch (error) {
          console.error(
            `❌ Failed to delete expired document ${doc.id}:`,
            error,
          );
        }
      }

      console.log(`🧹 Cleaned up ${deletedCount} expired documents`);

      return deletedCount;
    } catch (error) {
      console.error("❌ Failed to cleanup expired documents:", error);
      throw error;
    }
  }
}
