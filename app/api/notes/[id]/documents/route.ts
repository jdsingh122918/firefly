import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NoteRepository } from "@/lib/db/repositories/note.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { DocumentSource } from "@/lib/types";

const noteRepo = new NoteRepository();
const userRepo = new UserRepository();

// Validation schema for attaching documents
const attachDocumentSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  source: z.enum(["UPLOAD", "LIBRARY"]).default("LIBRARY"),
  order: z.number().int().min(0).max(100).default(0),
});

/**
 * POST /api/notes/[id]/documents - Attach document to note
 *
 * Supports dual workflow with different access control:
 * - UPLOAD: Document was uploaded specifically for this note (full access)
 * - LIBRARY: Document was selected from existing document library (family-scoped for VOLUNTEER)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("📎 POST /api/notes/[id]/documents");

    // 1. Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user details
    const user = await userRepo.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Extract noteId
    const { id: noteId } = await params;

    // 4. Parse and validate request body
    const body = await request.json();
    const validatedData = attachDocumentSchema.parse(body);

    console.log("✅ Attaching document to note:", {
      noteId,
      documentId: validatedData.documentId,
      source: validatedData.source,
      userId: user.id,
    });

    // 5. Attach document through repository (handles access control)
    await noteRepo.attachDocument(
      noteId,
      validatedData.documentId,
      user.id,
      validatedData.source,
      validatedData.order
    );

    // 6. Get updated note with documents
    const updatedNote = await noteRepo.getNoteByIdWithEnhancements(noteId, user.id, {
      includeDocuments: true,
    });

    console.log("✅ Document attached successfully:", {
      noteId,
      documentId: validatedData.documentId,
      attachmentCount: updatedNote?.documents?.length || 0,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Document attached successfully",
        documents: updatedNote?.documents || [],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error attaching document:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // Handle domain-specific errors
    if (error instanceof Error) {
      // Access control errors
      if (error.message.includes("access denied") || error.message.includes("different families")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      // Not found errors
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      // Conflict errors
      if (error.message.includes("already attached")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      // Other business logic errors
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Generic server error
    return NextResponse.json(
      { error: "Failed to attach document" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notes/[id]/documents - Get documents attached to note
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("📎 GET /api/notes/[id]/documents");

    // 1. Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user details
    const user = await userRepo.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Extract noteId
    const { id: noteId } = await params;

    // 4. Get note with documents (handles access control)
    const note = await noteRepo.getNoteByIdWithEnhancements(noteId, user.id, {
      includeDocuments: true,
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    console.log("✅ Found documents for note:", {
      noteId,
      noteTitle: note.title,
      documentCount: note.documents?.length || 0,
    });

    return NextResponse.json({
      documents: note.documents || [],
      total: note.documents?.length || 0,
      message: `Found ${note.documents?.length || 0} documents`,
    });
  } catch (error) {
    console.error("❌ Error fetching note documents:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("access denied")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}