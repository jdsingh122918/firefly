import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { UserRole } from "@/lib/auth/roles";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userRepository = new UserRepository();

    // Check if user already exists
    const existingUser = await userRepository.getUserByClerkId(userId);

    if (existingUser) {
      return NextResponse.json({
        message: "User already exists",
        user: existingUser,
      });
    }

    // Get Clerk user info
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    }).then((res) => res.json());

    // Create user in database with ADMIN role (since you need admin access)
    const newUser = await userRepository.createUser({
      clerkId: userId,
      email:
        clerkUser.email_addresses[0]?.email_address || "unknown@example.com",
      firstName: clerkUser.first_name,
      lastName: clerkUser.last_name,
      role: UserRole.ADMIN, // Setting as ADMIN so you can access admin features
    });

    return NextResponse.json({
      message: "User synced successfully",
      user: newUser,
      clerkUser: {
        id: clerkUser.id,
        email: clerkUser.email_addresses[0]?.email_address,
        firstName: clerkUser.first_name,
        lastName: clerkUser.last_name,
      },
    });
  } catch (error) {
    console.error("User sync error:", error);
    return NextResponse.json(
      {
        error: "Failed to sync user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
