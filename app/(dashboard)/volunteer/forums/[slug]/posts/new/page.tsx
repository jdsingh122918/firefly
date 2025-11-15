import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserRole } from '@/lib/auth/roles'
import { ForumRepository } from '@/lib/db/repositories/forum.repository'
import { PostCreationPage } from '@/components/forums/post-creation-page'

const forumRepository = new ForumRepository()

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function NewPostPage({ params }: PageProps) {
  const { slug } = await params
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role

  // Only volunteers and admins can access this page
  if (userRole !== UserRole.VOLUNTEER && userRole !== UserRole.ADMIN) {
    redirect('/sign-in')
  }

  // Get forum data
  const forum = await forumRepository.getForumBySlug(slug)

  if (!forum) {
    redirect('/volunteer/forums')
  }

  return (
    <PostCreationPage
      forumId={forum.id}
      forumSlug={forum.slug}
      forumName={forum.title}
    />
  )
}