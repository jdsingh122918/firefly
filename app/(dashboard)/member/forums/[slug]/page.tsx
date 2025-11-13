import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { ForumDetailContent } from '@/components/forums/forum-detail-content'
import { prisma } from '@/lib/db/prisma'

interface ForumDetailPageProps {
  params: {
    slug: string
  }
}

export default async function MemberForumDetailPage({ params }: ForumDetailPageProps) {
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

  // Verify access permissions (all roles can access member routes due to hierarchy)
  if (!finalUserRole) {
    redirect('/sign-in')
  }

  // Let the client component handle forum existence checking
  // Server-side API calls would require proper authentication setup

  return (
    <div className="space-y-6">
      <ForumDetailContent forumSlug={params.slug} />
    </div>
  )
}

export async function generateMetadata({ params }: ForumDetailPageProps) {
  return {
    title: `Forum | Firefly`,
    description: 'View forum discussions and posts',
  }
}