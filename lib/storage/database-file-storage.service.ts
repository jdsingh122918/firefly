import { prisma } from "@/lib/db/prisma";

export interface DatabaseFileUploadResult {
  success: boolean;
  documentId?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
  error?: string;
}

export interface DatabaseFileReadResult {
  success: boolean;
  buffer?: Buffer;
  mimeType?: string;
  fileName?: string;
  error?: string;
}

export class DatabaseFileStorageService {
  /**
   * Upload file directly to database
   */
  async uploadFile(
    file: File,
    options: {
      title: string;
      description?: string;
      category?: "images" | "documents" | "temp";
      userId: string;
      familyId?: string;
      tags?: string[];
      type?: string;
    },
  ): Promise<DatabaseFileUploadResult> {
    try {
      console.log("💾 Starting database file upload:", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        category: options.category,
        userId: options.userId,
      });

      // Validate file before upload
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        console.error("❌ Database file validation failed:", validation.error);
        return {
          success: false,
          error: validation.error,
        };
      }

      // Convert File to Buffer - store as base64 string for MongoDB compatibility
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const fileData = fileBuffer; // Prisma will handle the conversion to Bytes

      // Generate storage filename
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

      // Determine document type from file type
      const documentType = this.getDocumentTypeFromMimeType(file.type);

      // Validate required fields before creating document
      if (!options.title?.trim()) {
        return {
          success: false,
          error: "Document title is required",
        };
      }

      if (!options.userId?.trim()) {
        return {
          success: false,
          error: "User ID is required for document creation",
        };
      }

      console.log("💾 Document creation data:", {
        title: options.title,
        fileName: fileName,
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        documentType: documentType,
        userId: options.userId,
        familyId: options.familyId,
        tags: options.tags,
        isValidUserId: options.userId?.length > 0,
        isValidTitle: options.title?.trim().length > 0,
      });

      // Create document in database with binary data
      try {
        const document = await prisma.document.create({
          data: {
            title: options.title,
            description: options.description,
            fileName: fileName,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            fileData: fileData,
            filePath: `db/${fileName}`, // Virtual path for database storage
            type: documentType as any, // Cast to avoid TS enum issues
            status: "ACTIVE",
            uploadedBy: options.userId,
            familyId: options.familyId,
            tags: options.tags || [],
            isPublic: false,
          },
        });

        console.log("✅ Database file upload successful:", {
          documentId: document.id,
          fileName: fileName,
          originalName: file.name,
          size: file.size,
        });

        return {
          success: true,
          documentId: document.id,
          fileId: document.id,
          fileName: fileName,
          fileSize: file.size,
          mimeType: file.type,
          url: `/api/files/db/${document.id}`,
        };
      } catch (prismaError) {
        console.error("❌ Prisma document creation failed:", {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          documentType: documentType,
          userId: options.userId,
          familyId: options.familyId,
          prismaError: prismaError instanceof Error ? prismaError.message : prismaError,
          stack: prismaError instanceof Error ? prismaError.stack : undefined,
        });
        throw prismaError;
      }
    } catch (error) {
      console.error("❌ Database file upload error:", {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        userId: options.userId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Provide more specific error messages
      let errorMessage = "Unknown upload error";
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for common database errors
        if (errorMessage.includes('Required argument is missing')) {
          errorMessage = "Missing required field for document creation";
        } else if (errorMessage.includes('Invalid enum value')) {
          errorMessage = `Invalid document type. File type: ${file.type}`;
        } else if (errorMessage.includes('Document validation failed')) {
          errorMessage = "Document validation failed during database creation";
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Read file from database
   */
  async readFile(documentId: string): Promise<DatabaseFileReadResult> {
    try {
      console.log("💾 Reading file from database:", { documentId });

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          fileData: true,
          mimeType: true,
          fileName: true,
          originalFileName: true,
          status: true,
        },
      });

      if (!document) {
        return {
          success: false,
          error: "Document not found",
        };
      }

      if (document.status === "DELETED") {
        return {
          success: false,
          error: "Document has been deleted",
        };
      }

      if (!document.fileData) {
        return {
          success: false,
          error: "File data not available in database",
        };
      }

      // Debug logging to trace fileData type from Prisma
      console.log("📧 DEBUG fileData type:", {
        documentId,
        type: typeof document.fileData,
        constructor: document.fileData?.constructor?.name,
        isBuffer: Buffer.isBuffer(document.fileData),
        isUint8Array: document.fileData instanceof Uint8Array,
        length: document.fileData?.length,
      });

      console.log("✅ File read from database successfully:", {
        documentId,
        fileName: document.fileName,
        size: document.fileData.length,
      });

      // Convert fileData back to proper Buffer format
      // Handle all possible Prisma return types for Bytes field
      let buffer: Buffer;
      if (Buffer.isBuffer(document.fileData)) {
        buffer = document.fileData;
      } else if (document.fileData instanceof Uint8Array) {
        // Handle Uint8Array (common with some Prisma/MongoDB drivers)
        buffer = Buffer.from(document.fileData);
      } else if (typeof document.fileData === 'string') {
        // Handle base64 string (if Prisma returns encoded data)
        buffer = Buffer.from(document.fileData, 'base64');
      } else {
        // Fallback for other ArrayBuffer-like types
        buffer = Buffer.from(document.fileData as ArrayBuffer);
      }

      console.log("📧 DEBUG buffer conversion result:", {
        documentId,
        bufferLength: buffer.length,
        isValidBuffer: Buffer.isBuffer(buffer),
      });

      return {
        success: true,
        buffer: buffer,
        mimeType: document.mimeType || "application/octet-stream",
        fileName: document.originalFileName || document.fileName,
      };
    } catch (error) {
      console.error("❌ Database file read error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown read error",
      };
    }
  }

  /**
   * Delete file from database
   */
  async deleteFile(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("💾 Deleting file from database:", { documentId });

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "DELETED",
          updatedAt: new Date(),
        },
      });

      console.log("✅ File soft deleted from database:", documentId);

      return { success: true };
    } catch (error) {
      console.error("❌ Database file deletion error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown deletion error",
      };
    }
  }

  /**
   * Permanently delete file from database
   */
  async permanentlyDeleteFile(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("💾 Permanently deleting file from database:", { documentId });

      await prisma.document.delete({
        where: { id: documentId },
      });

      console.log("🗑️ File permanently deleted from database:", documentId);

      return { success: true };
    } catch (error) {
      console.error("❌ Database file permanent deletion error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown deletion error",
      };
    }
  }

  /**
   * Get file info from database
   */
  async getFileInfo(documentId: string): Promise<{
    success: boolean;
    size?: number;
    mimeType?: string;
    fileName?: string;
    exists?: boolean;
    error?: string;
  }> {
    try {
      console.log("💾 Getting file info from database:", { documentId });

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          fileSize: true,
          mimeType: true,
          fileName: true,
          originalFileName: true,
          status: true,
        },
      });

      if (!document) {
        return {
          success: true,
          exists: false,
        };
      }

      return {
        success: true,
        exists: true,
        size: document.fileSize || undefined,
        mimeType: document.mimeType || "application/octet-stream",
        fileName: document.originalFileName || document.fileName,
      };
    } catch (error) {
      console.error("❌ Database file info error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown info error",
      };
    }
  }

  /**
   * Get storage statistics from database
   */
  async getStorageStats(): Promise<{
    success: boolean;
    totalFiles?: number;
    totalSize?: number;
    averageSize?: number;
    typeStats?: Record<string, { count: number; size: number }>;
    error?: string;
  }> {
    try {
      console.log("💾 Getting database storage statistics");

      const documents = await prisma.document.findMany({
        where: {
          status: { not: "DELETED" },
          fileData: { not: null },
        },
        select: {
          fileSize: true,
          mimeType: true,
          type: true,
        },
      });

      const totalFiles = documents.length;
      const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
      const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;

      // Group by document type
      const typeStats: Record<string, { count: number; size: number }> = {};
      documents.forEach((doc) => {
        const type = doc.type || 'OTHER';
        if (!typeStats[type]) {
          typeStats[type] = { count: 0, size: 0 };
        }
        typeStats[type].count += 1;
        typeStats[type].size += doc.fileSize || 0;
      });

      console.log("✅ Database storage stats retrieved:", {
        totalFiles,
        totalSize,
        averageSize,
        typeCount: Object.keys(typeStats).length,
      });

      return {
        success: true,
        totalFiles,
        totalSize,
        averageSize,
        typeStats,
      };
    } catch (error) {
      console.error("❌ Database storage stats error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Stats failed",
      };
    }
  }

  /**
   * Determine document type from MIME type
   */
  private getDocumentTypeFromMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'PHOTO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType === 'application/pdf') return 'DOCUMENT';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'DOCUMENT';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'ARCHIVE';
    return 'OTHER';
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    const maxFileSize = 15 * 1024 * 1024; // 15MB (safe under MongoDB's 16MB limit)

    const allowedMimeTypes = [
      // Images
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain", "text/csv",
      // Archives
      "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
    ];

    // Check file size (15MB limit for database storage)
    if (file.size > maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds 15MB limit for database storage`,
      };
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File type '${file.type}' is not allowed`,
      };
    }

    // Check file name
    if (!file.name || file.name.length > 255) {
      return {
        isValid: false,
        error: "Invalid file name",
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const databaseFileStorageService = new DatabaseFileStorageService();