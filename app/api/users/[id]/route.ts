import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { UserRole as AppUserRole } from "@/lib/auth/roles";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const userRepository = new UserRepository();

// Validation schema for updating a user
const updateUserSchema = z
  .object({
    firstName: z
      .string()
      .max(50, "First name must be less than 50 characters")
      .optional(),
    lastName: z
      .string()
      .max(50, "Last name must be less than 50 characters")
      .optional(),
    role: z.enum(["ADMIN", "VOLUNTEER", "MEMBER"]).optional(),
    familyId: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/users/[id] - Get specific user
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user from database to check role
    const currentUser = await userRepository.getUserByClerkId(userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN and VOLUNTEER can view user details, or users can view themselves
    const { id } = await params;
    const targetUserId = id;
    const isViewingSelf = currentUser.id === targetUserId;

    if (
      !isViewingSelf &&
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.VOLUNTEER
    ) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    console.log("👁️ GET /api/users/[id]:", {
      targetUserId,
      viewerRole: currentUser.role,
      isViewingSelf,
    });

    // Get target user
    const targetUser = await userRepository.getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Additional permission check for volunteers
    if (currentUser.role === UserRole.VOLUNTEER && !isViewingSelf) {
      // Volunteers can only view MEMBER users they created
      if (targetUser.role !== UserRole.MEMBER) {
        return NextResponse.json(
          { error: "Volunteers can only view member users" },
          { status: 403 },
        );
      }
      // Optionally: check if volunteer created this user
      // if (targetUser.createdById !== currentUser.id) {
      //   return NextResponse.json({ error: 'You can only view users you created' }, { status: 403 })
      // }
    }

    console.log("✅ User retrieved:", {
      targetUserId,
      email: targetUser.email,
      role: targetUser.role,
    });

    return NextResponse.json({
      user: {
        id: targetUser.id,
        clerkId: targetUser.clerkId,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        name: targetUser.firstName
          ? `${targetUser.firstName} ${targetUser.lastName || ""}`.trim()
          : targetUser.email,
        role: targetUser.role,
        familyId: targetUser.familyId,
        family: targetUser.family
          ? {
              id: targetUser.family.id,
              name: targetUser.family.name,
            }
          : null,
        phoneNumber: targetUser.phoneNumber,
        phoneVerified: targetUser.phoneVerified,
        emailVerified: targetUser.emailVerified,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
        createdBy: targetUser.createdBy
          ? {
              id: targetUser.createdBy.id,
              name: targetUser.createdBy.firstName
                ? `${targetUser.createdBy.firstName} ${targetUser.createdBy.lastName || ""}`.trim()
                : targetUser.createdBy.email,
              email: targetUser.createdBy.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 },
    );
  }
}

// PUT /api/users/[id] - Update specific user
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user from database to check role
    const currentUser = await userRepository.getUserByClerkId(userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const targetUserId = id;
    const isUpdatingSelf = currentUser.id === targetUserId;

    // Get target user
    const targetUser = await userRepository.getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Permission checks
    if (!isUpdatingSelf) {
      // Only ADMIN and VOLUNTEER can update other users
      if (
        currentUser.role !== UserRole.ADMIN &&
        currentUser.role !== UserRole.VOLUNTEER
      ) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }

      // Volunteers can only update MEMBER users they created
      if (currentUser.role === UserRole.VOLUNTEER) {
        if (targetUser.role !== UserRole.MEMBER) {
          return NextResponse.json(
            { error: "Volunteers can only update member users" },
            { status: 403 },
          );
        }
        // Check if trying to change role
        if (validatedData.role && validatedData.role !== "MEMBER") {
          return NextResponse.json(
            { error: "Volunteers cannot change user roles" },
            { status: 403 },
          );
        }
      }
    } else {
      // Users updating themselves have limited permissions
      if (validatedData.role && validatedData.role !== targetUser.role) {
        return NextResponse.json(
          { error: "You cannot change your own role" },
          { status: 403 },
        );
      }
    }

    // Additional role-specific validations
    if (validatedData.role) {
      // Only ADMIN can create other ADMIN users
      if (
        validatedData.role === "ADMIN" &&
        currentUser.role !== UserRole.ADMIN
      ) {
        return NextResponse.json(
          { error: "Only administrators can assign admin role" },
          { status: 403 },
        );
      }

      // Prevent changing the role of the last admin
      if (
        targetUser.role === UserRole.ADMIN &&
        validatedData.role !== "ADMIN"
      ) {
        const adminUsers = await userRepository.getUsersByRole(AppUserRole.ADMIN);
        if (adminUsers.length <= 1) {
          return NextResponse.json(
            {
              error: "Cannot change role of the last administrator",
            },
            { status: 400 },
          );
        }
      }
    }

    console.log("✏️ Updating user:", {
      targetUserId,
      data: validatedData,
      updatedBy: currentUser.email,
      isUpdatingSelf,
    });

    // Update user in database
    const updatedUser = await userRepository.updateUser(targetUserId, {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      phoneNumber: validatedData.phoneNumber,
      familyId: validatedData.familyId,
      role: validatedData.role as AppUserRole,
    });

    // Update role separately if provided (to sync with Clerk)
    if (validatedData.role && validatedData.role !== targetUser.role) {
      await userRepository.updateUserRole(
        targetUserId,
        validatedData.role as AppUserRole,
      );

      // Update role in Clerk metadata
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(targetUser.clerkId, {
          publicMetadata: {
            role: validatedData.role,
          },
        });
        console.log("✅ Role updated in Clerk metadata");
      } catch (clerkError) {
        console.error(
          "⚠️ Failed to update role in Clerk, but database updated:",
          clerkError,
        );
        // Don't fail the request, as database is updated
      }
    }

    console.log("✅ User updated successfully:", {
      targetUserId,
      email: updatedUser.email,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        familyId: updatedUser.familyId,
        phoneNumber: updatedUser.phoneNumber,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating user:", error);

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

    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}

// DELETE /api/users/[id] - Delete specific user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user from database to check role
    const currentUser = await userRepository.getUserByClerkId(userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN can delete users (for now)
    if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only administrators can delete users" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const targetUserId = id;

    // Prevent self-deletion
    if (currentUser.id === targetUserId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    // Get target user
    const targetUser = await userRepository.getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting the last admin
    if (targetUser.role === UserRole.ADMIN) {
      const adminUsers = await userRepository.getUsersByRole(AppUserRole.ADMIN);
      if (adminUsers.length <= 1) {
        return NextResponse.json(
          {
            error: "Cannot delete the last administrator",
          },
          { status: 400 },
        );
      }
    }

    console.log("🗑️ Deleting user:", {
      targetUserId,
      email: targetUser.email,
      role: targetUser.role,
      deletedBy: currentUser.email,
    });

    // Delete user from Clerk first
    try {
      const client = await clerkClient();
      await client.users.deleteUser(targetUser.clerkId);
      console.log("✅ User deleted from Clerk");
    } catch (clerkError) {
      console.error("⚠️ Failed to delete user from Clerk:", clerkError);
      // Continue with database deletion even if Clerk fails
    }

    // Delete user from database
    await userRepository.deleteUser(targetUserId);

    console.log("✅ User deleted successfully:", { targetUserId });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
