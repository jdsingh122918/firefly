import { redirect } from 'next/navigation'
import { getGracefulUserData } from '@/lib/auth/graceful-user-fetch'
import { SidebarNavigation } from '@/components/sidebar-navigation'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { NotificationBanner } from '@/components/notifications/notification-banner'
import { DatabaseErrorWrapper } from '@/components/errors/database-error-boundary'
import { BreadcrumbNavigation } from '@/components/breadcrumb-navigation'
import { CookieBanner } from '@/components/cookie-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Use graceful user data fetching
  const userResult = await getGracefulUserData()

  // Handle critical database failures by redirecting to unavailable page
  if (userResult.shouldRedirectToUnavailable) {
    const params = new URLSearchParams(userResult.redirectParams || {})
    redirect(`/database-unavailable?${params.toString()}`)
  }

  const { user, clerkUser } = userResult

  console.log('🔍 Dashboard Layout - Graceful user data:', {
    clerkId: user.clerkId,
    userRole: user.role,
    userEmail: user.email,
    isFromDatabase: user.isFromDatabase,
    isFromCache: user.isFromCache,
    databaseError: user.databaseError,
    hasClerkUser: !!clerkUser,
  })

  return (
    <DatabaseErrorWrapper
      maxRetries={2}
    >
      <SidebarProvider>
        <SidebarNavigation
          userRole={user.role}
          user={{
            firstName: user.firstName || clerkUser?.firstName,
            lastName: user.lastName || clerkUser?.lastName,
            email: user.email || clerkUser?.emailAddresses[0]?.emailAddress,
            imageUrl: clerkUser?.imageUrl
          }}
        />
        <SidebarInset>
        {/* Header */}
        <header className="border-b bg-background sticky top-0 z-40">
          {/* Top section with mobile title and welcome message */}
          <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <SidebarTrigger className="md:hidden h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold md:hidden truncate">PPCC</h1>
                <div className="hidden md:block text-sm text-muted-foreground truncate">
                  Welcome back, {user.firstName || user.email || 'User'}
                  {user.databaseError && !user.isFromDatabase && (
                    <span className="text-orange-600 ml-2" title="Using cached data - database unavailable">
                      (Offline Mode)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Breadcrumb navigation */}
          <div className="border-t border-border/50 px-3 sm:px-4 md:px-6 py-2">
            <BreadcrumbNavigation className="mb-0" />
          </div>
        </header>

        {/* Database Status Warning */}
        {user.databaseError && !user.isFromDatabase && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-orange-800">
              <div className="h-2 w-2 rounded-full bg-orange-500"></div>
              <span>Database temporarily unavailable - using cached data. Some features may be limited.</span>
            </div>
          </div>
        )}

        {/* Notification Banner */}
        <NotificationBanner className="border-b" />

        {/* Main content */}
        <main className="flex-1 flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 min-h-0 overflow-auto">
          <div className="flex-1 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Cookie Banner - positioned fixed at bottom */}
      <CookieBanner />
    </DatabaseErrorWrapper>
  )
}