import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createResponse } from "@/lib/utils/api-response";
import { DocumentRepository } from "@/lib/db/repositories/document.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { fileStorageService } from "@/lib/storage/file-storage.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = getAuth(request);
    const { id } = await params;

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get the current user
    const userRepository = new UserRepository();
    const user = await userRepository.getUserByClerkId(userId);

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    // Get the document
    const documentRepository = new DocumentRepository();
    const document = await documentRepository.getDocumentById(id);

    if (!document) {
      return new Response("Document not found", { status: 404 });
    }

    // Check if user has access to this document
    // For now, we'll allow access if user is ADMIN or if it's a public document
    // You may want to add more sophisticated permission checks based on your requirements
    if (user.role !== "ADMIN" && !document.isPublic) {
      // Additional checks can be added here for family-based access, etc.
      return new Response("Forbidden", { status: 403 });
    }

    if (!document.filePath) {
      return new Response("File path not found", { status: 404 });
    }

    // Parse the file path to get category and filename
    const [category, fileName] = document.filePath.split("/");

    // Read the file from storage
    const fileResult = await fileStorageService.readFile(category, fileName);

    if (!fileResult.success || !fileResult.buffer) {
      return new Response("File data not found", { status: 404 });
    }

    // Prepare response headers for file download
    const headers = new Headers();
    headers.set("Content-Type", document.mimeType || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${document.fileName}"`);

    if (document.fileSize) {
      headers.set("Content-Length", document.fileSize.toString());
    }

    // Cache headers for performance
    headers.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    headers.set("ETag", `"${document.id}-${document.updatedAt.getTime()}"`);

    return new Response(new Uint8Array(fileResult.buffer), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error("Document download error:", error);
    return createResponse(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}