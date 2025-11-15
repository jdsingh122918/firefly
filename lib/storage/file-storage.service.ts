import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export interface FileUploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
  error?: string;
}

export interface StorageConfig {
  uploadDir: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  generateThumbnails: boolean;
  publicUrl: string;
}

export class FileStorageService {
  private config: StorageConfig;

  private isInitialized = false;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      uploadDir: process.env.UPLOAD_DIR || "./uploads",
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB
      allowedMimeTypes: [
        // Images
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        // Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
        // Archives
        "application/zip",
        "application/x-rar-compressed",
        "application/x-7z-compressed",
      ],
      generateThumbnails: true,
      publicUrl: process.env.PUBLIC_URL || "http://localhost:3000",
      ...config,
    };
  }

  private async initializeUploadDirectory(): Promise<void> {
    try {
      console.log("📁 Initializing upload directory:", this.config.uploadDir);

      if (!existsSync(this.config.uploadDir)) {
        console.log("📁 Creating main upload directory...");
        await mkdir(this.config.uploadDir, { recursive: true });
        console.log("✅ Created upload directory:", this.config.uploadDir);
      }

      // Create subdirectories for organization
      const subdirs = ["documents", "images", "temp"];
      for (const subdir of subdirs) {
        const subdirPath = path.join(this.config.uploadDir, subdir);
        if (!existsSync(subdirPath)) {
          console.log(`📁 Creating subdirectory: ${subdirPath}`);
          await mkdir(subdirPath, { recursive: true });
          console.log(`✅ Created subdirectory: ${subdirPath}`);
        } else {
          console.log(`✅ Subdirectory exists: ${subdirPath}`);
        }
      }

      console.log("✅ Upload directory initialization complete");
    } catch (error) {
      console.error("❌ Failed to initialize upload directory:", {
        uploadDir: this.config.uploadDir,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds limit of ${this.config.maxFileSize / 1024 / 1024}MB`,
      };
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.type)) {
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

  /**
   * Generate unique file name
   */
  private generateFileName(originalName: string): string {
    const extension = path.extname(originalName);
    const fileId = uuidv4();
    return `${fileId}${extension}`;
  }

  /**
   * Determine file category based on MIME type
   */
  private getFileCategory(mimeType: string): "images" | "documents" | "temp" {
    if (mimeType.startsWith("image/")) {
      return "images";
    }
    return "documents";
  }

  /**
   * Upload file to storage
   */
  async uploadFile(
    file: File,
    options?: {
      category?: "images" | "documents" | "temp";
      customFileName?: string;
      userId?: string;
    },
  ): Promise<FileUploadResult> {
    try {
      // Ensure upload directory is initialized
      if (!this.isInitialized) {
        await this.initializeUploadDirectory();
        this.isInitialized = true;
      }

      console.log("📁 Starting file upload:", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        category: options?.category,
        userId: options?.userId,
      });

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        console.error("❌ File validation failed:", validation.error);
        return {
          success: false,
          error: validation.error,
        };
      }

      // Generate file names and paths
      const category = options?.category || this.getFileCategory(file.type);
      const fileName =
        options?.customFileName || this.generateFileName(file.name);
      const filePath = path.join(this.config.uploadDir, category, fileName);
      const fileId = path.basename(fileName, path.extname(fileName));

      console.log("📁 File paths generated:", {
        category,
        fileName,
        filePath,
        fileId,
        uploadDir: this.config.uploadDir,
      });

      // Convert File to Buffer
      console.log("📁 Converting file to buffer...");
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log("✅ File converted to buffer, size:", buffer.length);

      // Ensure directory exists before writing file
      const fileDir = path.dirname(filePath);
      console.log("📁 Ensuring directory exists:", fileDir);
      if (!existsSync(fileDir)) {
        console.log("📁 Directory doesn't exist, creating:", fileDir);
        await mkdir(fileDir, { recursive: true });
        console.log("✅ Directory created:", fileDir);
      }

      // Write file to disk
      console.log("📁 Writing file to disk:", filePath);
      await writeFile(filePath, buffer);
      console.log("✅ File written to disk successfully");

      console.log("✅ File uploaded:", {
        fileId,
        fileName,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        category,
        filePath,
      });

      return {
        success: true,
        fileId,
        fileName,
        filePath,
        fileSize: file.size,
        mimeType: file.type,
        url: `${this.config.publicUrl}/api/files/${category}/${fileName}`,
      };
    } catch (error) {
      console.error("❌ File upload error:", {
        fileName: file.name,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        uploadDir: this.config.uploadDir,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown upload error",
      };
    }
  }

  /**
   * Read file from storage
   */
  async readFile(
    category: string,
    fileName: string,
  ): Promise<{
    success: boolean;
    buffer?: Buffer;
    mimeType?: string;
    error?: string;
  }> {
    try {
      const filePath = path.join(this.config.uploadDir, category, fileName);

      if (!existsSync(filePath)) {
        return {
          success: false,
          error: "File not found",
        };
      }

      const buffer = await readFile(filePath);
      const extension = path.extname(fileName).toLowerCase();

      // Determine MIME type from extension
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".txt": "text/plain",
        ".csv": "text/csv",
        ".zip": "application/zip",
      };

      const mimeType = mimeTypes[extension] || "application/octet-stream";

      return {
        success: true,
        buffer,
        mimeType,
      };
    } catch (error) {
      console.error("❌ File read error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown read error",
      };
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(
    category: string,
    fileName: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const filePath = path.join(this.config.uploadDir, category, fileName);

      if (!existsSync(filePath)) {
        return {
          success: false,
          error: "File not found",
        };
      }

      await unlink(filePath);

      console.log("🗑️ File deleted:", filePath);

      return {
        success: true,
      };
    } catch (error) {
      console.error("❌ File deletion error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown deletion error",
      };
    }
  }

  /**
   * Get file info without reading content
   */
  async getFileInfo(
    category: string,
    fileName: string,
  ): Promise<{
    success: boolean;
    size?: number;
    mimeType?: string;
    exists?: boolean;
    error?: string;
  }> {
    try {
      const filePath = path.join(this.config.uploadDir, category, fileName);

      if (!existsSync(filePath)) {
        return {
          success: true,
          exists: false,
        };
      }

      const { stat } = await import("fs/promises");
      const stats = await stat(filePath);
      const extension = path.extname(fileName).toLowerCase();

      // Determine MIME type from extension (reuse from readFile)
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
        ".csv": "text/csv",
      };

      const mimeType = mimeTypes[extension] || "application/octet-stream";

      return {
        success: true,
        exists: true,
        size: stats.size,
        mimeType,
      };
    } catch (error) {
      console.error("❌ File info error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown info error",
      };
    }
  }

  /**
   * Clean up temp files older than specified time
   */
  async cleanupTempFiles(olderThanHours: number = 24): Promise<{
    success: boolean;
    deletedCount?: number;
    error?: string;
  }> {
    try {
      const { readdir, stat } = await import("fs/promises");
      const tempDir = path.join(this.config.uploadDir, "temp");

      if (!existsSync(tempDir)) {
        return { success: true, deletedCount: 0 };
      }

      const files = await readdir(tempDir);
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          await unlink(filePath);
          deletedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${deletedCount} temp files`);

      return {
        success: true,
        deletedCount,
      };
    } catch (error) {
      console.error("❌ Temp file cleanup error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    success: boolean;
    totalFiles?: number;
    totalSize?: number;
    categoryStats?: Record<string, { count: number; size: number }>;
    error?: string;
  }> {
    try {
      const { readdir, stat } = await import("fs/promises");
      const categories = ["documents", "images", "temp"];

      let totalFiles = 0;
      let totalSize = 0;
      const categoryStats: Record<string, { count: number; size: number }> = {};

      for (const category of categories) {
        const categoryDir = path.join(this.config.uploadDir, category);

        if (!existsSync(categoryDir)) {
          categoryStats[category] = { count: 0, size: 0 };
          continue;
        }

        const files = await readdir(categoryDir);
        let categorySize = 0;

        for (const file of files) {
          const filePath = path.join(categoryDir, file);
          const stats = await stat(filePath);
          categorySize += stats.size;
        }

        categoryStats[category] = {
          count: files.length,
          size: categorySize,
        };

        totalFiles += files.length;
        totalSize += categorySize;
      }

      return {
        success: true,
        totalFiles,
        totalSize,
        categoryStats,
      };
    } catch (error) {
      console.error("❌ Storage stats error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Stats failed",
      };
    }
  }
}

// Export singleton instance
export const fileStorageService = new FileStorageService();
