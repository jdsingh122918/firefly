'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileSection } from './profile-section'
import { EmailSection } from './email-section'
import { SecuritySection } from './security-section'
import { User, Mail, Shield } from 'lucide-react'

export function AccountManagement() {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Account Management</h2>
        <p className="text-muted-foreground mt-2">
          Manage your profile, email addresses, and security settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSection />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <EmailSection />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecuritySection />
        </TabsContent>
      </Tabs>
    </div>
  )
}