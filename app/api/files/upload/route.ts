import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { fileStorageService } from "@/lib/storage/file-storage.service";

const userRepository = new UserRepository();

// POST /api/files/upload - Upload files
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("📁 POST /api/files/upload - User:", {
      role: user.role,
      email: user.email,
    });

    // Get form data
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const category = (formData.get("category") as string) || "documents";
    const description = formData.get("description") as string;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    console.log("📁 Uploading files:", {
      count: files.length,
      category,
      description,
    });

    const results = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      if (!file || file.size === 0) {
        errors.push(`Invalid file: ${file?.name || "unknown"}`);
        continue;
      }

      try {
        const uploadResult = await fileStorageService.uploadFile(file, {
          category: category as "images" | "documents" | "temp",
          userId: user.id,
        });

        if (uploadResult.success) {
          results.push({
            fileId: uploadResult.fileId,
            fileName: uploadResult.fileName,
            originalName: file.name,
            size: uploadResult.fileSize,
            mimeType: uploadResult.mimeType,
            url: uploadResult.url,
            category,
          });

          console.log("✅ File uploaded successfully:", {
            fileId: uploadResult.fileId,
            fileName: uploadResult.fileName,
            originalName: file.name,
          });
        } else {
          errors.push(`Failed to upload ${file.name}: ${uploadResult.error}`);
          console.error("❌ File upload failed:", {
            fileName: file.name,
            error: uploadResult.error,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to upload ${file.name}: ${errorMessage}`);
        console.error("❌ File upload error:", {
          fileName: file.name,
          error: errorMessage,
        });
      }
    }

    // Determine response based on results
    if (results.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No files were uploaded successfully",
          errors,
        },
        { status: 400 },
      );
    }

    const response = {
      success: true,
      message: `Successfully uploaded ${results.length} of ${files.length} files`,
      files: results,
      ...(errors.length > 0 && { errors }),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("❌ POST /api/files/upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 },
    );
  }
}

// GET /api/files/upload - Get upload configuration and limits
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("📁 GET /api/files/upload - Get upload config");

    const config = {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB
      maxFileSizeMB:
        parseInt(process.env.MAX_FILE_SIZE || "10485760") / 1024 / 1024,
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
      categories: ["images", "documents", "temp"],
      supportedExtensions: [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".csv",
        ".zip",
        ".rar",
        ".7z",
      ],
    };

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("❌ GET /api/files/upload error:", error);
    return NextResponse.json(
      { error: "Failed to get upload configuration" },
      { status: 500 },
    );
  }
}
