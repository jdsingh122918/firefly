import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { NoteDetailPage } from '@/components/notes/note-detail-page'
import { prisma } from '@/lib/db/prisma'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VolunteerNoteDetailPage({ params }: Props) {
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

  const { id } = await params

  return (
    <NoteDetailPage
      noteId={id}
      userRole={finalUserRole}
      backPath="/volunteer/notes"
    />
  )
}

export const metadata = {
  title: 'Note Details | Firefly Volunteer',
  description: 'View and edit note details',
}