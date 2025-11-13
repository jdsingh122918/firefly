import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// Validation schema for setting primary contact
const setPrimaryContactSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// PUT /api/families/[id]/primary-contact - Set primary contact for a family
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    const familyId = id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN and VOLUNTEER can set primary contact
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = setPrimaryContactSchema.parse(body);

    console.log("👥 Setting primary contact:", {
      familyId,
      contactUserId: validatedData.userId,
      setBy: user.email,
    });

    // Verify the family exists
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify the user is a member of this family
    const targetUser = await userRepository.getUserById(validatedData.userId);
    if (!targetUser || targetUser.familyId !== familyId) {
      return NextResponse.json(
        { error: "User is not a member of this family" },
        { status: 400 },
      );
    }

    // Set primary contact
    const updatedFamily = await familyRepository.setPrimaryContact(
      familyId,
      validatedData.userId,
    );

    console.log("✅ Primary contact set successfully:", {
      familyId,
      primaryContactId: updatedFamily.primaryContactId,
    });

    return NextResponse.json({
      success: true,
      family: {
        id: updatedFamily.id,
        name: updatedFamily.name,
        primaryContactId: updatedFamily.primaryContactId,
        members: updatedFamily.members,
      },
      message: "Primary contact set successfully",
    });
  } catch (error) {
    console.error("❌ Error setting primary contact:", error);

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
      { error: "Failed to set primary contact" },
      { status: 500 },
    );
  }
}
