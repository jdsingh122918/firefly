import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { NotesPageContent } from '@/components/notes/notes-page-content'
import { prisma } from '@/lib/db/prisma'

export default async function AdminNotesPage() {
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
  if (!finalUserRole || finalUserRole !== UserRole.ADMIN) {
    redirect('/sign-in')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
        <p className="text-muted-foreground">
          Personal and shared notes with file attachments
        </p>
      </div>

      {/* Render notes as full-page component */}
      <NotesPageContent />
    </div>
  )
}

export const metadata = {
  title: 'Notes | Firefly Admin',
  description: 'Personal and shared notes with file attachments',
}