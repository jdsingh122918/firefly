import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { TagRepository } from "@/lib/db/repositories/tag.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const tagRepository = new TagRepository();
const userRepository = new UserRepository();

// Validation schema for creating a category
const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9\s-_]+$/,
      "Category name can only contain letters, numbers, spaces, hyphens, and underscores",
    ),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code")
    .optional(),
  icon: z.string().max(50, "Icon must be less than 50 characters").optional(),
  parentId: z.string().optional(),
});

// GET /api/categories - Get categories with filtering
export async function GET(request: NextRequest) {
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

    console.log("📂 GET /api/categories - User:", {
      role: user.role,
      email: user.email,
      familyId: user.familyId,
    });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");
    const includeSystemCategories =
      searchParams.get("includeSystemCategories") === "true";
    const includeTagCount = searchParams.get("includeTagCount") === "true";
    const isActive = searchParams.get("isActive");
    const hierarchical = searchParams.get("hierarchical") === "true";

    // Build filters
    const filters: {
      OR?: Array<{ familyId: string | null } | { isSystem: boolean }>;
      isSystem?: boolean;
      parentId?: string | null;
      isActive?: boolean;
    } = {};

    // Build filters for hierarchy method
    const hierarchyFilters: {
      familyId?: string;
      isSystem?: boolean;
    } = {};

    // Family scope - users can only see categories from their family or system categories
    if (user.role !== "ADMIN") {
      filters.OR = [
        { familyId: user.familyId },
        ...(includeSystemCategories ? [{ isSystem: true }] : []),
      ];
      if (user.familyId) {
        hierarchyFilters.familyId = user.familyId;
      }
    } else if (!includeSystemCategories) {
      // Admin can see all categories, but exclude system categories unless requested
      filters.isSystem = false;
      hierarchyFilters.isSystem = false;
    }

    // Apply additional filters
    if (parentId) filters.parentId = parentId;
    if (isActive !== null) filters.isActive = isActive === "true";

    // Get categories
    if (hierarchical) {
      const categories = await tagRepository.getCategoriesHierarchy(hierarchyFilters, {
        includeTagCount,
      });
      return NextResponse.json({
        success: true,
        data: categories,
      });
    } else {
      // Convert filters to match getCategories expected format
      const getCategoriesFilters: {
        familyId?: string;
        isSystem?: boolean;
        parentId?: string | null;
      } = {};

      // Handle OR conditions differently for getCategories
      if (filters.OR) {
        // For now, simplify by just using familyId from the user
        if (user.familyId) {
          getCategoriesFilters.familyId = user.familyId;
        }
      }
      if (filters.isSystem !== undefined) {
        getCategoriesFilters.isSystem = filters.isSystem;
      }
      if (filters.parentId !== undefined) {
        getCategoriesFilters.parentId = filters.parentId;
      }

      const categories = await tagRepository.getCategories(getCategoriesFilters);
      return NextResponse.json({
        success: true,
        data: categories,
      });
    }
  } catch (error) {
    console.error("❌ GET /api/categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

// POST /api/categories - Create a new category
export async function POST(request: NextRequest) {
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

    console.log("📂 POST /api/categories - User:", {
      role: user.role,
      email: user.email,
      familyId: user.familyId,
    });

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createCategorySchema.parse(body);

    // Check if parent category exists and user has access to it (if provided)
    if (validatedData.parentId) {
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

    // Create category
    const category = await tagRepository.createCategory({
      name: validatedData.name,
      description: validatedData.description,
      color: validatedData.color,
      icon: validatedData.icon,
      parentId: validatedData.parentId,
      familyId: user.familyId || undefined,
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: category,
        message: "Category created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ POST /api/categories error:", error);

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
      { error: "Failed to create category" },
      { status: 500 },
    );
  }
}
