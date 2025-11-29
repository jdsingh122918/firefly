import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { UserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

interface ClerkUser {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
}

interface UserRecord {
  id: string;
  clerkId: string;
  email: string;
  createdAt: Date;
}

interface DuplicateInfo {
  field: "clerkId" | "email";
  value: string;
  kept: { id: string; email: string; createdAt: string };
  removed: Array<{ id: string; email: string; createdAt: string }>;
}

interface OrphanedUserInfo {
  id: string;
  clerkId: string;
  email: string;
  createdAt: string;
}

/**
 * Fetch all users from Clerk API with pagination
 */
async function fetchAllClerkUsers(): Promise<ClerkUser[]> {
  const users: ClerkUser[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Clerk API error: ${response.status} ${response.statusText}`);
    }

    const batch = await response.json();
    users.push(...batch);

    if (batch.length < limit) break;
    offset += limit;
  }

  return users;
}

/**
 * Find duplicates by grouping on a field
 */
function findDuplicates(
  users: UserRecord[],
  groupByField: "clerkId" | "email"
): Map<string, UserRecord[]> {
  const groups = new Map<string, UserRecord[]>();

  for (const user of users) {
    const key = user[groupByField];
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(user);
  }

  // Filter to only groups with duplicates, sorted by createdAt (oldest first)
  const duplicates = new Map<string, UserRecord[]>();
  for (const [key, group] of groups) {
    if (group.length > 1) {
      group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      duplicates.set(key, group);
    }
  }

  return duplicates;
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify admin role
    const userRepository = new UserRepository();
    const dbUser = await userRepository.getUserByClerkId(userId);
    if (!dbUser || dbUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Parse dry-run parameter (default to true for safety)
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";

    // Step 1: Fetch all Clerk users
    const clerkUsers = await fetchAllClerkUsers();

    // Step 2: Sync missing users to database
    const created: Array<{ clerkId: string; email: string }> = [];

    for (const clerkUser of clerkUsers) {
      const email = clerkUser.email_addresses[0]?.email_address;
      if (!email) continue;

      const { user, created: wasCreated } = await userRepository.upsertUser({
        clerkId: clerkUser.id,
        email,
        firstName: clerkUser.first_name ?? undefined,
        lastName: clerkUser.last_name ?? undefined,
        role: UserRole.MEMBER,
      });

      if (wasCreated) {
        created.push({ clerkId: user.clerkId, email: user.email });
      }
    }

    // Step 3: Find duplicates in database
    const allDbUsers = await prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const clerkIdDuplicates = findDuplicates(allDbUsers, "clerkId");
    const emailDuplicates = findDuplicates(allDbUsers, "email");

    // Track IDs to delete and duplicate info for reporting
    const idsToDelete = new Set<string>();
    const duplicateDetails: DuplicateInfo[] = [];

    // Process clerkId duplicates
    for (const [clerkId, group] of clerkIdDuplicates) {
      const [keep, ...remove] = group;
      duplicateDetails.push({
        field: "clerkId",
        value: clerkId,
        kept: { id: keep.id, email: keep.email, createdAt: keep.createdAt.toISOString() },
        removed: remove.map((u) => ({
          id: u.id,
          email: u.email,
          createdAt: u.createdAt.toISOString(),
        })),
      });
      remove.forEach((u) => idsToDelete.add(u.id));
    }

    // Process email duplicates (skip already marked)
    for (const [email, group] of emailDuplicates) {
      const remaining = group.filter((u) => !idsToDelete.has(u.id));
      if (remaining.length > 1) {
        const [keep, ...remove] = remaining;
        duplicateDetails.push({
          field: "email",
          value: email,
          kept: { id: keep.id, email: keep.email, createdAt: keep.createdAt.toISOString() },
          removed: remove.map((u) => ({
            id: u.id,
            email: u.email,
            createdAt: u.createdAt.toISOString(),
          })),
        });
        remove.forEach((u) => idsToDelete.add(u.id));
      }
    }

    // Step 3b: Find orphaned users (in DB but not in Clerk)
    const validClerkIds = new Set(clerkUsers.map(u => u.id));
    const orphanedUsers: OrphanedUserInfo[] = [];

    for (const dbUser of allDbUsers) {
      // Skip if already marked for deletion (duplicate)
      if (idsToDelete.has(dbUser.id)) continue;

      // If clerkId not in Clerk, it's orphaned
      if (!validClerkIds.has(dbUser.clerkId)) {
        orphanedUsers.push({
          id: dbUser.id,
          clerkId: dbUser.clerkId,
          email: dbUser.email,
          createdAt: dbUser.createdAt.toISOString(),
        });
        idsToDelete.add(dbUser.id);
      }
    }

    // Step 4: Delete duplicates and orphaned users (if not dry-run)
    let deletedCount = 0;
    if (!dryRun && idsToDelete.size > 0) {
      const deleteResult = await prisma.user.deleteMany({
        where: {
          id: { in: Array.from(idsToDelete) },
        },
      });
      deletedCount = deleteResult.count;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        clerkUsersFound: clerkUsers.length,
        usersCreated: created.length,
        duplicatesFound: duplicateDetails.reduce((acc, d) => acc + d.removed.length, 0),
        orphanedUsersFound: orphanedUsers.length,
        totalDeleted: dryRun ? 0 : deletedCount,
      },
      details: {
        created,
        duplicates: duplicateDetails,
        orphanedUsers,
      },
    });
  } catch (error) {
    console.error("Clerk sync error:", error);
    return NextResponse.json(
      {
        error: "Failed to sync Clerk users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
