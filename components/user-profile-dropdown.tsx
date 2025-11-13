'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserRole } from '@prisma/client'
import {
  Users,
  Heart,
  Settings,
  Bug,
  LogOut,
  User,
  ChevronUp
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

interface UserInfo {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  imageUrl?: string | null
}

interface UserProfileDropdownProps {
  user?: UserInfo
  userRole?: UserRole
}

export function UserProfileDropdown({ user, userRole }: UserProfileDropdownProps) {
  const { signOut } = useClerk()
  const router = useRouter()

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName
      ? user.firstName
      : user?.email?.split('@')[0] || 'User'

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName
      ? user.firstName[0]
      : user?.email?.[0]?.toUpperCase() || 'U'

  const handleSignOut = async () => {
    await signOut(() => router.push('/sign-in'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto p-2 w-full justify-start gap-3 hover:bg-accent"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.imageUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start flex-1">
            <span className="text-sm font-medium truncate max-w-[120px]">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {user?.email}
            </span>
          </div>
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64"
        side="top"
      >
        {/* User info header */}
        <div className="flex items-center gap-3 p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.imageUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{displayName}</span>
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            {userRole && (
              <span className="text-xs text-primary font-medium uppercase">
                {userRole}
              </span>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Account Settings */}
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=account">
            <User className="mr-2 h-4 w-4" />
            Manage Account
          </Link>
        </DropdownMenuItem>

        {/* General Settings */}
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings & Preferences
          </Link>
        </DropdownMenuItem>

        {/* Admin-only items */}
        {userRole === UserRole.ADMIN && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4" />
                User Management
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/families">
                <Heart className="mr-2 h-4 w-4" />
                Family Management
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/debug">
                <Bug className="mr-2 h-4 w-4" />
                Debug Tools
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {/* Volunteer-only items */}
        {userRole === UserRole.VOLUNTEER && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/volunteer/families">
                <Heart className="mr-2 h-4 w-4" />
                My Families
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Sign out */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            handleSignOut()
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}