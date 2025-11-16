import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { databaseFileStorageService } from "@/lib/storage/database-file-storage.service";

// GET /api/files/db/[documentId] - Serve files from database
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { userId } = await auth();
    const { documentId } = await params;

    // For now, allow public access to files
    // Later you may want to implement access control based on document metadata

    console.log("💾 GET /api/files/db/[documentId] - Serving file from database:", {
      documentId,
      userId: userId || "anonymous",
    });

    // Validate documentId
    if (!documentId || documentId.length !== 24) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 },
      );
    }

    // Read file from database
    const fileResult = await databaseFileStorageService.readFile(documentId);

    if (!fileResult.success) {
      console.error("❌ Database file read failed:", fileResult.error);
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

    const fileName = fileResult.fileName || `file-${documentId}`;

    if (download) {
      // Force download
      headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    } else if (inline || fileResult.mimeType.startsWith("image/")) {
      // Display inline (especially for images)
      headers.set("Content-Disposition", `inline; filename="${fileName}"`);
    } else {
      // Default behavior for documents - let browser decide
      headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
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

    console.log("✅ Database file served:", {
      documentId,
      fileName,
      mimeType: fileResult.mimeType,
      size: fileResult.buffer.length,
      download,
      inline,
    });

    return new Response(new Uint8Array(fileResult.buffer), { headers });
  } catch (error) {
    console.error("❌ GET /api/files/db/[documentId] error:", error);
    return NextResponse.json(
      { error: "Failed to serve file from database" },
      { status: 500 },
    );
  }
}

// DELETE /api/files/db/[documentId] - Delete file from database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;

    console.log("💾 DELETE /api/files/db/[documentId] - User:", {
      userId,
      documentId,
    });

    // Validate documentId
    if (!documentId || documentId.length !== 24) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 },
      );
    }

    // TODO: Add access control - verify user owns this file or has admin privileges
    // For now, allow any authenticated user to delete

    // Delete file from database
    const deleteResult = await databaseFileStorageService.deleteFile(documentId);

    if (!deleteResult.success) {
      console.error("❌ Database file deletion failed:", deleteResult.error);
      return NextResponse.json(
        { error: deleteResult.error || "Failed to delete file" },
        { status: 404 },
      );
    }

    console.log("✅ Database file deleted:", { documentId });

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE /api/files/db/[documentId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete file from database" },
      { status: 500 },
    );
  }
}

// HEAD /api/files/db/[documentId] - Get file info from database without content
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;

    console.log("💾 HEAD /api/files/db/[documentId] - File info:", {
      documentId,
    });

    // Validate documentId
    if (!documentId || documentId.length !== 24) {
      return new Response(null, { status: 400 });
    }

    // Get file info from database
    const fileInfo = await databaseFileStorageService.getFileInfo(documentId);

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
    console.error("❌ HEAD /api/files/db/[documentId] error:", error);
    return new Response(null, { status: 500 });
  }
}