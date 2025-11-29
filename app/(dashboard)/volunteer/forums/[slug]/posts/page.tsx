import { redirect } from 'next/navigation'

interface PostsRedirectPageProps {
  params: Promise<{
    slug: string
  }>
}

/**
 * Redirect /volunteer/forums/[slug]/posts to /volunteer/forums/[slug]
 * Posts are displayed on the forum detail page
 */
export default async function PostsRedirectPage({ params }: PostsRedirectPageProps) {
  const { slug } = await params
  redirect(`/volunteer/forums/${slug}`)
}
