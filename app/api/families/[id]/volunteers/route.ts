import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// Validation schema for assigning volunteer to family
const assignVolunteerSchema = z.object({
  volunteerId: z.string().min(1, "Volunteer ID is required"),
  role: z.string().optional().default("manager"),
});

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/families/[id]/volunteers - Assign volunteer to family
export async function POST(
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

    // Only ADMIN can assign volunteers to families
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only administrators can manage volunteer assignments" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const familyId = id;

    // Verify family exists
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = assignVolunteerSchema.parse(body);

    // Verify volunteer exists and has VOLUNTEER role
    const volunteer = await userRepository.getUserById(validatedData.volunteerId);
    if (!volunteer) {
      return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
    }

    if (volunteer.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "User must have VOLUNTEER role to be assigned to families" },
        { status: 400 }
      );
    }

    // Check if volunteer is already assigned to this family
    const isAlreadyAssigned = await familyRepository.isVolunteerAssignedToFamily(
      validatedData.volunteerId,
      familyId
    );

    if (isAlreadyAssigned) {
      return NextResponse.json(
        { error: "Volunteer is already assigned to this family" },
        { status: 400 }
      );
    }

    console.log("👥 Assigning volunteer to family:", {
      volunteerId: validatedData.volunteerId,
      familyId,
      assignedBy: user.id,
      role: validatedData.role,
    });

    // Assign volunteer to family
    await familyRepository.assignVolunteerToFamily(
      validatedData.volunteerId,
      familyId,
      user.id,
      validatedData.role
    );

    console.log("✅ Volunteer assigned to family successfully");

    return NextResponse.json({
      success: true,
      message: `${volunteer.firstName} ${volunteer.lastName} has been assigned to ${family.name}`,
      assignment: {
        volunteerId: validatedData.volunteerId,
        volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
        familyId,
        familyName: family.name,
        role: validatedData.role,
        assignedBy: user.id,
      },
    });
  } catch (error) {
    console.error("❌ Error assigning volunteer to family:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to assign volunteer to family" },
      { status: 500 }
    );
  }
}

// GET /api/families/[id]/volunteers - Get volunteers assigned to family
export async function GET(
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

    // Only ADMIN and VOLUNTEER can view family assignments
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const familyId = id;

    // Verify family exists
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // For volunteers, verify they have access to this family
    if (user.role === UserRole.VOLUNTEER) {
      const hasAccess = await familyRepository.isVolunteerAssignedToFamily(
        user.id,
        familyId
      );
      if (!hasAccess) {
        return NextResponse.json(
          { error: "You don't have access to this family" },
          { status: 403 }
        );
      }
    }

    // Get volunteers assigned to this family
    const volunteers = await familyRepository.getVolunteersForFamily(familyId);

    // Get detailed assignment information
    const assignments = await Promise.all(
      volunteers.map(async (volunteer) => {
        const assignmentDetails = await familyRepository.getVolunteerFamilyAssignments(volunteer.id);
        const thisAssignment = assignmentDetails.find(a => a.family.id === familyId);

        return {
          id: volunteer.id,
          name: `${volunteer.firstName} ${volunteer.lastName}`.trim() || volunteer.email,
          email: volunteer.email,
          assignedAt: thisAssignment?.assignedAt,
          role: thisAssignment?.role || "manager",
          assignedBy: thisAssignment?.assigner ? {
            id: thisAssignment.assigner.id,
            name: `${thisAssignment.assigner.firstName} ${thisAssignment.assigner.lastName}`.trim() || thisAssignment.assigner.email,
          } : null,
        };
      })
    );

    console.log("✅ Family volunteers retrieved:", {
      familyId,
      volunteerCount: assignments.length,
    });

    return NextResponse.json({
      family: {
        id: family.id,
        name: family.name,
      },
      volunteers: assignments,
      total: assignments.length,
    });
  } catch (error) {
    console.error("❌ Error fetching family volunteers:", error);
    return NextResponse.json(
      { error: "Failed to fetch family volunteers" },
      { status: 500 }
    );
  }
}