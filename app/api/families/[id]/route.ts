import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// Validation schema for updating a family
const updateFamilySchema = z
  .object({
    name: z
      .string()
      .min(1, "Family name is required")
      .max(100, "Family name must be less than 100 characters")
      .optional(),
    description: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/families/[id] - Get specific family
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Only ADMIN and VOLUNTEER can view family details
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const familyId = id;
    console.log("👁️ GET /api/families/[id]:", {
      familyId,
      userRole: user.role,
    });

    // Get family with members
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Check if volunteer has access to this family
    if (user.role === UserRole.VOLUNTEER) {
      // Volunteers can only see families they created
      if (family.createdById !== user.id) {
        return NextResponse.json(
          { error: "Access denied - you can only view families you created" },
          { status: 403 },
        );
      }
    }

    console.log("✅ Family retrieved:", {
      familyId,
      name: family.name,
      memberCount: (family.members || []).length,
    });

    return NextResponse.json({
      family: {
        id: family.id,
        name: family.name,
        description: family.description,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
        createdBy: family.createdBy ? {
          id: family.createdBy.id,
          name: family.createdBy.firstName
            ? `${family.createdBy.firstName} ${family.createdBy.lastName || ""}`.trim()
            : family.createdBy.email,
          email: family.createdBy.email,
        } : undefined,
        members: (family.members || []).map((member) => ({
          id: member.id,
          name: member.firstName
            ? `${member.firstName} ${member.lastName || ""}`.trim()
            : member.email,
          email: member.email,
          role: member.role,
          joinedAt: member.updatedAt, // When they were assigned to family
        })),
        memberCount: (family.members || []).length,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching family:", error);
    return NextResponse.json(
      { error: "Failed to fetch family" },
      { status: 500 },
    );
  }
}

// PUT /api/families/[id] - Update specific family
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Only ADMIN and VOLUNTEER can update families
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const familyId = id;

    // Check if family exists
    const existingFamily = await familyRepository.getFamilyById(familyId);
    if (!existingFamily) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Check if volunteer can update this family (only family creator or admin)
    if (
      user.role === UserRole.VOLUNTEER &&
      existingFamily.createdById !== user.id
    ) {
      return NextResponse.json(
        { error: "You can only update families you created" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateFamilySchema.parse(body);

    console.log("✏️ Updating family:", {
      familyId,
      data: validatedData,
      updatedBy: user.email,
    });

    // Update family
    const updatedFamily = await familyRepository.updateFamily(
      familyId,
      validatedData,
    );

    console.log("✅ Family updated successfully:", {
      familyId,
      name: updatedFamily.name,
    });

    return NextResponse.json({
      success: true,
      family: {
        id: updatedFamily.id,
        name: updatedFamily.name,
        description: updatedFamily.description,
        updatedAt: updatedFamily.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating family:", error);

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
      { error: "Failed to update family" },
      { status: 500 },
    );
  }
}

// DELETE /api/families/[id] - Delete specific family
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Only ADMIN can delete families (for now)
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only administrators can delete families" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const familyId = id;

    // Check if family exists
    const existingFamily = await familyRepository.getFamilyById(familyId);
    if (!existingFamily) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    console.log("🗑️ Deleting family:", {
      familyId,
      name: existingFamily.name,
      deletedBy: user.email,
    });

    // Check if family has members
    if ((existingFamily.members || []).length > 0) {
      console.log(
        "⚠️ Family has members, proceeding with deletion (members will be unassigned)",
      );
    }

    // Delete family (this will also unassign all members due to the repository implementation)
    await familyRepository.deleteFamily(familyId);

    console.log("✅ Family deleted successfully:", { familyId });

    return NextResponse.json({
      success: true,
      message: "Family deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting family:", error);
    return NextResponse.json(
      { error: "Failed to delete family" },
      { status: 500 },
    );
  }
}
