'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { UserRole } from '@prisma/client'
import { UserProfileDropdown } from '@/components/user-profile-dropdown'
import { getFeatureRoutesForRole } from '@/lib/navigation/feature-routes'
import { NotificationBadge } from '@/components/notifications/notification-badge'
import { useNotifications } from '@/hooks/use-notifications'
import { SimpleThemeToggle } from '@/components/ui/theme-toggle'
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
  useSidebar,
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
  const { setOpenMobile, isMobile } = useSidebar()

  // Auto-close mobile sidebar when navigating to different routes
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

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
        <div className="flex flex-col items-center space-y-3 py-4">
          <Link href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
            <div className="relative shrink-0">
              <Image
                src="/firefly.png"
                alt="Firefly Logo"
                width={112}
                height={112}
                priority
                className="object-contain w-24 h-24 sm:w-28 sm:h-28"
              />
            </div>
          </Link>
          <SimpleThemeToggle />
        </div>
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
                  className="w-full min-h-[48px] touch-manipulation border-2 border-transparent hover:border-accent/20 data-[active=true]:border-primary/30 backdrop-blur-sm transition-all shadow-xs hover:shadow-sm data-[active=true]:shadow-sm"
                >
                  <Link href={item.href} className="flex items-center gap-3 px-4 py-3">
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
        <div className="p-2">
          <UserProfileDropdown user={user} userRole={userRole} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}