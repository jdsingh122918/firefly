import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// Validation schema for search parameters
const searchParamsSchema = z.object({
  query: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// GET /api/families/search - Search families with filtering
export async function GET(request: NextRequest) {
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

    // Only ADMIN and VOLUNTEER can search families
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate search parameters
    const { searchParams } = new URL(request.url);
    const validatedParams = searchParamsSchema.parse({
      query: searchParams.get("query") || undefined,
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    });

    console.log("🔍 Searching families:", {
      query: validatedParams.query,
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      searchedBy: user.email,
    });

    // Perform search using repository method
    const { families, total } = await familyRepository.searchFamilies(
      validatedParams.query,
      validatedParams.limit,
      validatedParams.offset,
    );

    console.log("✅ Family search completed:", {
      resultsFound: families.length,
      totalMatches: total,
      query: validatedParams.query,
    });

    // Enhance family data with additional computed fields
    const enhancedFamilies = families.map((family) => ({
      id: family.id,
      name: family.name,
      description: family.description,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
      primaryContactId: family.primaryContactId,
      createdBy: family.createdBy
        ? {
            id: family.createdBy.id,
            email: family.createdBy.email,
            name: family.createdBy.firstName
              ? `${family.createdBy.firstName} ${family.createdBy.lastName || ""}`.trim()
              : family.createdBy.email,
          }
        : undefined,
      members:
        family.members?.map((member) => ({
          id: member.id,
          email: member.email,
          name: member.firstName
            ? `${member.firstName} ${member.lastName || ""}`.trim()
            : member.email,
          role: member.role,
          familyRole: member.familyRole,
          isPrimaryContact: member.id === family.primaryContactId,
        })) || [],
      memberCount: family.members?.length || 0,
      primaryContact: family.members?.find(
        (member) => member.id === family.primaryContactId,
      ),
    }));

    return NextResponse.json({
      success: true,
      families: enhancedFamilies,
      pagination: {
        total,
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        hasMore: validatedParams.offset + validatedParams.limit < total,
      },
      query: validatedParams.query || null,
    });
  } catch (error) {
    console.error("❌ Error searching families:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid search parameters",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to search families" },
      { status: 500 },
    );
  }
}
