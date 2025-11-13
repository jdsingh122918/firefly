import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { TagRepository } from "@/lib/db/repositories/tag.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const tagRepository = new TagRepository();
const userRepository = new UserRepository();

// Validation schema for updating a category
const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9\s-_]+$/,
      "Category name can only contain letters, numbers, spaces, hyphens, and underscores",
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
  icon: z.string().max(50, "Icon must be less than 50 characters").optional(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Helper function to check category access
async function checkCategoryAccess(
  categoryId: string,
  userId: string,
  userRole: string,
  userFamilyId?: string,
) {
  const category = await tagRepository.getCategoryById(categoryId);

  if (!category) {
    return { hasAccess: false, category: null, error: "Category not found" };
  }

  // Access control logic:
  // 1. Admins can access all categories
  // 2. Users can access system categories
  // 3. Users can access categories from their family
  // 4. Users can access categories they created
  const hasAccess =
    userRole === "ADMIN" ||
    category.isSystemCategory ||
    (userFamilyId && category.familyId === userFamilyId) ||
    category.createdBy === userId;

  if (!hasAccess) {
    return { hasAccess: false, category: null, error: "Access denied" };
  }

  return { hasAccess: true, category, error: null };
}

// GET /api/categories/[id] - Get specific category
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

    const { id: categoryId } = await params;

    console.log("📂 GET /api/categories/[id] - User:", {
      role: user.role,
      email: user.email,
      categoryId,
    });

    // Check category access
    const { hasAccess, category, error } = await checkCategoryAccess(
      categoryId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Category not found" ? 404 : 403 },
      );
    }

    // Get query parameters for additional data
    const { searchParams } = new URL(request.url);
    const includeTags = searchParams.get("includeTags") === "true";
    const includeChildren = searchParams.get("includeChildren") === "true";

    let enrichedCategory = category;

    if (includeTags || includeChildren) {
      const options: {
        includeTags?: boolean;
        includeChildren?: boolean;
      } = {};
      if (includeTags) options.includeTags = true;
      if (includeChildren) options.includeChildren = true;

      enrichedCategory = await tagRepository.getCategoryById(
        categoryId,
        options,
      );
    }

    return NextResponse.json({
      success: true,
      data: enrichedCategory,
    });
  } catch (error) {
    console.error("❌ GET /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 },
    );
  }
}

// PUT /api/categories/[id] - Update category
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

    const { id: categoryId } = await params;

    console.log("📂 PUT /api/categories/[id] - User:", {
      role: user.role,
      email: user.email,
      categoryId,
    });

    // Check category access
    const { hasAccess, category, error } = await checkCategoryAccess(
      categoryId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Category not found" ? 404 : 403 },
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    // Additional permission check: only category creator, family admin, or system admin can modify
    const canModify =
      user.role === "ADMIN" ||
      category.createdBy === user.id ||
      (user.familyRole === "FAMILY_ADMIN" &&
        category.familyId === user.familyId &&
        !category.isSystemCategory);

    if (!canModify) {
      return NextResponse.json(
        {
          error:
            "Access denied: Only category creator, family admin, or system admin can modify categories",
        },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);

    // Check if new parent category exists and user has access to it (if provided)
    if (validatedData.parentId) {
      // Prevent self-reference
      if (validatedData.parentId === categoryId) {
        return NextResponse.json(
          { error: "Category cannot be its own parent" },
          { status: 400 },
        );
      }

      const parentCategory = await tagRepository.getCategoryById(
        validatedData.parentId,
      );
      if (!parentCategory) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 },
        );
      }

      // Check parent category access
      if (
        user.role !== "ADMIN" &&
        parentCategory.familyId !== user.familyId &&
        !parentCategory.isSystemCategory
      ) {
        return NextResponse.json(
          {
            error:
              "Access denied: Cannot use parent categories from other families",
          },
          { status: 403 },
        );
      }

      // Prevent circular references
      const isCircular = await tagRepository.wouldCreateCircularReference(
        categoryId,
        validatedData.parentId,
      );
      if (isCircular) {
        return NextResponse.json(
          { error: "Cannot create circular reference in category hierarchy" },
          { status: 400 },
        );
      }

      // Prevent too deep nesting (max 3 levels)
      const depth = await tagRepository.getCategoryDepth(
        validatedData.parentId,
      );
      if (depth >= 3) {
        return NextResponse.json(
          { error: "Maximum category nesting depth (3 levels) exceeded" },
          { status: 400 },
        );
      }
    }

    // Update category
    const updatedCategory = await tagRepository.updateCategory(categoryId, {
      name: validatedData.name,
      description: validatedData.description,
      color: validatedData.color,
      icon: validatedData.icon,
      parentId: validatedData.parentId ?? undefined,
      isActive: validatedData.isActive,
    });

    return NextResponse.json({
      success: true,
      data: updatedCategory,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("❌ PUT /api/categories/[id] error:", error);

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
        { error: "A category with this name already exists in your family" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}

// DELETE /api/categories/[id] - Delete category
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

    const { id: categoryId } = await params;

    console.log("📂 DELETE /api/categories/[id] - User:", {
      role: user.role,
      email: user.email,
      categoryId,
    });

    // Check category access
    const { hasAccess, category, error } = await checkCategoryAccess(
      categoryId,
      user.id,
      user.role,
      user.familyId || undefined,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: error || "Access denied" },
        { status: error === "Category not found" ? 404 : 403 },
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    // Additional permission check: only category creator, family admin, or system admin can delete
    const canDelete =
      user.role === "ADMIN" ||
      category.createdBy === user.id ||
      (user.familyRole === "FAMILY_ADMIN" &&
        category.familyId === user.familyId &&
        !category.isSystemCategory);

    if (!canDelete) {
      return NextResponse.json(
        {
          error:
            "Access denied: Only category creator, family admin, or system admin can delete categories",
        },
        { status: 403 },
      );
    }

    // Check if category has child categories
    const hasChildren = await tagRepository.categoryHasChildren(categoryId);
    if (hasChildren) {
      return NextResponse.json(
        {
          error:
            "Cannot delete category: it has child categories. Delete or move child categories first.",
        },
        { status: 409 },
      );
    }

    // Check if category has tags
    const tagCount = await tagRepository.getCategoryTagCount(categoryId);
    if (tagCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category: it contains ${tagCount} tag(s). Remove or reassign tags first.`,
        },
        { status: 409 },
      );
    }

    // Delete category
    await tagRepository.deleteCategory(categoryId);

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 },
    );
  }
}
