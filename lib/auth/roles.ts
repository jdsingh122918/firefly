export enum UserRole {
  ADMIN = "ADMIN",
  VOLUNTEER = "VOLUNTEER",
  MEMBER = "MEMBER",
}

export interface RolePermissions {
  canCreate: UserRole[];
  routes: string[];
  displayName: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.ADMIN]: {
    canCreate: [UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.MEMBER],
    routes: ["/admin", "/volunteer", "/member", "/dashboard", "/settings", "/admin/notifications", "/admin/forums"],
    displayName: "Administrator",
  },
  [UserRole.VOLUNTEER]: {
    canCreate: [UserRole.MEMBER],
    routes: ["/volunteer", "/member", "/dashboard", "/settings", "/volunteer/notifications", "/volunteer/forums"],
    displayName: "Volunteer",
  },
  [UserRole.MEMBER]: {
    canCreate: [],
    routes: ["/member", "/dashboard", "/settings", "/member/notifications", "/member/forums"],
    displayName: "Member",
  },
};

/**
 * Check if a user with a given role can create another user with target role
 */
export function canCreateUser(
  creatorRole: UserRole,
  targetRole: UserRole,
): boolean {
  return ROLE_PERMISSIONS[creatorRole].canCreate.includes(targetRole);
}

/**
 * Get the default dashboard route for a given role
 */
export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return "/admin";
    case UserRole.VOLUNTEER:
      return "/volunteer";
    case UserRole.MEMBER:
      return "/member";
    default:
      return "/dashboard";
  }
}

/**
 * Check if a user with a given role can access a specific route
 */
export function canAccessRoute(userRole: UserRole, route: string): boolean {
  return ROLE_PERMISSIONS[userRole].routes.some((allowedRoute) =>
    route.startsWith(allowedRoute),
  );
}

/**
 * Determine if volunteer-created members need family assignment
 */
export function requiresFamilyAssignment(
  creatorRole: UserRole,
  targetRole: UserRole,
): boolean {
  return creatorRole === UserRole.VOLUNTEER && targetRole === UserRole.MEMBER;
}

/**
 * Get display-friendly role name
 */
export function getRoleDisplayName(role: UserRole): string {
  return ROLE_PERMISSIONS[role].displayName;
}
