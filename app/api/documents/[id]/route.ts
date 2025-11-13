import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { DocumentType, DocumentStatus } from "@/lib/types";
import { DocumentRepository } from "@/lib/db/repositories/document.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { readFile, unlink } from "fs/promises";
import { join } from "path";

const documentRepository = new DocumentRepository();
const userRepository = new UserRepository();

// Helper function to check document access
async function checkDocumentAccess(
  documentId: string,
  userId: string,
  userRole: UserRole,
  userFamilyId?: string
): Promise<{
  hasAccess: boolean;
  document?: any;
  error?: string;
}> {
  try {
    const document = await documentRepository.getDocumentById(documentId, {
      includeDeleted: false,
    });

    if (!document) {
      return { hasAccess: false, error: "Document not found" };
    }

    // Check access based on user role and document ownership
    if (userRole === "ADMIN") {
      return { hasAccess: true, document };
    }

    // Check if user is the uploader
    if (document.uploadedBy === userId) {
      return { hasAccess: true, document };
    }

    // Check if document is in user's family
    if (document.familyId && userFamilyId === document.familyId) {
      return { hasAccess: true, document };
    }

    return { hasAccess: false, error: "Access denied" };
  } catch (error) {
    return { hasAccess: false, error: "Failed to check access" };
  }
}

// Validation schema for updating a document
const updateDocumentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .optional(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  familyId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/documents/[id] - Get document by ID with access control

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";

    console.log("📄 GET /api/documents/[id] - User:", {
      role: user.role,
      email: user.email,
      documentId: id,
      download,
    });

    // Get document with access control
    const document = await documentRepository.getDocumentById(id, {
      includeDeleted: false,
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    console.log("✅ Document retrieved:", {
      documentId: document.id,
      title: document.title,
      type: document.type,
      status: document.status,
      fileSize: document.fileSize,
    });

    // If download is requested, serve the file
    if (download) {
      try {
        const filePath = join(process.cwd(), "public", document.filePath);
        const fileBuffer = await readFile(filePath);

        // Set appropriate headers for file download
        const headers = new Headers();
        headers.set("Content-Type", document.mimeType || "application/octet-stream");
        headers.set("Content-Length", document.fileSize?.toString() || fileBuffer.length.toString());
        headers.set("Content-Disposition", `attachment; filename="${document.originalFileName || document.fileName}"`);

        return new NextResponse(fileBuffer, {
          status: 200,
          headers,
        });
      } catch (error) {
        console.error("❌ Error reading file:", error);
        return NextResponse.json(
          { error: "File not found on server" },
          { status: 404 }
        );
      }
    }

    // Otherwise, return document metadata
    const formattedDocument = {
      id: document.id,
      title: document.title,
      description: document.description,
      fileName: document.fileName,
      originalFileName: document.originalFileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      type: document.type,
      status: document.status,
      filePath: document.filePath,
      thumbnailPath: document.thumbnailPath,
      duration: document.duration,
      width: document.width,
      height: document.height,
      familyId: document.familyId,
      family: document.family ? {
        id: document.family.id,
        name: document.family.name,
      } : null,
      tags: document.tags,
      metadata: document.metadata,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      expiresAt: document.expiresAt,
      uploader: document.uploadedByUser ? {
        id: document.uploadedByUser.id,
        name: document.uploadedByUser.firstName
          ? `${document.uploadedByUser.firstName} ${document.uploadedByUser.lastName || ""}`.trim()
          : document.uploadedByUser.email,
        email: document.uploadedByUser.email,
      } : null,
    };

    return NextResponse.json({
      document: formattedDocument,
    });
  } catch (error) {
    console.error("❌ Error fetching document:", error);

    // Handle access denied errors specifically
    if (error instanceof Error && error.message.includes("Access denied")) {
      return NextResponse.json(
        { error: "Access denied to this document" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 },
    );
  }
}

// PUT /api/documents/[id] - Update document
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const { id } = await params;
    const documentId = id;

    console.log("📄 PUT /api/documents/[id] - User:", {
      role: user.role,
      email: user.email,
      documentId,
    });

    // Check document access
    const { hasAccess, document, error } = await checkDocumentAccess(
      documentId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Document not found" ? 404 : 403 },
      );
    }

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // Additional permission check: only document owner or admin can modify
    if (document.uploadedBy !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Access denied: Only document owner or admin can modify documents",
        },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateDocumentSchema.parse(body);

    // Update document
    const updatedDocument = await documentRepository.updateDocument(
      documentId,
      {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        familyId: validatedData.familyId,
        tags: validatedData.tags,
        metadata: validatedData.metadata,
        expiresAt: validatedData.expiresAt
          ? new Date(validatedData.expiresAt)
          : undefined,
      },
    );

    return NextResponse.json({
      success: true,
      data: updatedDocument,
      message: "Document updated successfully",
    });
  } catch (error) {
    console.error("❌ PUT /api/documents/[id] error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 },
    );
  }
}

// DELETE /api/documents/[id] - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const { id } = await params;
    const documentId = id;

    console.log("📄 DELETE /api/documents/[id] - User:", {
      role: user.role,
      email: user.email,
      documentId,
    });

    // Check document access
    const { hasAccess, document, error } = await checkDocumentAccess(
      documentId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Document not found" ? 404 : 403 },
      );
    }

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // Additional permission check: only document owner or admin can delete
    if (document.uploadedBy !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Access denied: Only document owner or admin can delete documents",
        },
        { status: 403 },
      );
    }

    // Get query parameter for permanent deletion
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    if (permanent && user.role === "ADMIN") {
      // Permanent deletion (admin only)
      await documentRepository.permanentlyDeleteDocument(documentId);
      return NextResponse.json({
        success: true,
        message: "Document permanently deleted",
      });
    } else {
      // Soft deletion
      await documentRepository.deleteDocument(documentId);
      return NextResponse.json({
        success: true,
        message: "Document deleted successfully",
      });
    }
  } catch (error) {
    console.error("❌ DELETE /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
