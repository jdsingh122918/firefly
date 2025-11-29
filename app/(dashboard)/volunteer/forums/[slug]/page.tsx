import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { ForumDetailContent } from '@/components/forums/forum-detail-content'
import { prisma } from '@/lib/db/prisma'

interface ForumDetailPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function VolunteerForumDetailPage({ params }: ForumDetailPageProps) {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Await params in Next.js 15+
  const { slug } = await params

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

  // Let the client component handle forum existence checking
  // Server-side API calls would require proper authentication setup

  return (
    <div className="space-y-6">
      <ForumDetailContent forumSlug={slug} />
    </div>
  )
}

export async function generateMetadata({ params: _params }: ForumDetailPageProps) {
  await _params // Await params to satisfy Next.js 15+ requirement
  return {
    title: `Forum | Firefly Volunteer`,
    description: 'View forum discussions and posts',
  }
}