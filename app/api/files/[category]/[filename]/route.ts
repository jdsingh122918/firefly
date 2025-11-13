import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { fileStorageService } from "@/lib/storage/file-storage.service";

const userRepository = new UserRepository();

// GET /api/files/[category]/[filename] - Serve/download files
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string; filename: string }> },
) {
  try {
    const { userId } = await auth();

    // For now, allow public access to files
    // Later you may want to implement access control based on file metadata

    const { category, filename } = await params;

    console.log("📁 GET /api/files/[category]/[filename] - Serving file:", {
      category,
      filename,
      userId: userId || "anonymous",
    });

    // Validate category
    const validCategories = ["images", "documents", "temp"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid file category" },
        { status: 400 },
      );
    }

    // Validate filename (basic security check)
    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Read file from storage
    const fileResult = await fileStorageService.readFile(category, filename);

    if (!fileResult.success) {
      console.error("❌ File read failed:", fileResult.error);
      return NextResponse.json(
        { error: fileResult.error || "File not found" },
        { status: 404 },
      );
    }

    if (!fileResult.buffer || !fileResult.mimeType) {
      return NextResponse.json(
        { error: "File content not available" },
        { status: 404 },
      );
    }

    // Get query parameters for download behavior
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";
    const inline = searchParams.get("inline") === "true";

    // Prepare headers
    const headers = new Headers();
    headers.set("Content-Type", fileResult.mimeType);
    headers.set("Content-Length", fileResult.buffer.length.toString());

    if (download) {
      // Force download
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    } else if (inline || fileResult.mimeType.startsWith("image/")) {
      // Display inline (especially for images)
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
    } else {
      // Default behavior for documents - let browser decide
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    }

    // Cache headers for static assets
    if (fileResult.mimeType.startsWith("image/")) {
      headers.set("Cache-Control", "public, max-age=86400"); // 24 hours
    } else {
      headers.set("Cache-Control", "private, no-cache");
    }

    // Security headers
    headers.set("X-Content-Type-Options", "nosniff");
    if (fileResult.mimeType.startsWith("image/")) {
      headers.set("X-Frame-Options", "SAMEORIGIN");
    }

    console.log("✅ File served:", {
      category,
      filename,
      mimeType: fileResult.mimeType,
      size: fileResult.buffer.length,
      download,
      inline,
    });

    return new Response(new Uint8Array(fileResult.buffer), { headers });
  } catch (error) {
    console.error("❌ GET /api/files/[category]/[filename] error:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 },
    );
  }
}

// DELETE /api/files/[category]/[filename] - Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ category: string; filename: string }> },
) {
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

    const { category, filename } = await params;

    console.log("📁 DELETE /api/files/[category]/[filename] - User:", {
      role: user.role,
      email: user.email,
      category,
      filename,
    });

    // Validate category
    const validCategories = ["images", "documents", "temp"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid file category" },
        { status: 400 },
      );
    }

    // Validate filename
    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // TODO: Add access control - verify user owns this file or has admin privileges
    // For now, only admins can delete files
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied: Only administrators can delete files" },
        { status: 403 },
      );
    }

    // Delete file from storage
    const deleteResult = await fileStorageService.deleteFile(
      category,
      filename,
    );

    if (!deleteResult.success) {
      console.error("❌ File deletion failed:", deleteResult.error);
      return NextResponse.json(
        { error: deleteResult.error || "Failed to delete file" },
        { status: 404 },
      );
    }

    console.log("✅ File deleted:", { category, filename });

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE /api/files/[category]/[filename] error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}

// HEAD /api/files/[category]/[filename] - Get file info without content
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ category: string; filename: string }> },
) {
  try {
    const { category, filename } = await params;

    console.log("📁 HEAD /api/files/[category]/[filename] - File info:", {
      category,
      filename,
    });

    // Validate category
    const validCategories = ["images", "documents", "temp"];
    if (!validCategories.includes(category)) {
      return new Response(null, { status: 400 });
    }

    // Validate filename
    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return new Response(null, { status: 400 });
    }

    // Get file info
    const fileInfo = await fileStorageService.getFileInfo(category, filename);

    if (!fileInfo.success || !fileInfo.exists) {
      return new Response(null, { status: 404 });
    }

    // Prepare headers with file info
    const headers = new Headers();
    if (fileInfo.mimeType) {
      headers.set("Content-Type", fileInfo.mimeType);
    }
    if (fileInfo.size !== undefined) {
      headers.set("Content-Length", fileInfo.size.toString());
    }

    return new Response(null, { headers });
  } catch (error) {
    console.error("❌ HEAD /api/files/[category]/[filename] error:", error);
    return new Response(null, { status: 500 });
  }
}
