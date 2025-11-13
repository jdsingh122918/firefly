import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { SidebarNavigation } from '@/components/sidebar-navigation'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { NotificationBanner } from '@/components/notifications/notification-banner'
import { UserRole } from '@prisma/client'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Get user info from database for role-based navigation
  const user = await prisma.user.findUnique({
    where: { clerkId: userId }
  })

  // Get user profile from Clerk for image and full profile data
  const clerkUser = await currentUser()

  // Database fallback: Use session token role if user not in database
  const metadata = sessionClaims?.metadata as { role?: string } | undefined
  const fallbackRole = metadata?.role as UserRole | undefined
  const effectiveRole = user?.role || fallbackRole

  console.log('🔍 Dashboard Layout - User data:', {
    userId,
    userRole: user?.role,
    userEmail: user?.email,
    clerkUserEmail: clerkUser?.emailAddresses[0]?.emailAddress,
    clerkUserName: clerkUser?.firstName,
    clerkUserImage: clerkUser?.imageUrl,
    fallbackRole,
    effectiveRole,
    hasUser: !!user,
    hasClerkUser: !!clerkUser,
    hasSessionClaims: !!sessionClaims
  })

  return (
    <SidebarProvider>
      <SidebarNavigation
        userRole={effectiveRole}
        user={{
          firstName: user?.firstName || clerkUser?.firstName,
          lastName: user?.lastName || clerkUser?.lastName,
          email: user?.email || clerkUser?.emailAddresses[0]?.emailAddress,
          imageUrl: clerkUser?.imageUrl
        }}
      />
      <SidebarInset>
        {/* Header */}
        <header className="border-b bg-background sticky top-0 z-40">
          <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <SidebarTrigger className="md:hidden h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold md:hidden truncate">Firefly</h1>
                {(user || effectiveRole) && (
                  <div className="hidden md:block text-sm text-muted-foreground truncate">
                    Welcome back, {user?.firstName || user?.email || 'Admin'}
                  </div>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* Notification Banner */}
        <NotificationBanner className="border-b" />

        {/* Main content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}