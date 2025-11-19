import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const userRepository = new UserRepository();

/**
 * GET /api/users/me - Get current user's profile with family information
 * Returns the authenticated user's data including their family relationship
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("👤 GET /api/users/me - User:", { clerkId: userId });

    // Get user from database with family information
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("✅ User retrieved:", {
      userId: user.id,
      email: user.email,
      role: user.role,
      hasFamily: !!user.family
    });

    // Format response to match what member content creation expects
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
        role: user.role,
        familyId: user.familyId,
        family: user.family
          ? {
              id: user.family.id,
              name: user.family.name,
            }
          : null,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.phoneVerified,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching current user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 },
    );
  }
}