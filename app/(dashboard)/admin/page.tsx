import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserPlus, Building, Calendar } from 'lucide-react'
import { UserRepository } from '@/lib/db/repositories/user.repository'
import { FamilyRepository } from '@/lib/db/repositories/family.repository'
import { UserRole } from '@/lib/auth/roles'
import { TestNotificationButton } from '@/components/admin/test-notification-button'

export default async function AdminDashboard() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role

  console.log('🔍 Admin dashboard access check:', {
    userRole,
    userRoleType: typeof userRole,
    expected: UserRole.ADMIN,
    matches: userRole === UserRole.ADMIN
  });

  // Only admins can access this page
  if (userRole !== UserRole.ADMIN) {
    console.log('❌ Admin access denied, redirecting to sign-in');
    redirect('/sign-in')
  }

  // Fetch dashboard statistics
  const userRepository = new UserRepository()
  const familyRepository = new FamilyRepository()

  const [userStats, familyStats] = await Promise.all([
    userRepository.getUserStats(),
    familyRepository.getFamilyStats()
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Manage users, families, and platform settings
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.total}</div>
            <p className="text-xs text-muted-foreground">
              All platform users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volunteers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.volunteers}</div>
            <p className="text-xs text-muted-foreground">
              Active volunteers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Families</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyStats.total}</div>
            <p className="text-xs text-muted-foreground">
              Families being served
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.members}</div>
            <p className="text-xs text-muted-foreground">
              Community members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions & Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Notification System</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Test the real-time notification system to verify SSE connections are working properly.
            </p>
            <TestNotificationButton />
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              User management and GraphQL API coming in Phase 2...
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}