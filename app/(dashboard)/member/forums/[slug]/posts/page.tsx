import { redirect } from 'next/navigation'

interface PostsRedirectPageProps {
  params: Promise<{
    slug: string
  }>
}

/**
 * Redirect /member/forums/[slug]/posts to /member/forums/[slug]
 * Posts are displayed on the forum detail page
 */
export default async function PostsRedirectPage({ params }: PostsRedirectPageProps) {
  const { slug } = await params
  redirect(`/member/forums/${slug}`)
}
