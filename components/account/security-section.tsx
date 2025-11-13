'use client'

import { useState } from 'react'
import { useUser, useSession } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Shield, Key, Monitor, Smartphone, Globe, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function SecuritySection() {
  const { user } = useUser()
  const { session } = useSession()
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handlePasswordChange = async () => {
    if (!user || !passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('Please fill in all password fields.')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.')
      return
    }

    setIsChangingPassword(true)
    try {
      await user.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      toast.success('Password updated successfully!')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setIsDialogOpen(false)
    } catch (error: any) {
      console.error('Password change error:', error)
      toast.error(error.errors?.[0]?.message || 'Failed to update password. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

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
    <div className="space-y-6">
      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password & Security
          </CardTitle>
          <CardDescription>
            Manage your password and account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <h4 className="font-medium">Password</h4>
              <p className="text-sm text-muted-foreground">
                Last changed: {user.passwordEnabled ? 'Recently' : 'Never set'}
              </p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Enter your current password and choose a new one.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({
                          ...prev,
                          currentPassword: e.target.value
                        }))}
                        disabled={isChangingPassword}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      disabled={isChangingPassword}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      disabled={isChangingPassword}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword}
                      className="flex-1"
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false)
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        })
                      }}
                      disabled={isChangingPassword}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Manage where you're signed in to your account
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleSignOutOtherSessions}>
              Sign Out All Others
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Session */}
          {session && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center space-x-3">
                <Monitor className="h-8 w-8 text-primary" />
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">Current Device</h4>
                    <Badge variant="default">This Device</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Chrome • {new Date().toLocaleDateString()} • Active now
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Note about sessions */}
          <div className="text-center py-4 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Session management helps keep your account secure by showing you where you're logged in.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Security Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Created</Label>
              <div className="text-sm text-muted-foreground">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last Updated</Label>
              <div className="text-sm text-muted-foreground">
                {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Unknown'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Verified</Label>
              <div className="text-sm text-muted-foreground">
                {user.primaryEmailAddress?.verification?.status === 'verified' ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Password Enabled</Label>
              <div className="text-sm text-muted-foreground">
                {user.passwordEnabled ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}