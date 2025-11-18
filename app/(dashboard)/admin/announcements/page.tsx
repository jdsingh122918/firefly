import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { UserRole } from '@/lib/auth/roles'
import { AnnouncementForm } from './announcement-form'

export default async function AdminAnnouncementsPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Get user from database to check role
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true, email: true, firstName: true }
  })

  // Only admins can access this page
  if (!user || user.role !== UserRole.ADMIN) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Announcements</h1>
        <p className="text-muted-foreground mt-2">
          Create and send announcements to users across the platform
        </p>
      </div>

      <AnnouncementForm />
    </div>
  )
}

export const metadata = {
  title: 'Announcements | Admin | Firefly',
  description: 'Create and manage system announcements for all users',
}