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

    // Get Clerk user info
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    }).then((res) => res.json());

    // Use upsert to atomically create or update user (prevents race conditions)
    const { user, created } = await userRepository.upsertUser({
      clerkId: userId,
      email:
        clerkUser.email_addresses[0]?.email_address || "unknown@example.com",
      firstName: clerkUser.first_name,
      lastName: clerkUser.last_name,
      role: UserRole.MEMBER, // Default to MEMBER role for new users
    });

    return NextResponse.json({
      message: created ? "User synced successfully" : "User already exists",
      user,
      created,
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
