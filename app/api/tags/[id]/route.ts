import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { TagRepository } from "@/lib/db/repositories/tag.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const tagRepository = new TagRepository();
const userRepository = new UserRepository();

// Validation schema for updating a tag
const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(50, "Tag name must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9\s-_]+$/,
      "Tag name can only contain letters, numbers, spaces, hyphens, and underscores",
    )
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code")
    .optional(),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Helper function to check tag access
async function checkTagAccess(
  tagId: string,
  userId: string,
  userRole: string,
  userFamilyId?: string,
) {
  const tag = await tagRepository.getTagById(tagId);

  if (!tag) {
    return { hasAccess: false, tag: null, error: "Tag not found" };
  }

  // Access control logic:
  // 1. Admins can access all tags
  // 2. Users can access system tags
  // 3. Users can access tags from their family
  // 4. Users can access tags they created
  const hasAccess =
    userRole === "ADMIN" ||
    tag.isSystemTag ||
    (userFamilyId && tag.familyId === userFamilyId) ||
    tag.createdBy === userId;

  if (!hasAccess) {
    return { hasAccess: false, tag: null, error: "Access denied" };
  }

  return { hasAccess: true, tag, error: null };
}

// GET /api/tags/[id] - Get specific tag
export async function GET(
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
    const tagId = id;

    console.log("🏷️ GET /api/tags/[id] - User:", {
      role: user.role,
      email: user.email,
      tagId,
    });

    // Check tag access
    const { hasAccess, tag, error } = await checkTagAccess(
      tagId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Tag not found" ? 404 : 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: tag,
    });
  } catch (error) {
    console.error("❌ GET /api/tags/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch tag" }, { status: 500 });
  }
}

// PUT /api/tags/[id] - Update tag
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
    const tagId = id;

    console.log("🏷️ PUT /api/tags/[id] - User:", {
      role: user.role,
      email: user.email,
      tagId,
    });

    // Check tag access
    const { hasAccess, tag, error } = await checkTagAccess(
      tagId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Tag not found" ? 404 : 403 },
      );
    }

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Additional permission check: only tag creator, family admin, or system admin can modify
    const canModify =
      user.role === "ADMIN" ||
      tag.createdBy === user.id ||
      (user.familyRole === "FAMILY_ADMIN" &&
        tag.familyId === user.familyId &&
        !tag.isSystemTag);

    if (!canModify) {
      return NextResponse.json(
        {
          error:
            "Access denied: Only tag creator, family admin, or system admin can modify tags",
        },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateTagSchema.parse(body);

    // Check if new category exists and user has access to it (if provided)
    if (validatedData.categoryId) {
      const category = await tagRepository.getCategoryById(
        validatedData.categoryId,
      );
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 },
        );
      }

      // Check category access
      if (
        user.role !== "ADMIN" &&
        category.familyId !== user.familyId &&
        !category.isSystemCategory
      ) {
        return NextResponse.json(
          { error: "Access denied: Cannot use categories from other families" },
          { status: 403 },
        );
      }
    }

    // Update tag
    const updatedTag = await tagRepository.updateTag(tagId, {
      name: validatedData.name,
      description: validatedData.description,
      color: validatedData.color,
      categoryId: validatedData.categoryId,
      isActive: validatedData.isActive,
    });

    return NextResponse.json({
      success: true,
      data: updatedTag,
      message: "Tag updated successfully",
    });
  } catch (error) {
    console.error("❌ PUT /api/tags/[id] error:", error);

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

    if (error instanceof Error && error.message.includes("duplicate")) {
      return NextResponse.json(
        { error: "A tag with this name already exists in your family" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 },
    );
  }
}

// DELETE /api/tags/[id] - Delete tag
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
    const tagId = id;

    console.log("🏷️ DELETE /api/tags/[id] - User:", {
      role: user.role,
      email: user.email,
      tagId,
    });

    // Check tag access
    const { hasAccess, tag, error } = await checkTagAccess(
      tagId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Tag not found" ? 404 : 403 },
      );
    }

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Additional permission check: only tag creator, family admin, or system admin can delete
    const canDelete =
      user.role === "ADMIN" ||
      tag.createdBy === user.id ||
      (user.familyRole === "FAMILY_ADMIN" &&
        tag.familyId === user.familyId &&
        !tag.isSystemTag);

    if (!canDelete) {
      return NextResponse.json(
        {
          error:
            "Access denied: Only tag creator, family admin, or system admin can delete tags",
        },
        { status: 403 },
      );
    }

    // Check if tag is in use
    const usageCount = await tagRepository.getTagUsageCount(tagId);
    if (usageCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete tag: it is currently used by ${usageCount} resource(s). Remove the tag from all resources first.`,
        },
        { status: 409 },
      );
    }

    // Delete tag
    await tagRepository.deleteTag(tagId);

    return NextResponse.json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE /api/tags/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 },
    );
  }
}
