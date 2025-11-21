import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Heart, MessageSquare, Calendar, Plus, Eye } from 'lucide-react'
import { UserRole } from '@/lib/auth/roles'
import { UserRepository } from '@/lib/db/repositories/user.repository'
import { FamilyRepository } from '@/lib/db/repositories/family.repository'
import type { User } from '@/lib/types'

const userRepository = new UserRepository()
const familyRepository = new FamilyRepository()

export default async function VolunteerDashboard() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role

  console.log('🔍 Volunteer dashboard access check:', {
    userRole,
    userRoleType: typeof userRole,
    allowedRoles: [UserRole.VOLUNTEER, UserRole.ADMIN],
    hasAccess: userRole === UserRole.VOLUNTEER || userRole === UserRole.ADMIN
  });

  // Only volunteers and admins can access this page
  if (userRole !== UserRole.VOLUNTEER && userRole !== UserRole.ADMIN) {
    console.log('❌ Volunteer access denied, redirecting to sign-in');
    redirect('/sign-in')
  }

  // Get volunteer data from database
  const volunteer = await userRepository.getUserByClerkId(userId)
  let myFamilies: Array<{ id: string; name: string; createdAt: Date; members: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }> }> = []
  let myMembers: User[] = []
  let familyCount = 0
  let memberCount = 0

  if (volunteer) {
    try {
      // Get families created by this volunteer
      const families = await familyRepository.getFamiliesByCreator(volunteer.id)
      // Get full family data with members
      myFamilies = await Promise.all(
        families.map(async (family) => {
          const members = await userRepository.getAllUsers({ familyId: family.id })
          return {
            ...family,
            members
          }
        })
      )
      familyCount = myFamilies.length

      // Get members created by this volunteer
      myMembers = await userRepository.getAllUsers({
        role: UserRole.MEMBER,
        createdById: volunteer.id
      })
      memberCount = myMembers.length

      console.log('📊 Volunteer dashboard data:', {
        volunteerId: volunteer.id,
        familyCount,
        memberCount
      })
    } catch (error) {
      console.error('❌ Error fetching volunteer data:', error)
    }
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Volunteer Dashboard</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your assigned families and members
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <Button asChild className="w-full sm:w-auto min-h-[44px]">
            <Link href="/volunteer/families/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Family
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto min-h-[44px]">
            <Link href="/volunteer/users/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3 border-l-4 border-l-[var(--healthcare-home)] bg-[hsl(var(--healthcare-home)/0.05)] hover:bg-[hsl(var(--healthcare-home)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Families</CardTitle>
            <Heart className="h-4 w-4 text-[hsl(var(--healthcare-home))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyCount}</div>
            <p className="text-xs text-muted-foreground">
              Families you&apos;ve created
            </p>
          </CardContent>
        </Card>

        <Card className="p-3 border-l-4 border-l-[var(--healthcare-basic)] bg-[hsl(var(--healthcare-basic)/0.05)] hover:bg-[hsl(var(--healthcare-basic)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-[hsl(var(--healthcare-basic))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount}</div>
            <p className="text-xs text-muted-foreground">
              Members you&apos;ve registered
            </p>
          </CardContent>
        </Card>

        <Card className="p-3 border-l-4 border-l-[var(--healthcare-mental)] bg-[hsl(var(--healthcare-mental)/0.05)] hover:bg-[hsl(var(--healthcare-mental)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-[hsl(var(--healthcare-mental))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Coming soon - messaging system
            </p>
          </CardContent>
        </Card>

        <Card className="p-3 border-l-4 border-l-[var(--ppcc-orange)] bg-[hsl(var(--ppcc-orange)/0.05)] hover:bg-[hsl(var(--ppcc-orange)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-[hsl(var(--ppcc-orange))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Coming soon - visit scheduling
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Families */}
        <Card className="border-l-4 border-l-[var(--healthcare-home)] bg-[hsl(var(--healthcare-home)/0.05)] hover:bg-[hsl(var(--healthcare-home)/0.08)] transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Families</CardTitle>
              <Button size="sm" variant="default" asChild>
                <Link href="/volunteer/families">
                  <Eye className="mr-2 h-4 w-4" />
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {myFamilies.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No families yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first family to get started.
                </p>
                <div className="mt-6">
                  <Button size="sm" asChild>
                    <Link href="/volunteer/families/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Family
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {myFamilies.slice(0, 3).map((family) => (
                  <div key={family.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Link
                        href={`/volunteer/families/${family.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {family.name}
                      </Link>
                      <div className="text-sm text-muted-foreground">
                        {family.members.length} {family.members.length === 1 ? 'member' : 'members'}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {new Date(family.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
                {myFamilies.length > 3 && (
                  <div className="text-center pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/volunteer/families">
                        View {myFamilies.length - 3} more families
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Members */}
        <Card className="border-l-4 border-l-[var(--healthcare-basic)] bg-[hsl(var(--healthcare-basic)/0.05)] hover:bg-[hsl(var(--healthcare-basic)/0.08)] transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Members</CardTitle>
              <Button size="sm" variant="default" asChild>
                <Link href="/volunteer/users">
                  <Eye className="mr-2 h-4 w-4" />
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {myMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No members yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first member to get started.
                </p>
                <div className="mt-6">
                  <Button size="sm" asChild>
                    <Link href="/volunteer/users/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Member
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {myMembers.slice(0, 3).map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Link
                        href={`/volunteer/users/${member.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email}
                      </Link>
                      <div className="text-sm text-muted-foreground">
                        {member.family ? member.family.name : 'No family assigned'}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
                {myMembers.length > 3 && (
                  <div className="text-center pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/volunteer/users">
                        View {myMembers.length - 3} more members
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}