'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { UserProfileDropdown } from '@/components/user-profile-dropdown'
import { getFeatureRoutesForRole } from '@/lib/navigation/feature-routes'
import { NotificationBadge } from '@/components/notifications/notification-badge'
import { useNotifications } from '@/hooks/use-notifications'
import {
  Users,
  Home,
  Heart,
  Settings
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

interface NavigationItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: Home,
    roles: [UserRole.ADMIN]
  },
  {
    title: 'Dashboard',
    href: '/volunteer',
    icon: Home,
    roles: [UserRole.VOLUNTEER]
  },
  {
    title: 'Dashboard',
    href: '/member',
    icon: Home,
    roles: [UserRole.MEMBER]
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
    roles: [UserRole.ADMIN]
  },
  {
    title: 'Families',
    href: '/admin/families',
    icon: Heart,
    roles: [UserRole.ADMIN]
  },
  {
    title: 'Families',
    href: '/volunteer/families',
    icon: Heart,
    roles: [UserRole.VOLUNTEER]
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: [UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.MEMBER]
  }
]

// Legacy NavigationContent and SidebarNavigationProps removed - replaced with modern shadcn/ui implementation

// Legacy custom sidebar implementation removed - now using shadcn/ui Sidebar components

interface UserInfo {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  imageUrl?: string | null
}

// Modern sidebar using shadcn/ui Sidebar components with proper mobile support
export function SidebarNavigation({
  userRole,
  user
}: {
  userRole?: UserRole
  user?: UserInfo
}) {
  const pathname = usePathname()

  // Get real-time notification data
  const { unreadCount, isConnected } = useNotifications({
    autoConnect: true,
    enablePollingFallback: true
  })

  // Filter core navigation items by role
  const filteredCoreItems = navigationItems.filter(item =>
    userRole ? item.roles.includes(userRole) : false
  )

  // Get feature routes for this role (notifications, future forums, chat, etc.)
  const featureRoutes = userRole ? getFeatureRoutesForRole(userRole) : []

  // Combine core items with feature items, ensuring feature items come after Settings
  const allMenuItems = [
    ...filteredCoreItems,
    // Feature routes (notifications, future forums, chat, resources)
    ...featureRoutes.map(route => ({
      ...route,
      href: route.href(userRole!)
    }))
  ]

  return (
    <Sidebar className="border-r">
      <SidebarHeader>
        <Link href="/" className="flex items-center justify-center sm:justify-start space-x-2 p-3 hover:bg-gray-50 rounded-lg transition-colors mx-2">
          <div className="relative shrink-0">
            <Image
              src="/firefly.png"
              alt="Firefly Logo"
              width={32}
              height={32}
              priority
              className="object-contain"
            />
          </div>
          <span className="hidden sm:block font-bold text-lg truncate">Firefly</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {allMenuItems.map((item) => {
            const Icon = item.icon
            const isFeatureRoute = 'key' in item
            const isNotifications = isFeatureRoute && 'key' in item && item.key === 'notifications'

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  className="w-full min-h-[44px] touch-manipulation"
                >
                  <Link href={item.href} className="flex items-center gap-3 px-3 py-2">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.title}</span>

                    {/* Show notification badge for notifications menu item */}
                    {isNotifications && (
                      <div className="ml-auto">
                        <NotificationBadge
                          unreadCount={unreadCount}
                          isConnected={isConnected}
                          showConnectionStatus={unreadCount === 0} // Only show connection when no unread
                        />
                      </div>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-3">
          {/* User Profile - removed notification bell */}
          <UserProfileDropdown user={user} userRole={userRole} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}