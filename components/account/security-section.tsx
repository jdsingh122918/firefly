'use client'

import { useUser, useSession } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Monitor, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function SecuritySection() {
  const { user } = useUser()
  const { session } = useSession()

  const handleSignOutOtherSessions = async () => {
    if (!user) return

    try {
      await user.getSessions().then(sessions => {
        const otherSessions = sessions.filter(s => s.id !== session?.id)
        return Promise.all(otherSessions.map(s => s.revoke()))
      })
      toast.success('All other sessions have been signed out.')
    } catch (error) {
      console.error('Sign out other sessions error:', error)
      toast.error('Failed to sign out other sessions.')
    }
  }

  // Function to get device icon based on last activity
  const getDeviceIcon = (lastActiveAt: Date) => {
    // This is a simple heuristic - in a real app you might have more device info
    return Monitor // Default to desktop for now
  }

  // Function to format device info
  const formatDeviceInfo = (session: any) => {
    return {
      type: 'Desktop', // Could be enhanced with real device detection
      location: 'Unknown Location', // Could be enhanced with IP geolocation
      browser: 'Unknown Browser', // Could be enhanced with user agent parsing
    }
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {/* Active Sessions */}
      <Card className="p-3">
        <CardHeader className="space-y-1 p-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold">Active Sessions</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOutOtherSessions}
              className="min-h-[32px] h-8 text-xs"
            >
              Sign Out Others
            </Button>
          </div>
          <CardDescription className="text-sm">
            Manage where you're signed in to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-0">
          {/* Current Session */}
          {session && (
            <div className="flex items-center justify-between p-2.5 border rounded-md bg-muted/30">
              <div className="flex items-center space-x-3">
                <Monitor className="h-6 w-6 text-primary" />
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <h4 className="font-medium text-sm">Current Device</h4>
                    <Badge variant="default" className="text-xs px-1.5 py-0">This Device</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Chrome • {new Date().toLocaleDateString()} • Active now
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Note about sessions */}
          <div className="text-center py-3 text-muted-foreground">
            <Shield className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
            <p className="text-xs">
              Session management helps keep your account secure by showing you where you're logged in.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Security Info */}
      <Card className="p-3">
        <CardHeader className="space-y-1 p-0 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg font-semibold">Security Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Account Created</Label>
              <div className="text-xs text-muted-foreground">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Last Updated</Label>
              <div className="text-xs text-muted-foreground">
                {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Unknown'}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Email Verified</Label>
              <div className="text-xs text-muted-foreground">
                {user.primaryEmailAddress?.verification?.status === 'verified' ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Password Enabled</Label>
              <div className="text-xs text-muted-foreground">
                {user.passwordEnabled ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}