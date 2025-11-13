import { GraphQLError } from "graphql";
import { GraphQLContext } from "../context";

export const familyResolvers = {
  Query: {
    /**
     * Get family by ID
     */
    family: async (
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

      const family = await context.familyRepository.getFamilyById(id);

      if (!family) {
        throw new GraphQLError("Family not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Permission check
      if (context.user.role === "MEMBER") {
        // Members can only see their own family
        if (context.user.familyId !== id) {
          throw new GraphQLError("Access denied", {
            extensions: { code: "FORBIDDEN" },
          });
        }
      } else if (context.user.role === "VOLUNTEER") {
        // Volunteers can only see families they created
        if (family.createdById !== context.user.id) {
          throw new GraphQLError("Access denied", {
            extensions: { code: "FORBIDDEN" },
          });
        }
      }
      // Admins can see all families

      return family;
    },

    /**
     * Get all families (admin only, or filtered for other roles)
     */
    families: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      if (context.user.role === "ADMIN") {
        // Admins can see all families
        return context.familyRepository.getAllFamilies();
      } else if (context.user.role === "VOLUNTEER") {
        // Volunteers can see families they created
        return context.familyRepository.getFamiliesByCreator(context.user.id);
      } else {
        // Members cannot list families
        throw new GraphQLError("Access denied", {
          extensions: { code: "FORBIDDEN" },
        });
      }
    },

    /**
     * Get families created by current user
     */
    myFamilies: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Only admins and volunteers can create families
      if (context.user.role === "MEMBER") {
        throw new GraphQLError("Members cannot create families", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return context.familyRepository.getFamiliesByCreator(context.user.id);
    },

    /**
     * Get family statistics (admin only)
     */
    familyStats: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
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

      return context.familyRepository.getFamilyStats();
    },
  },

  Mutation: {
    /**
     * Create a new family (admin/volunteer only)
     */
    createFamily: async (
      _parent: unknown,
      { input }: { input: { name: string; description?: string } },
      context: GraphQLContext,
    ) => {
      // Check authentication
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Only admins and volunteers can create families
      if (context.user.role === "MEMBER") {
        throw new GraphQLError("Members cannot create families", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      try {
        const family = await context.familyRepository.createFamily({
          name: input.name,
          description: input.description,
          createdById: context.user.id,
        });

        return {
          family,
          success: true,
          message: "Family created successfully",
        };
      } catch (error) {
        console.error("Error creating family:", error);
        throw new GraphQLError("Failed to create family", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Update family
     */
    updateFamily: async (
      _parent: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: { name?: string; description?: string };
      },
      context: GraphQLContext,
    ) => {
      // Check authentication
      if (!context.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Check if family exists
      const family = await context.familyRepository.getFamilyById(id);
      if (!family) {
        throw new GraphQLError("Family not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Permission check - only family creator or admin can update
      if (
        context.user.role !== "ADMIN" &&
        family.createdById !== context.user.id
      ) {
        throw new GraphQLError("Access denied", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      try {
        return context.familyRepository.updateFamily(id, input);
      } catch (error) {
        console.error("Error updating family:", error);
        throw new GraphQLError("Failed to update family", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Delete family (admin only)
     */
    deleteFamily: async (
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

      // Only admins can delete families
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("Admin access required", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      try {
        const family = await context.familyRepository.getFamilyById(id);
        if (!family) {
          throw new GraphQLError("Family not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        await context.familyRepository.deleteFamily(id);
        return true;
      } catch (error) {
        console.error("Error deleting family:", error);
        throw new GraphQLError("Failed to delete family", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },

  // Field resolvers
  Family: {
    memberCount: (parent: { members?: unknown[] }) => {
      return parent.members ? parent.members.length : 0;
    },
  },
};
