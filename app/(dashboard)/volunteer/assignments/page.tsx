import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { AssignmentDashboard } from '@/components/resources/assignment-dashboard'
import { prisma } from '@/lib/db/prisma'

export default async function VolunteerAssignmentsPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Dual-path authentication pattern (CLAUDE.md requirement)
  const sessionRole = (sessionClaims?.metadata as { role?: UserRole })?.role
  let finalUserRole = sessionRole

  // Database fallback for resilient authentication
  if (!sessionRole) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    })
    if (dbUser?.role) {
      finalUserRole = dbUser.role as UserRole
    }
  }

  // Verify access permissions
  if (!finalUserRole || finalUserRole !== UserRole.VOLUNTEER) {
    redirect('/sign-in')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
        <p className="text-muted-foreground">
          Create and manage task assignments for family members
        </p>
      </div>

      {/* Render assignments dashboard with full volunteer capabilities */}
      <AssignmentDashboard />
    </div>
  )
}

export const metadata = {
  title: 'Task Management | Firefly',
  description: 'Create and manage task assignments for family members',
}