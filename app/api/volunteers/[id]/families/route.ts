import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// GET /api/volunteers/[id]/families - Get volunteer's assigned families
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Only ADMIN and the volunteer themselves can view assignments
    const { id: volunteerId } = await params;
    if (user.role !== UserRole.ADMIN && user.id !== volunteerId) {
      return NextResponse.json(
        { error: "You can only view your own family assignments" },
        { status: 403 }
      );
    }

    // Verify volunteer exists and has VOLUNTEER role
    const volunteer = await userRepository.getUserById(volunteerId);
    if (!volunteer) {
      return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
    }

    if (volunteer.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "User must have VOLUNTEER role" },
        { status: 400 }
      );
    }

    console.log("👥 Getting volunteer's assigned families:", {
      volunteerId,
      requestedBy: user.id,
    });

    // Get families assigned to this volunteer
    const families = await familyRepository.getFamiliesByVolunteer(volunteerId);

    // Get detailed assignment information
    const assignments = await familyRepository.getVolunteerFamilyAssignments(volunteerId);

    // Combine family data with assignment details
    const formattedAssignments = families.map((family) => {
      const assignment = assignments.find(a => a.family.id === family.id);

      return {
        id: family.id,
        name: family.name,
        description: family.description,
        memberCount: family.members?.length || 0,
        createdAt: family.createdAt,
        assignment: assignment ? {
          assignedAt: assignment.assignedAt,
          role: assignment.role,
          assignedBy: assignment.assigner ? {
            id: assignment.assigner.id,
            name: `${assignment.assigner.firstName} ${assignment.assigner.lastName}`.trim() || assignment.assigner.email,
          } : null,
        } : null,
      };
    });

    console.log("✅ Volunteer's assigned families retrieved:", {
      volunteerId,
      familyCount: formattedAssignments.length,
    });

    return NextResponse.json({
      volunteer: {
        id: volunteer.id,
        name: `${volunteer.firstName} ${volunteer.lastName}`.trim() || volunteer.email,
        email: volunteer.email,
      },
      families: formattedAssignments,
      total: formattedAssignments.length,
    });
  } catch (error) {
    console.error("❌ Error fetching volunteer's families:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteer's assigned families" },
      { status: 500 }
    );
  }
}