import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NoteRepository } from "@/lib/db/repositories/note.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const noteRepo = new NoteRepository();
const userRepo = new UserRepository();

// Validation schema for adding structured tags
const addTagSchema = z.object({
  tagId: z.string().min(1, "Tag ID is required"),
});

/**
 * POST /api/notes/[id]/tags - Add structured tag to note
 *
 * Creates a NoteTag junction record linking the note to an existing tag
 * Handles family-scoped tag validation and usage count tracking
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("🏷️ POST /api/notes/[id]/tags");

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
    const validatedData = addTagSchema.parse(body);

    console.log("✅ Adding structured tag to note:", {
      noteId,
      tagId: validatedData.tagId,
      userId: user.id,
    });

    // 5. Add structured tag through repository (handles access control and validation)
    await noteRepo.addStructuredTag(noteId, validatedData.tagId, user.id);

    // 6. Get updated note with structured tags
    const updatedNote = await noteRepo.getNoteByIdWithEnhancements(noteId, user.id, {
      includeStructuredTags: true,
    });

    console.log("✅ Structured tag added successfully:", {
      noteId,
      tagId: validatedData.tagId,
      tagCount: updatedNote?.structuredTags?.length || 0,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Tag added successfully",
        structuredTags: updatedNote?.structuredTags || [],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error adding structured tag:", error);

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
      if (error.message.includes("access denied") || error.message.includes("different family")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      // Not found errors
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      // Tag validation errors
      if (error.message.includes("inactive")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Other business logic errors
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Generic server error
    return NextResponse.json(
      { error: "Failed to add tag" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notes/[id]/tags - Get structured tags for note
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("🏷️ GET /api/notes/[id]/tags");

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

    // 4. Get note with structured tags (handles access control)
    const note = await noteRepo.getNoteByIdWithEnhancements(noteId, user.id, {
      includeStructuredTags: true,
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    console.log("✅ Found structured tags for note:", {
      noteId,
      noteTitle: note.title,
      tagCount: note.structuredTags?.length || 0,
    });

    return NextResponse.json({
      structuredTags: note.structuredTags || [],
      simpleTags: note.tags || [], // Include simple string tags for compatibility
      total: (note.structuredTags?.length || 0) + (note.tags?.length || 0),
      message: `Found ${note.structuredTags?.length || 0} structured tags and ${note.tags?.length || 0} simple tags`,
    });
  } catch (error) {
    console.error("❌ Error fetching note tags:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("access denied")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}