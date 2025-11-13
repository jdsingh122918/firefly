import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const { userId } = await auth();

    // Get basic database counts
    const [userCount, familyCount, adminCount, volunteerCount, memberCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.family.count(),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.user.count({ where: { role: "VOLUNTEER" } }),
        prisma.user.count({ where: { role: "MEMBER" } }),
      ]);

    // Get current user info if authenticated
    let currentUser = null;
    if (userId) {
      currentUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          familyId: true,
          familyRole: true,
          createdAt: true,
        },
      });
    }

    // Get orphaned users (members without families)
    const orphanedUsers = await prisma.user.findMany({
      where: {
        AND: [{ role: "MEMBER" }, { familyId: null }],
      },
      select: {
        id: true,
        email: true,
        role: true,
        familyId: true,
        familyRole: true,
      },
      take: 10, // Limit to first 10 for debugging
    });

    // Get recent families (if any)
    const recentFamilies = await prisma.family.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: { members: true },
        },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      debug: {
        currentUserId: userId,
        currentUser,
        counts: {
          users: userCount,
          families: familyCount,
          admins: adminCount,
          volunteers: volunteerCount,
          members: memberCount,
          orphaned: orphanedUsers.length,
        },
        orphanedUsers,
        recentFamilies,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Database debug error:", error);
    return NextResponse.json(
      {
        error: "Database debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
