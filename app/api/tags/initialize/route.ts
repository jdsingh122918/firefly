import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { TagRepository } from "@/lib/db/repositories/tag.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const tagRepository = new TagRepository();
const userRepository = new UserRepository();

/**
 * POST /api/tags/initialize - Initialize healthcare system tags
 *
 * This endpoint allows ADMIN users to initialize the comprehensive healthcare
 * service tags and categories that are automatically available system-wide.
 *
 * Request body: { force?: boolean }
 * - force: If true, recreates existing system tags
 */
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

    // Only ADMIN users can initialize system tags
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied: Only ADMIN users can initialize system tags" },
        { status: 403 }
      );
    }

    console.log("🏥 POST /api/tags/initialize - Admin user:", {
      email: user.email,
      role: user.role,
    });

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);

    console.log(`🏥 Initializing healthcare tags (force: ${force})...`);

    // Check if tags already exist (unless force mode)
    if (!force) {
      const existingSystemTags = await tagRepository.getTags(
        { isSystem: true },
        { includeCategory: true }
      );

      const healthcareSystemTags = existingSystemTags.filter(tag =>
        tag.category && tag.category.name.includes("Healthcare") ||
        tag.category && tag.category.name.includes("Medical") ||
        tag.category && tag.category.name.includes("Mental Health") ||
        tag.category && tag.category.name.includes("Home & Community") ||
        tag.category && tag.category.name.includes("Basic Needs") ||
        tag.category && tag.category.name.includes("Legal") ||
        tag.category && tag.category.name.includes("Education")
      );

      if (healthcareSystemTags.length > 0) {
        return NextResponse.json({
          success: true,
          message: "Healthcare tags already initialized",
          data: {
            existing: true,
            categoriesCount: 0,
            tagsCount: healthcareSystemTags.length,
            note: "Use force: true to recreate all tags"
          }
        });
      }
    }

    // Initialize healthcare tags using the user as the creator
    const result = await tagRepository.initializeHealthcareTags(user.id);

    return NextResponse.json({
      success: true,
      message: "Healthcare tags initialized successfully",
      data: {
        categoriesCount: result.categories.length,
        tagsCount: result.tags.length,
        forced: force
      }
    });

  } catch (error) {
    console.error("❌ POST /api/tags/initialize error:", error);

    if (error instanceof Error) {
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          {
            error: "Some tags already exist",
            details: error.message,
            suggestion: "Use force: true to recreate existing tags"
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to initialize healthcare tags" },
      { status: 500 }
    );
  }
}