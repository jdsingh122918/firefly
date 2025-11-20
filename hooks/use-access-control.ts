import { useUser } from "@clerk/nextjs";
import { useMemo, useCallback } from "react";
import {
  AccessLevel,
  ResourceType,
  accessControl,
  createAccessContext,
} from "@/lib/access-control/access-control.service";

// Hook for getting current user's database info
// This would typically be provided by a user context or similar
interface DatabaseUser {
  id: string;
  role: "ADMIN" | "VOLUNTEER" | "MEMBER";
  familyId?: string;
  familyRole?: "PRIMARY_CONTACT" | "FAMILY_ADMIN" | "MEMBER";
}

// Mock hook for demonstration - in real app this would come from your user context
function useCurrentUser(): DatabaseUser | null {
  // This would typically fetch from your database user context
  // For now, returning a mock user
  return {
    id: "user-id",
    role: "MEMBER",
    familyId: "family-id",
    familyRole: "MEMBER",
  };
}

// Main access control hook
export function useAccessControl(resource?: {
  uploadedBy?: string;
  createdBy?: string;
  familyId?: string;
  isPublic?: boolean;
}) {
  const { isSignedIn } = useUser();
  const currentUser = useCurrentUser();

  const accessMethods = useMemo(() => {
    if (!isSignedIn || !currentUser) {
      return {
        hasAccess: () => false,
        canRead: () => false,
        canWrite: () => false,
        canDelete: () => false,
        canAdmin: () => false,
        getAccessLevel: () => AccessLevel.NONE,
        getAccessDetails: () => null,
      };
    }

    return {
      // Check if user has specific access level for a resource type
      hasAccess: (resourceType: ResourceType, requiredLevel: AccessLevel) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.hasAccess(context, resourceType, requiredLevel);
      },

      // Convenience methods for common access checks
      canRead: (resourceType: ResourceType) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.hasAccess(context, resourceType, AccessLevel.READ);
      },

      canWrite: (resourceType: ResourceType) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.hasAccess(
          context,
          resourceType,
          AccessLevel.WRITE,
        );
      },

      canDelete: (resourceType: ResourceType) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.hasAccess(
          context,
          resourceType,
          AccessLevel.DELETE,
        );
      },

      canAdmin: (resourceType: ResourceType) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.hasAccess(
          context,
          resourceType,
          AccessLevel.ADMIN,
        );
      },

      // Get the user's access level for a resource type
      getAccessLevel: (resourceType: ResourceType) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.getUserAccessLevel(context, resourceType);
      },

      // Get detailed access information
      getAccessDetails: (resourceType: ResourceType) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.getAccessDetails(context, resourceType);
      },

      // Check if user can perform specific operations
      canPerformOperation: (
        resourceType: ResourceType,
        operation: "create" | "read" | "update" | "delete",
      ) => {
        const context = createAccessContext(currentUser, resource);
        return accessControl.canPerformOperation(
          context,
          resourceType,
          operation,
        );
      },
    };
  }, [isSignedIn, currentUser, resource]);

  return accessMethods;
}

// Hook for document-specific access control
export function useDocumentAccess(document?: {
  id: string;
  uploadedBy: string;
  familyId?: string;
  isPublic?: boolean;
}) {
  const access = useAccessControl(document);

  return {
    canView: access.canRead(ResourceType.DOCUMENT),
    canEdit: access.canWrite(ResourceType.DOCUMENT),
    canDelete: access.canDelete(ResourceType.DOCUMENT),
    canManage: access.canAdmin(ResourceType.DOCUMENT),
    canTag: access.canWrite(ResourceType.DOCUMENT), // Can tag if can edit
    accessLevel: access.getAccessLevel(ResourceType.DOCUMENT),
  };
}

// Hook for message-specific access control
export function useMessageAccess(message?: {
  id: string;
  senderId: string;
  conversationId: string;
  familyId?: string;
}) {
  const access = useAccessControl({
    createdBy: message?.senderId,
    familyId: message?.familyId,
  });

  return {
    canView: access.canRead(ResourceType.DOCUMENT),
    canEdit: access.canWrite(ResourceType.DOCUMENT),
    canDelete: access.canDelete(ResourceType.DOCUMENT),
    canModerate: access.canAdmin(ResourceType.DOCUMENT),
    accessLevel: access.getAccessLevel(ResourceType.DOCUMENT),
  };
}

// Hook for family-specific access control
export function useFamilyAccess(family?: { id: string; createdBy: string }) {
  const access = useAccessControl({
    createdBy: family?.createdBy,
    familyId: family?.id,
  });

  return {
    canView: access.canRead(ResourceType.DOCUMENT),
    canEdit: access.canWrite(ResourceType.DOCUMENT),
    canDelete: access.canDelete(ResourceType.DOCUMENT),
    canManage: access.canAdmin(ResourceType.DOCUMENT),
    canInviteMembers: access.canWrite(ResourceType.DOCUMENT),
    canManageRoles: access.canAdmin(ResourceType.DOCUMENT),
    accessLevel: access.getAccessLevel(ResourceType.DOCUMENT),
  };
}

// Hook for user-specific access control
export function useUserAccess(targetUser?: { id: string; familyId?: string }) {
  const access = useAccessControl({
    createdBy: targetUser?.id,
    familyId: targetUser?.familyId,
  });

  return {
    canView: access.canRead(ResourceType.CONTACT),
    canEdit: access.canWrite(ResourceType.CONTACT),
    canDelete: access.canDelete(ResourceType.CONTACT),
    canManage: access.canAdmin(ResourceType.CONTACT),
    accessLevel: access.getAccessLevel(ResourceType.CONTACT),
  };
}

// Hook for notification-specific access control
export function useNotificationAccess(notification?: {
  id: string;
  userId: string;
}) {
  const access = useAccessControl({
    createdBy: notification?.userId,
  });

  return {
    canView: access.canRead(ResourceType.DOCUMENT),
    canEdit: access.canWrite(ResourceType.DOCUMENT),
    canDelete: access.canDelete(ResourceType.DOCUMENT),
    canManage: access.canAdmin(ResourceType.DOCUMENT),
    accessLevel: access.getAccessLevel(ResourceType.DOCUMENT),
  };
}

// Hook for checking administrative capabilities
export function useAdminAccess() {
  const { isSignedIn } = useUser();
  const currentUser = useCurrentUser();

  const isAdmin = useMemo(() => {
    return isSignedIn && currentUser?.role === "ADMIN";
  }, [isSignedIn, currentUser]);

  return {
    isAdmin,
    canManageUsers: isAdmin,
    canManageFamilies: isAdmin,
    canManageSystem: isAdmin,
    canViewAllResources: isAdmin,
    canAccessAuditLogs: isAdmin,
  };
}

// Hook for family role-based access
export function useFamilyRoleAccess() {
  const { isSignedIn } = useUser();
  const currentUser = useCurrentUser();

  const familyRole = currentUser?.familyRole;
  const isInFamily = !!currentUser?.familyId;

  const isFamilyAdmin = useMemo(() => {
    return (
      isSignedIn &&
      isInFamily &&
      (familyRole === "FAMILY_ADMIN" || familyRole === "PRIMARY_CONTACT")
    );
  }, [isSignedIn, isInFamily, familyRole]);

  const isPrimaryContact = useMemo(() => {
    return isSignedIn && isInFamily && familyRole === "PRIMARY_CONTACT";
  }, [isSignedIn, isInFamily, familyRole]);

  return {
    isInFamily,
    isFamilyAdmin,
    isPrimaryContact,
    familyRole,
    canManageFamilyMembers: isFamilyAdmin,
    canManageFamilyResources: isFamilyAdmin,
    canInviteFamilyMembers: isFamilyAdmin,
    canDeleteFamily: isPrimaryContact,
  };
}

// Utility hook for bulk access checks
export function useBulkAccessCheck() {
  const { isSignedIn } = useUser();
  const currentUser = useCurrentUser();

  const checkBulkAccess = useCallback(
    (
      resources: Array<{
        id: string;
        type: ResourceType;
        uploadedBy?: string;
        createdBy?: string;
        familyId?: string;
        isPublic?: boolean;
      }>,
      requiredLevel: AccessLevel,
    ) => {
      if (!isSignedIn || !currentUser) {
        return [];
      }

      return resources.map((resource) => {
        const context = createAccessContext(currentUser, {
          uploadedBy: resource.uploadedBy,
          createdBy: resource.createdBy,
          familyId: resource.familyId,
          isPublic: resource.isPublic,
        });

        return {
          id: resource.id,
          hasAccess: accessControl.hasAccess(context, resource.type, requiredLevel),
          accessLevel: accessControl.getUserAccessLevel(context, resource.type),
        };
      });
    },
    [isSignedIn, currentUser],
  );

  return {
    checkBulkAccess,
  };
}

// Export the core access control functionality for use in API routes
export { AccessLevel, ResourceType, accessControl, createAccessContext };
