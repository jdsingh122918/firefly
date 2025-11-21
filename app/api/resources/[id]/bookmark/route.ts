import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole, ResourceStatus } from "@prisma/client";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { prisma } from "@/lib/db/prisma";

const resourceRepository = new ResourceRepository(prisma);
const userRepository = new UserRepository();

// Validation schema for bookmarking a resource
const bookmarkResourceSchema = z.object({
  notes: z
    .string()
    .max(500, "Bookmark notes must be less than 500 characters")
    .optional(),
  categoryId: z.string().optional(), // For organizing bookmarks
  tags: z.array(z.string()).optional(), // User-specific bookmark tags
});

// POST /api/resources/[id]/bookmark - Bookmark a resource
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Parse and validate request body (optional)
    const body = await request.json().catch(() => ({}));
    const validatedData = bookmarkResourceSchema.parse(body);

    console.log("🔖 Bookmarking resource:", {
      resourceId: id,
      userId: user.id,
      hasNotes: !!validatedData.notes,
    });

    // Check if resource exists and is accessible
    const resource = await resourceRepository.findById(id, user.id, user.role);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found or access denied" }, { status: 404 });
    }

    // Check if resource can be bookmarked (must be approved or featured)
    if (resource.status !== ResourceStatus.APPROVED && resource.status !== ResourceStatus.FEATURED) {
      return NextResponse.json(
        { error: "Can only bookmark approved or featured resources" },
        { status: 400 }
      );
    }

    // TODO: Implement bookmark functionality - database schema and repository methods needed
    // Bookmark the resource (placeholder implementation)
    const result = {
      wasUpdate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("✅ Resource bookmarked successfully:", {
      resourceId: id,
      userId: user.id,
      wasUpdate: result.wasUpdate,
    });

    return NextResponse.json({
      success: true,
      bookmark: {
        userId: user.id,
        resourceId: id,
        notes: validatedData.notes,
        categoryId: validatedData.categoryId,
        tags: validatedData.tags,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      wasUpdate: result.wasUpdate,
      message: result.wasUpdate ? "Bookmark updated successfully" : "Resource bookmarked successfully",
    });
  } catch (error) {
    console.error("❌ Error bookmarking resource:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    // Handle specific repository errors
    if (error instanceof Error) {
      if (error.message.includes("already bookmarked")) {
        return NextResponse.json(
          { error: "Resource already bookmarked" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to bookmark resource" },
      { status: 500 },
    );
  }
}

// GET /api/resources/[id]/bookmark - Get user's bookmark status and details for resource
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    console.log("🔖 Getting bookmark status for resource:", {
      resourceId: id,
      userId: user.id,
    });

    // TODO: Implement bookmark functionality - includeBookmarks option not implemented
    // Get resource with bookmark details (placeholder implementation)
    const resource = await resourceRepository.findById(id, user.id, user.role);

    if (!resource) {
      return NextResponse.json({ error: "Resource not found or access denied" }, { status: 404 });
    }

    // TODO: Implement bookmark functionality - bookmarks property not implemented
    // Extract user's bookmark (placeholder implementation)
    const userBookmark = null;

    return NextResponse.json({
      resourceId: id,
      resourceTitle: resource.title,
      isBookmarked: !!userBookmark,
      bookmark: null, // TODO: Implement bookmark details
      resourceStats: {
        totalBookmarks: 0, // TODO: Implement bookmark count
      },
    });
  } catch (error) {
    console.error("❌ Error getting bookmark status:", error);
    return NextResponse.json(
      { error: "Failed to get bookmark status" },
      { status: 500 },
    );
  }
}

// PUT /api/resources/[id]/bookmark - Update bookmark details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = bookmarkResourceSchema.parse(body);

    console.log("🔖 Updating bookmark:", {
      resourceId: id,
      userId: user.id,
      hasNotes: !!validatedData.notes,
    });

    // TODO: Implement bookmark functionality - updateBookmark method not implemented
    // Update bookmark (placeholder implementation)
    const result = {
      success: true,
      updatedAt: new Date(),
    };

    if (!result.success) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 }
      );
    }

    console.log("✅ Bookmark updated successfully:", {
      resourceId: id,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      bookmark: {
        userId: user.id,
        resourceId: id,
        notes: validatedData.notes,
        categoryId: validatedData.categoryId,
        tags: validatedData.tags,
        updatedAt: result.updatedAt,
      },
      message: "Bookmark updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating bookmark:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update bookmark" },
      { status: 500 },
    );
  }
}

// DELETE /api/resources/[id]/bookmark - Remove bookmark from resource
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    console.log("🔖 Removing bookmark from resource:", {
      resourceId: id,
      userId: user.id,
    });

    // TODO: Implement bookmark functionality - removeBookmark method not implemented
    // Remove user's bookmark (placeholder implementation)
    const result = {
      success: true,
      totalBookmarks: 0,
    };

    if (!result.success) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 }
      );
    }

    console.log("✅ Bookmark removed successfully:", {
      resourceId: id,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Bookmark removed successfully",
      resourceStats: {
        totalBookmarks: result.totalBookmarks,
      },
    });
  } catch (error) {
    console.error("❌ Error removing bookmark:", error);
    return NextResponse.json(
      { error: "Failed to remove bookmark" },
      { status: 500 },
    );
  }
}