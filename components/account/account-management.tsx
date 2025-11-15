'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileSection } from './profile-section'
import { SecuritySection } from './security-section'
import { User, Shield } from 'lucide-react'

export function AccountManagement() {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 text-sm">
            <User className="h-3 w-3" />
            <span className="hidden sm:inline">Profile & Email</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-1.5 text-sm">
            <Shield className="h-3 w-3" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-3">
          <ProfileSection />
        </TabsContent>

        <TabsContent value="security" className="mt-3">
          <SecuritySection />
        </TabsContent>
      </Tabs>
    </div>
  )
}