import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();

// GET /api/users/unassigned - Get users not assigned to any family
export async function GET() {
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

    // Only ADMIN and VOLUNTEER can view unassigned users
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    console.log("👥 Getting unassigned members:", {
      requestedBy: user.email,
      role: user.role,
    });

    // Get unassigned members
    const unassignedUsers = await familyRepository.getUnassignedMembers();

    // Enhance user data for easier consumption
    const enhancedUsers = unassignedUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      familyRole: user.familyRole,
      phoneNumber: user.phoneNumber,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      familyId: user.familyId,
    }));

    console.log("✅ Unassigned members retrieved:", {
      count: enhancedUsers.length,
    });

    return NextResponse.json({
      success: true,
      users: enhancedUsers,
      total: enhancedUsers.length,
      message: `Found ${enhancedUsers.length} unassigned members`,
    });
  } catch (error) {
    console.error("❌ Error fetching unassigned users:", error);

    return NextResponse.json(
      { error: "Failed to fetch unassigned users" },
      { status: 500 },
    );
  }
}
