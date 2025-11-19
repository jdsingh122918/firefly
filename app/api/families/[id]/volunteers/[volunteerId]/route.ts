import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

interface RouteParams {
  params: Promise<{
    id: string;
    volunteerId: string;
  }>;
}

// DELETE /api/families/[id]/volunteers/[volunteerId] - Remove volunteer assignment from family
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
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

    // Only ADMIN can remove volunteer assignments
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only administrators can manage volunteer assignments" },
        { status: 403 }
      );
    }

    const { id, volunteerId } = await params;
    const familyId = id;

    // Verify family exists
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify volunteer exists
    const volunteer = await userRepository.getUserById(volunteerId);
    if (!volunteer) {
      return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
    }

    // Check if volunteer is assigned to this family
    const isAssigned = await familyRepository.isVolunteerAssignedToFamily(
      volunteerId,
      familyId
    );

    if (!isAssigned) {
      return NextResponse.json(
        { error: "Volunteer is not assigned to this family" },
        { status: 400 }
      );
    }

    console.log("👥 Removing volunteer from family:", {
      volunteerId,
      familyId,
      removedBy: user.id,
    });

    // Remove volunteer assignment
    await familyRepository.removeVolunteerFromFamily(volunteerId, familyId);

    console.log("✅ Volunteer removed from family successfully");

    return NextResponse.json({
      success: true,
      message: `${volunteer.firstName} ${volunteer.lastName} has been removed from ${family.name}`,
      assignment: {
        volunteerId,
        volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
        familyId,
        familyName: family.name,
        removedBy: user.id,
      },
    });
  } catch (error) {
    console.error("❌ Error removing volunteer from family:", error);
    return NextResponse.json(
      { error: "Failed to remove volunteer from family" },
      { status: 500 }
    );
  }
}