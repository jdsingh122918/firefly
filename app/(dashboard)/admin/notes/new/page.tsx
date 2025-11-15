import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { NoteCreationPage } from '@/components/notes/note-creation-page'
import { prisma } from '@/lib/db/prisma'

export default async function AdminCreateNotePage() {
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

  return <NoteCreationPage userRole={UserRole.ADMIN} />
}

export const metadata = {
  title: 'Create Note | Firefly Admin',
  description: 'Create a new note with attachments and assignments',
}