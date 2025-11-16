import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";

const userRepository = new UserRepository();
const familyRepository = new FamilyRepository();

// GET /api/families/member-accessible - Get families accessible to the current user for chat creation
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user from database
    const currentUser = await userRepository.getUserByClerkId(userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("👨‍👩‍👧‍👦 Member-accessible families request:", {
      requestedBy: currentUser.email,
      role: currentUser.role,
      familyId: currentUser.familyId,
    });

    let accessibleFamilies: any[] = [];

    if (currentUser.role === UserRole.MEMBER) {
      // Members can only access their own family for chat creation
      if (currentUser.familyId) {
        const family = await familyRepository.getFamilyById(currentUser.familyId);
        if (family) {
          accessibleFamilies = [{
            id: family.id,
            name: family.name,
            description: family.description,
            memberCount: family.members?.length || 0,
          }];
        }
      }
    } else if (currentUser.role === UserRole.VOLUNTEER) {
      // Volunteers can access families they created
      const families = await familyRepository.getFamiliesByCreator(currentUser.id);
      accessibleFamilies = families.map((family: any) => ({
        id: family.id,
        name: family.name,
        description: family.description,
        memberCount: family.members?.length || 0,
      }));
    } else if (currentUser.role === UserRole.ADMIN) {
      // Admins can access all families
      const families = await familyRepository.getAllFamilies();
      accessibleFamilies = families.map((family: any) => ({
        id: family.id,
        name: family.name,
        description: family.description,
        memberCount: family.members?.length || 0,
      }));
    }

    console.log("✅ Member-accessible families retrieved:", {
      totalFamilies: accessibleFamilies.length,
      userRole: currentUser.role,
      userFamilyId: currentUser.familyId,
      families: accessibleFamilies.map(f => ({ id: f.id, name: f.name, memberCount: f.memberCount }))
    });

    return NextResponse.json({
      success: true,
      families: accessibleFamilies,
      total: accessibleFamilies.length,
      currentUserRole: currentUser.role,
      message: `Found ${accessibleFamilies.length} families you can create chats for`,
    });

  } catch (error) {
    console.error("❌ Error fetching member-accessible families:", error);

    return NextResponse.json(
      { error: "Failed to fetch member-accessible families" },
      { status: 500 }
    );
  }
}