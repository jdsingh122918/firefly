import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { UserRole } from "@/lib/auth/roles";

const userRepository = new UserRepository();

export async function GET() {
  try {
    // Verify user is authenticated and has appropriate role
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract user role from session claims
    const userRole = (sessionClaims?.metadata as { role?: string })?.role as UserRole;

    // Only allow ADMIN and VOLUNTEER to access stats
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Forbidden - insufficient permissions" },
        { status: 403 },
      );
    }

    // Get user statistics from repository
    const stats = await userRepository.getUserStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
