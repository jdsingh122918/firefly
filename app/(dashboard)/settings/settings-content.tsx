'use client'

import React, { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { NotificationPreferences } from '@/components/notifications/notification-preferences'
import { AccountManagement } from '@/components/account/account-management'
import { UserRole } from '@prisma/client'
import { Bell, User, Shield, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface SettingsContentProps {
  userRole?: UserRole
}

export function SettingsContent({ userRole }: SettingsContentProps) {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get active tab from URL or default to notifications
  const activeTab = searchParams.get('tab') || 'notifications'

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabId)
    router.push(`/settings?${params.toString()}`, { scroll: false })
  }

  // Set default tab in URL if none specified
  useEffect(() => {
    if (!searchParams.get('tab')) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'notifications')
      router.replace(`/settings?${params.toString()}`, { scroll: false })
    }
  }, [searchParams, router])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2">
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2" disabled>
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              Soon
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="accessibility" className="flex items-center gap-2" disabled>
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Accessibility</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              Soon
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab - Primary focus as requested */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <NotificationPreferences />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab - Custom Account Management */}
        <TabsContent value="account" className="mt-6">
          <AccountManagement />
        </TabsContent>

        {/* Future tabs - Coming soon placeholders */}
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Security Settings</h3>
                <p className="text-muted-foreground mb-4">
                  Advanced security features including two-factor authentication and session management.
                </p>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accessibility" className="mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Accessibility Settings</h3>
                <p className="text-muted-foreground mb-4">
                  Customize display preferences including font size, contrast, and color scheme.
                </p>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}