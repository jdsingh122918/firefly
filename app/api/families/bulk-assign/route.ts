import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { FamilyRole } from "@/lib/types";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// Validation schema for bulk assignment
const bulkAssignSchema = z.object({
  userIds: z
    .array(z.string().min(1))
    .min(1, "At least one user ID is required"),
  targetFamilyId: z.string().min(1, "Target family ID is required"),
  familyRole: z.enum(["PRIMARY_CONTACT", "FAMILY_ADMIN", "MEMBER"]).optional(),
});

// POST /api/families/bulk-assign - Bulk assign users to a family
export async function POST(request: NextRequest) {
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

    // Only ADMIN and VOLUNTEER can bulk assign
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = bulkAssignSchema.parse(body);

    console.log("📋 Bulk assigning members:", {
      userIds: validatedData.userIds,
      targetFamilyId: validatedData.targetFamilyId,
      familyRole: validatedData.familyRole,
      assignedBy: user.email,
    });

    // Verify the target family exists
    const targetFamily = await familyRepository.getFamilyById(
      validatedData.targetFamilyId,
    );
    if (!targetFamily) {
      return NextResponse.json(
        { error: "Target family not found" },
        { status: 404 },
      );
    }

    // Verify all users exist
    const users = await Promise.all(
      validatedData.userIds.map((id) => userRepository.getUserById(id)),
    );

    const invalidUsers = users
      .map((user, index) => ({
        user,
        originalId: validatedData.userIds[index],
      }))
      .filter(({ user }) => !user);

    if (invalidUsers.length > 0) {
      return NextResponse.json(
        {
          error: "Some users not found",
          invalidUserIds: invalidUsers.map(({ originalId }) => originalId),
        },
        { status: 400 },
      );
    }

    // Perform bulk assignment
    await familyRepository.bulkAssignMembers({
      userIds: validatedData.userIds,
      targetFamilyId: validatedData.targetFamilyId,
      familyRole: (validatedData.familyRole as FamilyRole) || FamilyRole.MEMBER,
    });

    // If assigning as primary contact, ensure only one primary contact per family
    if (
      validatedData.familyRole === "PRIMARY_CONTACT" &&
      validatedData.userIds.length === 1
    ) {
      await familyRepository.setPrimaryContact(
        validatedData.targetFamilyId,
        validatedData.userIds[0],
      );
    }

    // Get the updated family to return
    const updatedFamily = await familyRepository.getFamilyById(
      validatedData.targetFamilyId,
    );

    console.log("✅ Bulk assignment completed successfully:", {
      assignedCount: validatedData.userIds.length,
      targetFamily: updatedFamily?.name,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${validatedData.userIds.length} members to ${updatedFamily?.name}`,
      family: {
        id: updatedFamily?.id,
        name: updatedFamily?.name,
        memberCount: updatedFamily?.members?.length || 0,
        members: updatedFamily?.members,
      },
    });
  } catch (error) {
    console.error("❌ Error performing bulk assignment:", error);

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
      { error: "Failed to perform bulk assignment" },
      { status: 500 },
    );
  }
}
