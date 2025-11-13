import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { ForumsPageContent } from '@/components/forums/forums-page-content'
import { prisma } from '@/lib/db/prisma'

export default async function VolunteerForumsPage() {
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

  // Verify access permissions (volunteers can access, as can admins)
  if (!finalUserRole || (finalUserRole !== UserRole.VOLUNTEER && finalUserRole !== UserRole.ADMIN)) {
    redirect('/sign-in')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Forums</h1>
        <p className="text-muted-foreground">
          Community discussions and support forums
        </p>
      </div>

      {/* Render forums as full-page component */}
      <ForumsPageContent />
    </div>
  )
}

export const metadata = {
  title: 'Forums | Firefly Volunteer',
  description: 'Community discussions and support forums',
}