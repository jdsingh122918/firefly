import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { NotificationsPageContent } from '@/components/notifications/notifications-page-content'
import { prisma } from '@/lib/db/prisma'

export default async function MemberNotificationsPage() {
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
  if (!finalUserRole || finalUserRole !== UserRole.MEMBER) {
    redirect('/sign-in')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Keep up with important updates and messages from your care team
        </p>
      </div>

      {/* Render notifications as full-page component */}
      <NotificationsPageContent />
    </div>
  )
}

export const metadata = {
  title: 'Notifications | Firefly Member',
  description: 'Keep up with important updates and messages from your care team',
}