import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@/lib/auth/roles";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";

const userRepository = new UserRepository();
const familyRepository = new FamilyRepository();

// GET /api/users/chat-accessible - Get users that the current member can start conversations with
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

    console.log("🔍 Chat-accessible users request:", {
      requestedBy: currentUser.email,
      role: currentUser.role,
      familyId: currentUser.familyId,
    });

    let accessibleUsers: any[] = [];

    if (currentUser.role === UserRole.MEMBER) {
      // For MEMBERS: Can chat with admins, volunteers, and their family members

      // Get admins and volunteers separately (getUserAll expects single role)
      const [adminUsers, volunteerUsers] = await Promise.all([
        userRepository.getAllUsers({ role: UserRole.ADMIN }),
        userRepository.getAllUsers({ role: UserRole.VOLUNTEER })
      ]);

      // Get family members if user is in a family
      let familyMembers: any[] = [];
      if (currentUser.familyId) {
        const family = await familyRepository.getFamilyById(currentUser.familyId);
        if (family?.members) {
          familyMembers = family.members
            .filter((member: any) => member.id !== currentUser.id) // Exclude self
            .map((member: any) => ({
              ...member,
              category: 'family' // Add category for UI grouping
            }));
        }
      }

      // Combine all accessible users
      accessibleUsers = [
        ...adminUsers.map((user: any) => ({
          ...user,
          category: 'admin'
        })),
        ...volunteerUsers.map((user: any) => ({
          ...user,
          category: 'volunteer'
        })),
        ...familyMembers
      ];

    } else if (currentUser.role === UserRole.VOLUNTEER) {
      // For VOLUNTEERS: Can chat with everyone (existing behavior)
      const allUsers = await userRepository.getAllUsers({});
      accessibleUsers = allUsers.filter((user: any) => user.id !== currentUser.id);

    } else if (currentUser.role === UserRole.ADMIN) {
      // For ADMINS: Can chat with everyone (existing behavior)
      const allUsers = await userRepository.getAllUsers({});
      accessibleUsers = allUsers.filter((user: any) => user.id !== currentUser.id);
    }

    // Format users for chat interface
    const formattedUsers = accessibleUsers.map((user: any) => ({
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
      familyId: user.familyId,
      category: user.category || 'other', // For UI grouping
      createdAt: user.createdAt,
    }));

    console.log("✅ Chat-accessible users retrieved:", {
      totalUsers: formattedUsers.length,
      breakdown: {
        admins: formattedUsers.filter(u => u.category === 'admin').length,
        volunteers: formattedUsers.filter(u => u.category === 'volunteer').length,
        family: formattedUsers.filter(u => u.category === 'family').length,
        others: formattedUsers.filter(u => u.category === 'other').length,
      },
      sampleUsers: formattedUsers.slice(0, 3).map(u => ({
        name: u.name,
        email: u.email,
        role: u.role,
        category: u.category
      }))
    });

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length,
      currentUserRole: currentUser.role,
      message: `Found ${formattedUsers.length} users you can chat with`,
    });

  } catch (error) {
    console.error("❌ Error fetching chat-accessible users:", error);

    return NextResponse.json(
      { error: "Failed to fetch chat-accessible users" },
      { status: 500 }
    );
  }
}