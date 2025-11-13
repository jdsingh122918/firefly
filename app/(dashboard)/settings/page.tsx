import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { SettingsContent } from './settings-content'

export default async function SettingsPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Get user info from database for role-based features (following dashboard layout pattern)
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true, email: true, firstName: true }
  })

  // Database fallback: Use session token role if user not in database
  const metadata = sessionClaims?.metadata as { role?: string } | undefined
  const fallbackRole = metadata?.role as UserRole | undefined
  const effectiveRole = user?.role || fallbackRole

  return <SettingsContent userRole={effectiveRole} />
}

export const metadata = {
  title: 'Settings | Firefly',
  description: 'Manage your account settings and preferences',
}