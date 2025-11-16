import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { UserRole as AppUserRole } from "@/lib/auth/roles";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import type { UserFilters, ClerkError } from "@/lib/types/api";

const userRepository = new UserRepository();
const familyRepository = new FamilyRepository();

// Validation schema for creating a user
const createUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .optional(),
  lastName: z
    .string()
    .max(50, "Last name must be less than 50 characters")
    .optional(),
  role: z.enum(["ADMIN", "VOLUNTEER", "MEMBER"], {
    message: "Role must be ADMIN, VOLUNTEER, or MEMBER",
  }),
  familyId: z.string().optional(),
});

// GET /api/users - List users with filtering
export async function GET(request: NextRequest) {
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

    // Only ADMIN and VOLUNTEER can view users
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    console.log("👥 GET /api/users - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const familyId = searchParams.get("familyId");
    const search = searchParams.get("search");
    const withoutFamily = searchParams.get("withoutFamily") === "true";

    // Build filters object
    const filters: UserFilters = {};

    if (role && ["ADMIN", "VOLUNTEER", "MEMBER"].includes(role)) {
      filters.role = role as UserRole;
    }

    if (familyId) {
      filters.familyId = familyId;
    }

    // Note: withoutFamily flag will be handled after fetching users

    // If volunteer, only show users they can manage
    if (user.role === UserRole.VOLUNTEER) {
      // Volunteers can only see MEMBER users and their own profile
      if (!role || role === "MEMBER") {
        filters.role = UserRole.MEMBER;
      } else if (role === "VOLUNTEER" || role === "ADMIN") {
        // Volunteers can't see other volunteers or admins (except in some contexts)
        // For now, allow but could be restricted
      }
    }

    console.log("🔍 User filters applied:", { filters, search });

    // Convert filters to use AppUserRole
    const repoFilters = {
      ...filters,
      role: filters.role as AppUserRole | undefined,
    };

    // Get users from database
    let users = await userRepository.getAllUsers(repoFilters);

    // VOLUNTEER family-scoped filtering: only show users from families they created
    if (user.role === UserRole.VOLUNTEER) {
      // Get families that this volunteer created
      const volunteerFamilies = await familyRepository.getFamiliesByCreator(user.id);
      const accessibleFamilyIds = volunteerFamilies.map(f => f.id);

      console.log("🔒 VOLUNTEER family filtering:", {
        volunteerId: user.id,
        accessibleFamilyIds,
        totalUsersBeforeFilter: users.length
      });

      // Filter users to only include those from accessible families
      users = users.filter((u) => {
        if (!u.familyId) return false; // Volunteers can't see users without families
        return accessibleFamilyIds.includes(u.familyId);
      });

      console.log("🔒 VOLUNTEER family filtering applied:", {
        usersAfterFilter: users.length
      });
    }

    // Filter users without family if requested
    if (withoutFamily) {
      users = users.filter((u) => !u.familyId);
    }

    // Apply search filter if provided
    if (search && users.length > 0) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(searchLower) ||
          (u.firstName && u.firstName.toLowerCase().includes(searchLower)) ||
          (u.lastName && u.lastName.toLowerCase().includes(searchLower)),
      );
    }

    console.log("✅ Users retrieved:", { count: users.length, filters });

    // Format response
    const formattedUsers = users.map((u) => ({
      id: u.id,
      clerkId: u.clerkId,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name: u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.email,
      role: u.role,
      familyId: u.familyId,
      family: u.family
        ? {
            id: u.family.id,
            name: u.family.name,
          }
        : null,
      phoneNumber: u.phoneNumber,
      phoneVerified: u.phoneVerified,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      createdBy: u.createdBy
        ? {
            id: u.createdBy.id,
            name: u.createdBy.firstName
              ? `${u.createdBy.firstName} ${u.createdBy.lastName || ""}`.trim()
              : u.createdBy.email,
          }
        : null,
    }));

    return NextResponse.json({
      users: formattedUsers,
      total: formattedUsers.length,
      filters: {
        role: role || null,
        familyId: familyId || null,
        search: search || null,
        withoutFamily,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

// POST /api/users - Create new user with Clerk invitation
export async function POST(request: NextRequest) {
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

    // Check permissions based on role
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Role-based creation permissions
    if (user.role === UserRole.VOLUNTEER) {
      // Volunteers can only create MEMBER users
      if (validatedData.role !== "MEMBER") {
        return NextResponse.json(
          {
            error: "Volunteers can only create MEMBER users",
          },
          { status: 403 },
        );
      }
    } else if (user.role !== UserRole.ADMIN) {
      // Only ADMIN and VOLUNTEER can create users
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    console.log("👤 Creating user:", {
      email: validatedData.email,
      role: validatedData.role,
      createdBy: user.email,
    });

    // Check if email already exists in our database
    const existingUser = await userRepository.getUserByEmail(
      validatedData.email,
    );
    if (existingUser) {
      return NextResponse.json(
        {
          error: "User with this email already exists",
        },
        { status: 400 },
      );
    }

    // Create user in Clerk first
    const client = await clerkClient();
    const clerkUser = await client.users.createUser({
      emailAddress: [validatedData.email],
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      publicMetadata: {
        role: validatedData.role,
      },
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });

    console.log("✅ User created in Clerk:", {
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress,
    });

    // Create user in our database
    const dbUser = await userRepository.createUser({
      clerkId: clerkUser.id,
      email: validatedData.email,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      role: validatedData.role as AppUserRole,
      familyId: validatedData.familyId,
      createdById: user.id
    });

    console.log("✅ User created in database:", { userId: dbUser.id });

    // Create invitation (Clerk will send email automatically when user tries to sign in)
    // We could also use clerkClient.invitations.createInvitation() for more control

    return NextResponse.json(
      {
        success: true,
        user: {
          id: dbUser.id,
          clerkId: dbUser.clerkId,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          name: dbUser.firstName
            ? `${dbUser.firstName} ${dbUser.lastName || ""}`.trim()
            : dbUser.email,
          role: dbUser.role,
          familyId: dbUser.familyId,
          createdAt: dbUser.createdAt,
        },
        message:
          "User created successfully. They will receive a sign-in link when they try to access the platform.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating user:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    // Handle Clerk-specific errors
    if (error && typeof error === "object" && "errors" in error) {
      const clerkError = error as ClerkError;
      if (clerkError.errors?.[0]?.code === "form_identifier_exists") {
        return NextResponse.json(
          {
            error: "A user with this email already exists",
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
