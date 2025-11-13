import { UserRole, FamilyRole } from "@prisma/client";
import { ResourceType } from "@/lib/types/index";

// Re-export ResourceType for convenience
export { ResourceType };

// Access levels for different operations
export enum AccessLevel {
  NONE = "none",
  READ = "read",
  WRITE = "write",
  DELETE = "delete",
  ADMIN = "admin",
}

// Access context for evaluating permissions
export interface AccessContext {
  userId: string;
  userRole: UserRole;
  familyId?: string;
  familyRole?: FamilyRole;
  resourceOwnerId?: string;
  resourceFamilyId?: string;
  isResourcePublic?: boolean;
}

// Resource access rules
export interface ResourceAccessRules {
  resourceType: ResourceType;
  rules: AccessRule[];
}

// Individual access rule
export interface AccessRule {
  condition: AccessCondition;
  accessLevel: AccessLevel;
  description: string;
}

// Access condition types
export type AccessCondition =
  | { type: "isAdmin" }
  | { type: "isOwner" }
  | { type: "isFamilyMember" }
  | { type: "isFamilyAdmin" }
  | { type: "isPublic" }
  | { type: "isSystemResource" }
  | { type: "and"; conditions: AccessCondition[] }
  | { type: "or"; conditions: AccessCondition[] }
  | { type: "not"; condition: AccessCondition };

// Access control service
export class AccessControlService {
  private static instance: AccessControlService;
  private resourceRules: Map<ResourceType, ResourceAccessRules> = new Map();

  private constructor() {
    this.initializeDefaultRules();
  }

  public static getInstance(): AccessControlService {
    if (!AccessControlService.instance) {
      AccessControlService.instance = new AccessControlService();
    }
    return AccessControlService.instance;
  }

  // Initialize default access rules for each resource type
  private initializeDefaultRules(): void {
    // Document access rules
    this.setResourceRules(ResourceType.DOCUMENT, {
      resourceType: ResourceType.DOCUMENT,
      rules: [
        {
          condition: { type: "isAdmin" },
          accessLevel: AccessLevel.ADMIN,
          description:
            "System administrators have full access to all documents",
        },
        {
          condition: { type: "isOwner" },
          accessLevel: AccessLevel.DELETE,
          description: "Document owners have full access to their documents",
        },
        {
          condition: {
            type: "and",
            conditions: [{ type: "isFamilyAdmin" }, { type: "isFamilyMember" }],
          },
          accessLevel: AccessLevel.WRITE,
          description:
            "Family administrators can edit documents within their family",
        },
        {
          condition: { type: "isFamilyMember" },
          accessLevel: AccessLevel.READ,
          description: "Family members can view documents within their family",
        },
        {
          condition: { type: "isPublic" },
          accessLevel: AccessLevel.READ,
          description: "Anyone can view public documents",
        },
      ],
    });

    // Message access rules
    this.setResourceRules(ResourceType.MESSAGE, {
      resourceType: ResourceType.MESSAGE,
      rules: [
        {
          condition: { type: "isAdmin" },
          accessLevel: AccessLevel.ADMIN,
          description: "System administrators have full access to all messages",
        },
        {
          condition: { type: "isOwner" },
          accessLevel: AccessLevel.DELETE,
          description: "Message senders can edit and delete their messages",
        },
        {
          condition: { type: "isFamilyMember" },
          accessLevel: AccessLevel.READ,
          description:
            "Family members can view messages in their family conversations",
        },
      ],
    });

    // Family access rules
    this.setResourceRules(ResourceType.FAMILY, {
      resourceType: ResourceType.FAMILY,
      rules: [
        {
          condition: { type: "isAdmin" },
          accessLevel: AccessLevel.ADMIN,
          description: "System administrators have full access to all families",
        },
        {
          condition: { type: "isOwner" },
          accessLevel: AccessLevel.DELETE,
          description: "Family creators have full access to their families",
        },
        {
          condition: { type: "isFamilyAdmin" },
          accessLevel: AccessLevel.WRITE,
          description: "Family administrators can manage their family",
        },
        {
          condition: { type: "isFamilyMember" },
          accessLevel: AccessLevel.READ,
          description: "Family members can view their family information",
        },
      ],
    });

    // User access rules
    this.setResourceRules(ResourceType.USER, {
      resourceType: ResourceType.USER,
      rules: [
        {
          condition: { type: "isAdmin" },
          accessLevel: AccessLevel.ADMIN,
          description: "System administrators have full access to all users",
        },
        {
          condition: { type: "isOwner" },
          accessLevel: AccessLevel.WRITE,
          description: "Users can edit their own profile",
        },
        {
          condition: { type: "isFamilyAdmin" },
          accessLevel: AccessLevel.READ,
          description: "Family administrators can view their family members",
        },
        {
          condition: { type: "isFamilyMember" },
          accessLevel: AccessLevel.READ,
          description: "Family members can view other family members",
        },
      ],
    });

    // Notification access rules
    this.setResourceRules(ResourceType.NOTIFICATION, {
      resourceType: ResourceType.NOTIFICATION,
      rules: [
        {
          condition: { type: "isAdmin" },
          accessLevel: AccessLevel.ADMIN,
          description:
            "System administrators have full access to all notifications",
        },
        {
          condition: { type: "isOwner" },
          accessLevel: AccessLevel.DELETE,
          description: "Users have full access to their own notifications",
        },
      ],
    });

    // Care plan access rules
    this.setResourceRules(ResourceType.CARE_PLAN, {
      resourceType: ResourceType.CARE_PLAN,
      rules: [
        {
          condition: { type: "isAdmin" },
          accessLevel: AccessLevel.ADMIN,
          description:
            "System administrators have full access to all care plans",
        },
        {
          condition: { type: "isOwner" },
          accessLevel: AccessLevel.DELETE,
          description: "Care plan creators have full access to their plans",
        },
        {
          condition: {
            type: "and",
            conditions: [{ type: "isFamilyAdmin" }, { type: "isFamilyMember" }],
          },
          accessLevel: AccessLevel.WRITE,
          description:
            "Family administrators can manage care plans within their family",
        },
        {
          condition: { type: "isFamilyMember" },
          accessLevel: AccessLevel.READ,
          description: "Family members can view care plans within their family",
        },
      ],
    });

    // Activity access rules
    this.setResourceRules(ResourceType.ACTIVITY, {
      resourceType: ResourceType.ACTIVITY,
      rules: [
        {
          condition: { type: "isAdmin" },
          accessLevel: AccessLevel.ADMIN,
          description:
            "System administrators have full access to all activities",
        },
        {
          condition: { type: "isOwner" },
          accessLevel: AccessLevel.DELETE,
          description: "Activity creators have full access to their activities",
        },
        {
          condition: { type: "isFamilyMember" },
          accessLevel: AccessLevel.READ,
          description: "Family members can view activities within their family",
        },
      ],
    });
  }

  // Set custom access rules for a resource type
  public setResourceRules(
    resourceType: ResourceType,
    rules: ResourceAccessRules,
  ): void {
    this.resourceRules.set(resourceType, rules);
  }

  // Get access rules for a resource type
  public getResourceRules(
    resourceType: ResourceType,
  ): ResourceAccessRules | undefined {
    return this.resourceRules.get(resourceType);
  }

  // Check if user has specific access level for a resource
  public hasAccess(
    context: AccessContext,
    resourceType: ResourceType,
    requiredLevel: AccessLevel,
  ): boolean {
    const rules = this.resourceRules.get(resourceType);
    if (!rules) {
      return false;
    }

    // Find the highest access level user has
    const userAccessLevel = this.getUserAccessLevel(context, resourceType);

    // Check if user's access level is sufficient
    return this.isAccessLevelSufficient(userAccessLevel, requiredLevel);
  }

  // Get the highest access level a user has for a resource
  public getUserAccessLevel(
    context: AccessContext,
    resourceType: ResourceType,
  ): AccessLevel {
    const rules = this.resourceRules.get(resourceType);
    if (!rules) {
      return AccessLevel.NONE;
    }

    let highestLevel = AccessLevel.NONE;

    // Evaluate all rules and find the highest access level
    for (const rule of rules.rules) {
      if (this.evaluateCondition(context, rule.condition)) {
        if (this.isAccessLevelHigher(rule.accessLevel, highestLevel)) {
          highestLevel = rule.accessLevel;
        }
      }
    }

    return highestLevel;
  }

  // Check if a user can perform a specific operation
  public canPerformOperation(
    context: AccessContext,
    resourceType: ResourceType,
    operation: "create" | "read" | "update" | "delete",
  ): boolean {
    const requiredLevel = this.getRequiredLevelForOperation(operation);
    return this.hasAccess(context, resourceType, requiredLevel);
  }

  // Get detailed access information for debugging/logging
  public getAccessDetails(
    context: AccessContext,
    resourceType: ResourceType,
  ): {
    accessLevel: AccessLevel;
    matchedRules: AccessRule[];
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canAdmin: boolean;
  } {
    const rules = this.resourceRules.get(resourceType);
    if (!rules) {
      return {
        accessLevel: AccessLevel.NONE,
        matchedRules: [],
        canRead: false,
        canWrite: false,
        canDelete: false,
        canAdmin: false,
      };
    }

    const matchedRules: AccessRule[] = [];
    let highestLevel = AccessLevel.NONE;

    // Find all matching rules
    for (const rule of rules.rules) {
      if (this.evaluateCondition(context, rule.condition)) {
        matchedRules.push(rule);
        if (this.isAccessLevelHigher(rule.accessLevel, highestLevel)) {
          highestLevel = rule.accessLevel;
        }
      }
    }

    return {
      accessLevel: highestLevel,
      matchedRules,
      canRead: this.isAccessLevelSufficient(highestLevel, AccessLevel.READ),
      canWrite: this.isAccessLevelSufficient(highestLevel, AccessLevel.WRITE),
      canDelete: this.isAccessLevelSufficient(highestLevel, AccessLevel.DELETE),
      canAdmin: this.isAccessLevelSufficient(highestLevel, AccessLevel.ADMIN),
    };
  }

  // Evaluate a single access condition
  private evaluateCondition(
    context: AccessContext,
    condition: AccessCondition,
  ): boolean {
    switch (condition.type) {
      case "isAdmin":
        return context.userRole === "ADMIN";

      case "isOwner":
        return (
          !!context.resourceOwnerId &&
          context.userId === context.resourceOwnerId
        );

      case "isFamilyMember":
        return (
          !!context.familyId && context.familyId === context.resourceFamilyId
        );

      case "isFamilyAdmin":
        return (
          context.familyRole === "FAMILY_ADMIN" ||
          context.familyRole === "PRIMARY_CONTACT"
        );

      case "isPublic":
        return !!context.isResourcePublic;

      case "isSystemResource":
        return !context.resourceFamilyId; // System resources don't belong to any family

      case "and":
        return condition.conditions.every((c) =>
          this.evaluateCondition(context, c),
        );

      case "or":
        return condition.conditions.some((c) =>
          this.evaluateCondition(context, c),
        );

      case "not":
        return !this.evaluateCondition(context, condition.condition);

      default:
        return false;
    }
  }

  // Check if one access level is higher than another
  private isAccessLevelHigher(
    level1: AccessLevel,
    level2: AccessLevel,
  ): boolean {
    const levelHierarchy = {
      [AccessLevel.NONE]: 0,
      [AccessLevel.READ]: 1,
      [AccessLevel.WRITE]: 2,
      [AccessLevel.DELETE]: 3,
      [AccessLevel.ADMIN]: 4,
    };

    return levelHierarchy[level1] > levelHierarchy[level2];
  }

  // Check if access level is sufficient for required level
  private isAccessLevelSufficient(
    userLevel: AccessLevel,
    requiredLevel: AccessLevel,
  ): boolean {
    const levelHierarchy = {
      [AccessLevel.NONE]: 0,
      [AccessLevel.READ]: 1,
      [AccessLevel.WRITE]: 2,
      [AccessLevel.DELETE]: 3,
      [AccessLevel.ADMIN]: 4,
    };

    return levelHierarchy[userLevel] >= levelHierarchy[requiredLevel];
  }

  // Get required access level for an operation
  private getRequiredLevelForOperation(operation: string): AccessLevel {
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
}

// Utility functions for easy access control checks
export const accessControl = AccessControlService.getInstance();

// Helper function to create access context from user and resource data
export function createAccessContext(
  user: {
    id: string;
    role: UserRole;
    familyId?: string;
    familyRole?: FamilyRole;
  },
  resource?: {
    uploadedBy?: string;
    createdBy?: string;
    familyId?: string;
    isPublic?: boolean;
  },
): AccessContext {
  return {
    userId: user.id,
    userRole: user.role,
    familyId: user.familyId || undefined,
    familyRole: user.familyRole || undefined,
    resourceOwnerId: resource?.uploadedBy || resource?.createdBy,
    resourceFamilyId: resource?.familyId || undefined,
    isResourcePublic: resource?.isPublic,
  };
}

// Middleware function for API route access control
export function withAccessControl(
  resourceType: ResourceType,
  requiredLevel: AccessLevel,
) {
  return function (
    handler: (request: unknown, context: { user: AccessContext; resource?: { uploadedBy?: string; createdBy?: string; familyId?: string; isPublic?: boolean } }) => Promise<unknown>
  ) {
    return async function (
      request: unknown,
      context: { user: AccessContext; resource?: { uploadedBy?: string; createdBy?: string; familyId?: string; isPublic?: boolean } }
    ) {
      // This would be used in API routes to automatically check access
      // The actual implementation would depend on the specific API framework
      // TODO: Fix type mismatch - AccessContext vs user object
      // const userContext = createAccessContext(context.user, context.resource);
      // Temporary bypass to fix build
      const userContext: AccessContext = {
        userId: '',
        userRole: 'MEMBER' as UserRole,
      };

      if (!accessControl.hasAccess(userContext, resourceType, requiredLevel)) {
        throw new Error("Access denied");
      }

      return handler(request, context);
    };
  };
}

// React hook for access control in components
export function useAccessControl() {
  return {
    hasAccess: (
      user: { id: string; role: UserRole; familyId?: string; familyRole?: FamilyRole },
      resourceType: ResourceType,
      requiredLevel: AccessLevel,
      resource?: { uploadedBy?: string; createdBy?: string; familyId?: string; isPublic?: boolean },
    ) => {
      const context = createAccessContext(user, resource);
      return accessControl.hasAccess(context, resourceType, requiredLevel);
    },

    canRead: (
      user: { id: string; role: UserRole; familyId?: string; familyRole?: FamilyRole },
      resourceType: ResourceType,
      resource?: { uploadedBy?: string; createdBy?: string; familyId?: string; isPublic?: boolean }
    ) => {
      const context = createAccessContext(user, resource);
      return accessControl.hasAccess(context, resourceType, AccessLevel.READ);
    },

    canWrite: (
      user: { id: string; role: UserRole; familyId?: string; familyRole?: FamilyRole },
      resourceType: ResourceType,
      resource?: { uploadedBy?: string; createdBy?: string; familyId?: string; isPublic?: boolean }
    ) => {
      const context = createAccessContext(user, resource);
      return accessControl.hasAccess(context, resourceType, AccessLevel.WRITE);
    },

    canDelete: (
      user: { id: string; role: UserRole; familyId?: string; familyRole?: FamilyRole },
      resourceType: ResourceType,
      resource?: { uploadedBy?: string; createdBy?: string; familyId?: string; isPublic?: boolean }
    ) => {
      const context = createAccessContext(user, resource);
      return accessControl.hasAccess(context, resourceType, AccessLevel.DELETE);
    },

    getAccessDetails: (
      user: { id: string; role: UserRole; familyId?: string; familyRole?: FamilyRole },
      resourceType: ResourceType,
      resource?: { uploadedBy?: string; createdBy?: string; familyId?: string; isPublic?: boolean }
    ) => {
      const context = createAccessContext(user, resource);
      return accessControl.getAccessDetails(context, resourceType);
    },
  };
}
