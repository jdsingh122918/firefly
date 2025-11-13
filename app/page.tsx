import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getDefaultRoute, UserRole } from '@/lib/auth/roles'

export default async function HomePage() {
  const { userId, sessionClaims } = await auth()

  // If user is authenticated, redirect to appropriate dashboard
  const userRole = (sessionClaims?.metadata as { role?: string })?.role as UserRole | undefined
  if (userId && userRole) {
    const defaultRoute = getDefaultRoute(userRole)
    redirect(defaultRoute)
  }

  // If user is not authenticated, redirect to sign-in
  redirect('/sign-in')
}
