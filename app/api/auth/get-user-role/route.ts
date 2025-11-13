import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Verify the request is from an authenticated user
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clerkId } = body;

    // For now, return a default role since we don't have user sync yet
    // This will be properly implemented in Phase 4 with webhooks

    // Try to find user in database
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId },
      });

      if (user) {
        return NextResponse.json({ role: user.role });
      }
    } catch {
      // Database might not be connected yet, continue with default
      console.log("Database not connected yet, using default role");
    }

    // For Phase 1, default to MEMBER role for new users
    // This will trigger the middleware to handle role assignment
    return NextResponse.json({ role: null });
  } catch (error) {
    console.error("Error getting user role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
