import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { UserRole as AppUserRole } from "@/lib/auth/roles";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import type { UserFilters } from "@/lib/types/api";

const userRepository = new UserRepository();

// GET /api/users/search - Search users with filtering for combobox components
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user from database to check role and apply permissions
    const currentUser = await userRepository.getUserByClerkId(userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN and VOLUNTEER can search users (MEMBER users typically shouldn't access this)
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    console.log("🔍 GET /api/users/search - User:", {
      role: currentUser.role,
      email: currentUser.email,
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() || "";
    const familyOnly = searchParams.get("familyOnly") === "true";
    const excludeSelf = searchParams.get("excludeSelf") === "true";
    const rolesParam = searchParams.get("roles");
    const limitParam = parseInt(searchParams.get("limit") || "15", 10);

    // Parse roles filter
    let roleFilter: UserRole[] | undefined;
    if (rolesParam) {
      const roles = rolesParam.split(",").filter(role =>
        ["ADMIN", "VOLUNTEER", "MEMBER"].includes(role)
      ) as UserRole[];
      if (roles.length > 0) {
        roleFilter = roles;
      }
    }

    console.log("🔍 Search parameters:", {
      query,
      familyOnly,
      excludeSelf,
      roles: roleFilter,
      limit: limitParam
    });

    // Build filters object
    const filters: UserFilters = {};

    // Apply role-based restrictions
    if (currentUser.role === UserRole.VOLUNTEER) {
      // Volunteers can only see MEMBER users and their families
      if (familyOnly) {
        // Only users in families created by this volunteer
        filters.createdById = currentUser.id;
      } else {
        // Restrict to MEMBER role unless specific roles requested
        if (!roleFilter || roleFilter.includes(UserRole.MEMBER)) {
          filters.role = UserRole.MEMBER as AppUserRole;
        } else {
          // Volunteer trying to access non-MEMBER roles - return empty
          return NextResponse.json({ users: [] });
        }
      }
    } else if (roleFilter && roleFilter.length > 0) {
      // Admin can filter by any roles
      if (roleFilter.length === 1) {
        filters.role = roleFilter[0] as AppUserRole;
      }
      // For multiple roles, we'll filter after fetching
    }

    // Family-only filter for volunteers will be handled during post-filtering

    // Get users from database - convert filters to match repository expectations
    const repoFilters = {
      role: filters.role as AppUserRole | undefined,
      familyId: filters.familyId,
      createdById: filters.createdById,
    };
    let users = await userRepository.getAllUsers(repoFilters);

    // Apply family-only filter if needed (volunteers can only see users in families they created)
    if (familyOnly && currentUser.role === UserRole.VOLUNTEER) {
      users = users.filter(u => {
        return u.family && u.family.createdById === currentUser.id;
      });
    }

    // Apply multiple roles filter if needed
    if (roleFilter && roleFilter.length > 1) {
      users = users.filter(u => roleFilter.includes(u.role as UserRole));
    }

    // Exclude current user if requested
    if (excludeSelf) {
      users = users.filter(u => u.id !== currentUser.id);
    }

    // Apply search query if provided
    if (query) {
      const searchLower = query.toLowerCase();
      users = users.filter(u => {
        const firstName = (u.firstName || "").toLowerCase();
        const lastName = (u.lastName || "").toLowerCase();
        const email = u.email.toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          email.includes(searchLower) ||
          fullName.includes(searchLower)
        );
      });
    }

    // Apply limit
    users = users.slice(0, limitParam);

    console.log("✅ Users search results:", {
      count: users.length,
      query,
      filters: filters
    });

    // Format response for UserCombobox
    const formattedUsers = users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role as AppUserRole,
      familyId: u.familyId,
      familyName: u.family?.name,
      // Note: imageUrl is not in our User model currently, but UserCombobox expects it
      // We could add it in the future or leave it undefined
    }));

    return NextResponse.json({
      users: formattedUsers,
      count: formattedUsers.length
    });

  } catch (error) {
    console.error("❌ Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 },
    );
  }
}