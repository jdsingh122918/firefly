import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import {
  AccessLevel,
  ResourceType,
  accessControl,
  createAccessContext,
} from "./access-control.service";
import type { User } from "@/lib/types";

const userRepository = new UserRepository();

// Type for route params
type RouteParams = Record<string, string | string[] | undefined>;

// Type for resource data
type ResourceData = {
  uploadedBy?: string;
  createdBy?: string;
  familyId?: string;
  isPublic?: boolean;
} | null;

// Type for access context
type AccessContext = {
  user: User;
  resource?: ResourceData;
  accessContext: ReturnType<typeof createAccessContext>;
};

// Access control middleware configuration
export interface AccessControlConfig {
  resourceType: ResourceType;
  operation: "create" | "read" | "update" | "delete";
  // Optional function to extract resource data from the request
  getResourceData?: (
    request: NextRequest,
    params: RouteParams,
  ) => Promise<ResourceData>;
  // Optional custom access check
  customCheck?: (context: AccessContext) => boolean;
  // Whether to allow access if resource is not found (useful for create operations)
  allowIfResourceNotFound?: boolean;
}

// Middleware function for protecting API routes
export function withAccessControl(config: AccessControlConfig) {
  return function (
    handler: (
      request: NextRequest,
      context: { params: RouteParams; user: User; resource?: ResourceData },
    ) => Promise<NextResponse>,
  ) {
    return async function (
      request: NextRequest,
      context: { params: RouteParams },
    ): Promise<NextResponse> {
      try {
        // Get authenticated user
        const { userId } = await auth();

        if (!userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user from database
        const user = await userRepository.getUserByClerkId(userId);
        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 },
          );
        }

        // Get resource data if function is provided
        let resourceData = null;
        if (config.getResourceData) {
          try {
            resourceData = await config.getResourceData(
              request,
              context.params,
            );
          } catch {
            if (!config.allowIfResourceNotFound) {
              return NextResponse.json(
                { error: "Resource not found" },
                { status: 404 },
              );
            }
          }
        }

        // Create access context
        const accessContext = createAccessContext(
          {
            id: user.id,
            role: user.role,
            familyId: user.familyId || undefined,
            familyRole: user.familyRole || undefined,
          },
          resourceData || undefined,
        );

        // Determine required access level based on operation
        const requiredLevel = getRequiredLevelForOperation(config.operation);

        // Check access
        const hasAccess = accessControl.hasAccess(
          accessContext,
          config.resourceType,
          requiredLevel,
        );

        // Run custom check if provided
        if (config.customCheck) {
          const customResult = config.customCheck({
            user,
            resource: resourceData,
            accessContext,
          });
          if (!customResult) {
            return NextResponse.json(
              { error: "Access denied: Custom check failed" },
              { status: 403 },
            );
          }
        }

        if (!hasAccess) {
          const accessDetails = accessControl.getAccessDetails(
            accessContext,
            config.resourceType,
          );

          console.log("❌ Access denied:", {
            userId: user.id,
            userRole: user.role,
            resourceType: config.resourceType,
            operation: config.operation,
            requiredLevel,
            userAccessLevel: accessDetails.accessLevel,
            matchedRules: accessDetails.matchedRules.map((r) => r.description),
          });

          return NextResponse.json(
            { error: "Access denied: Insufficient permissions" },
            { status: 403 },
          );
        }

        // Access granted - call the original handler
        return handler(request, {
          params: context.params,
          user,
          resource: resourceData,
        });
      } catch (error) {
        console.error("❌ Access control middleware error:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    };
  };
}

// Helper function to get required access level for operations
function getRequiredLevelForOperation(operation: string): AccessLevel {
  switch (operation) {
    case "create":
    case "update":
      return AccessLevel.WRITE;
    case "delete":
      return AccessLevel.DELETE;
    case "read":
      return AccessLevel.READ;
    default:
      return AccessLevel.NONE;
  }
}

// Specialized middleware for document operations
export function withDocumentAccess(
  operation: "create" | "read" | "update" | "delete",
  getDocumentId?: (params: RouteParams) => string,
) {
  return withAccessControl({
    resourceType: ResourceType.DOCUMENT,
    operation,
    getResourceData: async (request, params) => {
      if (!getDocumentId) {
        return null; // For create operations
      }

      getDocumentId(params);

      // This would typically fetch from your document repository
      // For now, we'll return null and let the main handler deal with it
      return null;
    },
    allowIfResourceNotFound: operation === "create",
  });
}

// Specialized middleware for message operations
export function withMessageAccess(
  operation: "create" | "read" | "update" | "delete",
  getMessageId?: (params: RouteParams) => string,
) {
  return withAccessControl({
    resourceType: ResourceType.MESSAGE,
    operation,
    getResourceData: async (request, params) => {
      if (!getMessageId) {
        return null;
      }

      getMessageId(params);

      // This would fetch message data from your repository
      return null;
    },
    allowIfResourceNotFound: operation === "create",
  });
}

// Specialized middleware for family operations
export function withFamilyAccess(
  operation: "create" | "read" | "update" | "delete",
  getFamilyId?: (params: RouteParams) => string,
) {
  return withAccessControl({
    resourceType: ResourceType.FAMILY,
    operation,
    getResourceData: async (request, params) => {
      if (!getFamilyId) {
        return null;
      }

      getFamilyId(params);

      // This would fetch family data from your repository
      return null;
    },
    allowIfResourceNotFound: operation === "create",
  });
}

// Middleware for admin-only operations
export function requireAdmin() {
  return function (
    handler: (
      request: NextRequest,
      context: { params: RouteParams; user: User },
    ) => Promise<NextResponse>,
  ) {
    return async function (
      request: NextRequest,
      context: { params: RouteParams },
    ): Promise<NextResponse> {
      try {
        const { userId } = await auth();

        if (!userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await userRepository.getUserByClerkId(userId);
        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 },
          );
        }

        if (user.role !== "ADMIN") {
          return NextResponse.json(
            { error: "Access denied: Admin privileges required" },
            { status: 403 },
          );
        }

        return handler(request, { params: context.params, user });
      } catch (error) {
        console.error("❌ Admin middleware error:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    };
  };
}

// Middleware for family admin operations
export function requireFamilyAdmin() {
  return function (
    handler: (
      request: NextRequest,
      context: { params: RouteParams; user: User },
    ) => Promise<NextResponse>,
  ) {
    return async function (
      request: NextRequest,
      context: { params: RouteParams },
    ): Promise<NextResponse> {
      try {
        const { userId } = await auth();

        if (!userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await userRepository.getUserByClerkId(userId);
        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 },
          );
        }

        const isFamilyAdmin =
          user.role === "ADMIN" ||
          user.familyRole === "FAMILY_ADMIN" ||
          user.familyRole === "PRIMARY_CONTACT";

        if (!isFamilyAdmin) {
          return NextResponse.json(
            { error: "Access denied: Family admin privileges required" },
            { status: 403 },
          );
        }

        return handler(request, { params: context.params, user });
      } catch (error) {
        console.error("❌ Family admin middleware error:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    };
  };
}

// Helper function to check if user has family access
export async function checkFamilyAccess(
  userId: string,
  familyId: string,
): Promise<boolean> {
  try {
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return false;
    }

    // Admin can access all families
    if (user.role === "ADMIN") {
      return true;
    }

    // User must be a member of the family
    return user.familyId === familyId;
  } catch (error) {
    console.error("❌ Family access check error:", error);
    return false;
  }
}

// Helper function to check if user owns a resource
export async function checkResourceOwnership(
  userId: string,
  resourceOwnerId: string,
): Promise<boolean> {
  try {
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return false;
    }

    // Admin can access all resources
    if (user.role === "ADMIN") {
      return true;
    }

    // User must own the resource
    return user.id === resourceOwnerId;
  } catch (error) {
    console.error("❌ Resource ownership check error:", error);
    return false;
  }
}

// Audit logging for access control events
export function logAccessEvent(
  type: "granted" | "denied" | "error",
  details: {
    userId?: string;
    userRole?: string;
    resourceType: ResourceType;
    operation: string;
    resourceId?: string;
    reason?: string;
  },
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    ...details,
  };

  console.log(`🔐 Access ${type}:`, logEntry);

  // In a production environment, you might want to:
  // 1. Send to a logging service
  // 2. Store in a database for audit trails
  // 3. Send alerts for suspicious activity
  // 4. Update user activity metrics
}
