'use client'

import React from 'react'
import { AccountManagement } from '@/components/account/account-management'
import { UserRole } from '@prisma/client'

interface SettingsContentProps {
  userRole?: UserRole
}

export function SettingsContent({ userRole }: SettingsContentProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Account Management */}
      <AccountManagement />
    </div>
  )
}