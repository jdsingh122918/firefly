import { UserRole } from '@prisma/client'
import { Inbox, MessageSquare, StickyNote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Feature route definition for navigation menu items
 * This abstraction allows easy addition of new communication features
 * like forums, notes, resources, and real-time chat
 */
export interface FeatureRoute {
  /** Unique identifier for the feature */
  key: string
  /** Display title in the navigation menu */
  title: string
  /** Generate role-specific route URL */
  href: (role: UserRole) => string
  /** Lucide icon component */
  icon: LucideIcon
  /** User roles that can access this feature */
  roles: UserRole[]
  /** Optional badge configuration for showing counts/status */
  badge?: {
    /** Function to determine if badge should be shown */
    shouldShow: (state: { unreadCount: number; isConnected: boolean }) => boolean
    /** Function to get badge content (number or string) */
    getContent: (state: { unreadCount: number; isConnected: boolean }) => string | number
  }
}

/**
 * Feature routes configuration
 * Add new communication features here to automatically appear in navigation
 */
export const FEATURE_ROUTES: FeatureRoute[] = [
  {
    key: 'notifications',
    title: 'Notifications',
    href: (role: UserRole) => `/${role.toLowerCase()}/notifications`,
    icon: Inbox,
    roles: [UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.MEMBER],
    badge: {
      shouldShow: (state) => state.unreadCount > 0,
      getContent: (state) => state.unreadCount > 99 ? '99+' : state.unreadCount
    }
  },
  {
    key: 'forums',
    title: 'Forums',
    href: (role: UserRole) => `/${role.toLowerCase()}/forums`,
    icon: MessageSquare,
    roles: [UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.MEMBER]
    // Badge functionality can be added later for real-time updates
  },
  {
    key: 'notes',
    title: 'Notes',
    href: (role: UserRole) => `/${role.toLowerCase()}/notes`,
    icon: StickyNote,
    roles: [UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.MEMBER]
    // Badge functionality can be added later for note counts
  }
  // Future features can be added here:
  // {
  //   key: 'chat',
  //   title: 'Chat',
  //   href: (role: UserRole) => `/${role.toLowerCase()}/chat`,
  //   icon: MessageCircle,
  //   roles: [UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.MEMBER],
  //   badge: {
  //     shouldShow: (state) => state.unreadMessages > 0,
  //     getContent: (state) => state.unreadMessages
  //   }
  // },
  // {
  //   key: 'resources',
  //   title: 'Resources',
  //   href: (role: UserRole) => `/${role.toLowerCase()}/resources`,
  //   icon: FileText,
  //   roles: [UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.MEMBER]
  //   // No badge for resources
  // }
]

/**
 * Get feature routes accessible by a specific user role
 */
export function getFeatureRoutesForRole(userRole: UserRole): FeatureRoute[] {
  return FEATURE_ROUTES.filter(route => route.roles.includes(userRole))
}

/**
 * Get a specific feature route by key
 */
export function getFeatureRoute(key: string): FeatureRoute | undefined {
  return FEATURE_ROUTES.find(route => route.key === key)
}

/**
 * Generate notification route URLs for role permission configuration
 */
export function getNotificationRoutesForRoles(): string[] {
  const notificationRoute = getFeatureRoute('notifications')
  if (!notificationRoute) return []

  return [
    notificationRoute.href(UserRole.ADMIN),
    notificationRoute.href(UserRole.VOLUNTEER),
    notificationRoute.href(UserRole.MEMBER)
  ]
}