import { redirect } from 'next/navigation'

interface PostsRedirectPageProps {
  params: Promise<{
    slug: string
  }>
}

/**
 * Redirect /admin/forums/[slug]/posts to /admin/forums/[slug]
 * Posts are displayed on the forum detail page
 */
export default async function PostsRedirectPage({ params }: PostsRedirectPageProps) {
  const { slug } = await params
  redirect(`/admin/forums/${slug}`)
}
