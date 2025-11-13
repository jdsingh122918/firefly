import { GraphQLError } from "graphql";
import { clerkClient } from "@clerk/nextjs/server";
import { GraphQLContext } from "../context";
import { canCreateUser, requiresFamilyAssignment } from "@/lib/auth/roles";
import { UserRole } from "@/lib/auth/roles";

export const userResolvers = {
  Query: {
    /**
     * Get current authenticated user
     */
    currentUser: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.user) {
        return null;
      }
      return context.user;
    },

    /**
     * Get user by ID
     */
    user: async (
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const user = await context.userRepository.getUserById(id);

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Permission check - users can only see their own data or admins can see all
      if (context.user.role !== "ADMIN" && context.user.id !== id) {
        throw new GraphQLError("Access denied", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return user;
    },

    /**
     * Get users with optional filters
     */
    users: async (
      _parent: unknown,
      {
        filters,
      }: {
        filters?: { role?: UserRole; familyId?: string; createdById?: string };
      },
      context: GraphQLContext,
    ) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Permission checks based on role
      if (context.user.role === "MEMBER") {
        // Members can only see users in their family
        if (!context.user.familyId) {
          return [];
        }
        return context.userRepository.getAllUsers({
          familyId: context.user.familyId,
        });
      } else if (context.user.role === "VOLUNTEER") {
        // Volunteers can see users they created and users in families they manage
        const volunteersFilter = {
          ...filters,
          createdById: context.user.id,
        };
        return context.userRepository.getAllUsers(volunteersFilter);
      } else {
        // Admins can see all users
        return context.userRepository.getAllUsers(filters);
      }
    },

    /**
     * Get user statistics (admin only)
     */
    userStats: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("Admin access required", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return context.userRepository.getUserStats();
    },
  },

  Mutation: {
    /**
     * Sign up with email verification code
     */
    signUpWithEmail: async (
      _parent: unknown,
      _args: { input: { email: string; verificationCode: string } },
      context: GraphQLContext,
    ) => {
      try {
        // This would typically be handled by Clerk's sign-in flow
        // For now, return a placeholder response
        return {
          user: context.user,
          success: true,
          message: "Email verification not implemented in GraphQL yet",
        };
      } catch {
        throw new GraphQLError("Sign up failed", {
          extensions: { code: "BAD_REQUEST" },
        });
      }
    },

    /**
     * Create a new user (admin/volunteer only)
     */
    createUser: async (
      _parent: unknown,
      {
        input,
      }: {
        input: {
          email: string;
          firstName?: string;
          lastName?: string;
          targetRole: UserRole;
          familyId?: string;
        };
      },
      context: GraphQLContext,
    ) => {
      // Check authentication
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Check permissions - can the current user create a user with the target role?
      if (!canCreateUser(context.user.role as UserRole, input.targetRole)) {
        throw new GraphQLError(
          `${context.user.role} cannot create ${input.targetRole} users`,
          { extensions: { code: "FORBIDDEN" } },
        );
      }

      // Auto-assign family for volunteer-created members
      let familyId = input.familyId;
      if (
        requiresFamilyAssignment(
          context.user.role as UserRole,
          input.targetRole,
        )
      ) {
        if (!context.user.familyId) {
          throw new GraphQLError(
            "Volunteer must be assigned to a family to create members",
            {
              extensions: { code: "BAD_REQUEST" },
            },
          );
        }
        familyId = context.user.familyId;
      }

      try {
        // Create user in Clerk first
        const clerkClientInstance = await clerkClient();
        const clerkUser = await clerkClientInstance.users.createUser({
          emailAddress: [input.email],
          firstName: input.firstName,
          lastName: input.lastName,
          publicMetadata: {
            role: input.targetRole,
            familyId,
          } as { role: string; familyId?: string },
          skipPasswordChecks: true, // Email verification only
        });

        // Create user in database
        const user = await context.userRepository.createUser({
          clerkId: clerkUser.id,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.targetRole,
          familyId,
          createdById: context.user.id,
        });

        return {
          user,
          success: true,
          message: "User created successfully",
        };
      } catch (error) {
        console.error("Error creating user:", error);
        throw new GraphQLError("Failed to create user", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Update user
     */
    updateUser: async (
      _parent: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          firstName?: string;
          lastName?: string;
          role?: UserRole;
          familyId?: string;
          phoneNumber?: string;
        };
      },
      context: GraphQLContext,
    ) => {
      // Check authentication
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Check if user exists
      const targetUser = await context.userRepository.getUserById(id);
      if (!targetUser) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Permission checks
      if (context.user.role !== "ADMIN" && context.user.id !== id) {
        throw new GraphQLError("Access denied", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      // Role change requires admin permission
      if (
        input.role &&
        input.role !== targetUser.role &&
        context.user.role !== "ADMIN"
      ) {
        throw new GraphQLError("Only admins can change user roles", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      try {
        // Update role in database first
        if (input.role) {
          await context.userRepository.updateUserRole(id, input.role);
        }

        // Update other fields
        // Note: This is a simplified implementation
        // In a real scenario, you'd want separate update methods for each field

        // Update Clerk metadata if role changed
        if (input.role && context.clerkUserId) {
          const clerkClientInstance = await clerkClient();
          await clerkClientInstance.users.updateUserMetadata(
            targetUser.clerkId,
            {
              publicMetadata: {
                role: input.role,
                familyId: input.familyId || targetUser.familyId,
              },
            },
          );
        }

        // Get updated user
        return context.userRepository.getUserById(id);
      } catch (error) {
        console.error("Error updating user:", error);
        throw new GraphQLError("Failed to update user", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Delete user (admin only)
     */
    deleteUser: async (
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) => {
      // Check authentication
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Only admins can delete users
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("Admin access required", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      try {
        const targetUser = await context.userRepository.getUserById(id);
        if (!targetUser) {
          throw new GraphQLError("User not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        // Delete from Clerk first
        const clerkClientInstance = await clerkClient();
        await clerkClientInstance.users.deleteUser(targetUser.clerkId);

        // Delete from database
        await context.userRepository.deleteUser(id);

        return true;
      } catch (error) {
        console.error("Error deleting user:", error);
        throw new GraphQLError("Failed to delete user", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Assign family to user
     */
    assignFamily: async (
      _parent: unknown,
      { userId, familyId }: { userId: string; familyId: string },
      context: GraphQLContext,
    ) => {
      // Check authentication
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Only admins can assign families
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("Admin access required", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      try {
        return context.userRepository.assignFamily(userId, familyId);
      } catch (error) {
        console.error("Error assigning family:", error);
        throw new GraphQLError("Failed to assign family", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },

  // Field resolvers
  User: {
    fullName: (parent: { firstName: string | null; lastName: string | null }) => {
      const { firstName, lastName } = parent;
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      }
      return firstName || lastName || null;
    },
  },
};
