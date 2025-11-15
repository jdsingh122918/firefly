import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { NoteRepository } from "@/lib/db/repositories/note.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const noteRepo = new NoteRepository();
const userRepo = new UserRepository();

/**
 * DELETE /api/notes/[id]/documents/[documentId] - Detach document from note
 *
 * Removes the document attachment without deleting the actual document
 * Handles access control - only note creator, attachment creator, or ADMIN can detach
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    console.log("📎 DELETE /api/notes/[id]/documents/[documentId]");

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

    // 3. Extract parameters
    const { id: noteId, documentId } = await params;

    console.log("✅ Detaching document from note:", {
      noteId,
      documentId,
      userId: user.id,
    });

    // 4. Get note with documents for context
    const note = await noteRepo.getNoteByIdWithEnhancements(noteId, user.id, {
      includeDocuments: true,
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // 5. Check if document is attached
    const attachment = note.documents?.find((doc: any) => doc.documentId === documentId);
    if (!attachment) {
      return NextResponse.json(
        { error: "Document is not attached to this note" },
        { status: 404 }
      );
    }

    // 6. Detach document through repository (handles access control)
    await noteRepo.detachDocument(noteId, documentId, user.id);

    // 7. Get updated note with documents
    const updatedNote = await noteRepo.getNoteByIdWithEnhancements(noteId, user.id, {
      includeDocuments: true,
    });

    console.log("✅ Document detached successfully:", {
      noteId,
      documentId,
      remainingDocuments: updatedNote?.documents?.length || 0,
    });

    return NextResponse.json({
      success: true,
      message: "Document detached successfully",
      documents: updatedNote?.documents || [],
    });
  } catch (error) {
    console.error("❌ Error detaching document:", error);

    if (error instanceof Error) {
      // Access control errors
      if (error.message.includes("access denied")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      // Not found errors
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      // Other business logic errors
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to detach document" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notes/[id]/documents/[documentId] - Get specific document attachment details
 *
 * Returns detailed information about a specific document attachment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    console.log("📎 GET /api/notes/[id]/documents/[documentId]");

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

    // 3. Extract parameters
    const { id: noteId, documentId } = await params;

    // 4. Get note with documents (handles access control)
    const note = await noteRepo.getNoteByIdWithEnhancements(noteId, user.id, {
      includeDocuments: true,
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // 5. Find specific document attachment
    const attachment = note.documents?.find((doc: any) => doc.documentId === documentId);

    if (!attachment) {
      return NextResponse.json(
        { error: "Document attachment not found" },
        { status: 404 }
      );
    }

    console.log("✅ Found document attachment:", {
      noteId,
      documentId,
      source: attachment.source,
      attachedBy: attachment.attachedBy?.firstName,
    });

    return NextResponse.json({
      attachment,
      message: "Document attachment found",
    });
  } catch (error) {
    console.error("❌ Error fetching document attachment:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("access denied")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch document attachment" },
      { status: 500 }
    );
  }
}