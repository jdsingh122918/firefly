import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { TagRepository } from "@/lib/db/repositories/tag.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import type { TagFilters, TagSortOptions } from "@/lib/types/api";

const tagRepository = new TagRepository();
const userRepository = new UserRepository();

// Validation schema for creating a tag
const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(50, "Tag name must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9\s-_]+$/,
      "Tag name can only contain letters, numbers, spaces, hyphens, and underscores",
    ),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code")
    .optional(),
  categoryId: z.string().optional(),
});

// GET /api/tags - Get tags with filtering and pagination
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

    console.log("🏷️ GET /api/tags - User:", {
      role: user.role,
      email: user.email,
      familyId: user.familyId,
    });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");
    const includeUsageCount = searchParams.get("includeUsageCount") === "true";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    // Build filters
    const filters: TagFilters = {};

    // Apply additional filters
    if (categoryId) filters.name = categoryId;
    if (search) filters.name = search;
    if (user.familyId) filters.familyId = user.familyId;

    // Get tags with sorting options
    const sortOptions: TagSortOptions = {
      sortBy: sortBy as "name" | "usageCount" | "createdAt" | "updatedAt",
      sortOrder: sortOrder as "asc" | "desc",
    };

    // Convert filters to match repository expectations
    const repositoryFilters = {
      familyId: filters.familyId,
      search: filters.name, // Using name as search
      // Note: resourceType would need to be converted from string to enum if used
    };

    // Get tags
    const tags = await tagRepository.getTags(repositoryFilters, {
      includeCategory: true,
      includeUsageCount,
      sortBy: sortOptions.sortBy,
      sortOrder: sortOptions.sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error("❌ GET /api/tags error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 },
    );
  }
}

// POST /api/tags - Create a new tag
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

    console.log("🏷️ POST /api/tags - User:", {
      role: user.role,
      email: user.email,
      familyId: user.familyId,
    });

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createTagSchema.parse(body);

    // Check if category exists and user has access to it (if provided)
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

    // Create tag
    const tag = await tagRepository.createTag({
      name: validatedData.name,
      description: validatedData.description,
      color: validatedData.color,
      categoryId: validatedData.categoryId,
      familyId: user.familyId || undefined,
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: tag,
        message: "Tag created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ POST /api/tags error:", error);

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
      { error: "Failed to create tag" },
      { status: 500 },
    );
  }
}
