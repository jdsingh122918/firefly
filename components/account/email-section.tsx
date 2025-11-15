'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Mail, Shield, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function EmailSection() {
  const { user } = useUser()
  const [newEmail, setNewEmail] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleAddEmail = async () => {
    if (!user || !newEmail.trim()) return

    setIsAdding(true)
    try {
      await user.createEmailAddress({ email: newEmail.trim() })
      toast.success('Email address added successfully! Please check your inbox to verify it.')
      setNewEmail('')
      setIsDialogOpen(false)
    } catch (error: any) {
      console.error('Add email error:', error)
      toast.error(error.errors?.[0]?.message || 'Failed to add email address. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleVerifyEmail = async (emailId: string) => {
    const emailAddress = user?.emailAddresses.find(email => email.id === emailId)
    if (!emailAddress) return

    setLoadingAction(`verify-${emailId}`)
    try {
      await emailAddress.prepareVerification({ strategy: 'email_code' })
      toast.success('Verification email sent! Please check your inbox.')
    } catch (error: any) {
      console.error('Verify email error:', error)
      toast.error(error.errors?.[0]?.message || 'Failed to send verification email.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSetPrimary = async (emailId: string) => {
    const emailAddress = user?.emailAddresses.find(email => email.id === emailId)
    if (!emailAddress || !user) return

    setLoadingAction(`primary-${emailId}`)
    try {
      await user.update({ primaryEmailAddressId: emailId })
      toast.success('Primary email address updated successfully!')
    } catch (error: any) {
      console.error('Set primary email error:', error)
      toast.error(error.errors?.[0]?.message || 'Failed to set primary email address.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDeleteEmail = async (emailId: string) => {
    const emailAddress = user?.emailAddresses.find(email => email.id === emailId)
    if (!emailAddress || emailAddress.id === user?.primaryEmailAddress?.id) return

    setLoadingAction(`delete-${emailId}`)
    try {
      await emailAddress.destroy()
      toast.success('Email address removed successfully!')
    } catch (error: any) {
      console.error('Delete email error:', error)
      toast.error(error.errors?.[0]?.message || 'Failed to remove email address.')
    } finally {
      setLoadingAction(null)
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
    <Card className="p-3">
      <CardHeader className="space-y-2 p-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <CardTitle className="text-xl font-semibold">Email Addresses</CardTitle>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[44px]">
                <Plus className="h-4 w-4 mr-2" />
                Add Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Email Address</DialogTitle>
                <DialogDescription>
                  Add a new email address to your account. You'll need to verify it before you can use it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email Address</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="Enter email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={isAdding}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleAddEmail}
                    disabled={isAdding || !newEmail.trim()}
                    className="flex-1"
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Email'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false)
                      setNewEmail('')
                    }}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription className="text-sm">
          Manage your email addresses and verification status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        {user.emailAddresses.map((emailAddress) => (
          <div
            key={emailAddress.id}
            className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="font-medium text-sm">{emailAddress.emailAddress}</span>
                {emailAddress.id === user.primaryEmailAddress?.id && (
                  <Badge variant="default" className="text-xs px-1.5 py-0">
                    <Shield className="h-2 w-2 mr-0.5" />
                    Primary
                  </Badge>
                )}
                <Badge
                  variant={
                    emailAddress.verification?.status === 'verified'
                      ? 'default'
                      : 'outline'
                  }
                  className="text-xs px-1.5 py-0"
                >
                  {emailAddress.verification?.status === 'verified' ? '✓ Verified' : 'Pending Verification'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-tight">
                {emailAddress.verification?.status === 'verified'
                  ? 'Verified and ready for notifications'
                  : 'Click verify to confirm ownership'}
              </p>
            </div>

            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {emailAddress.verification?.status !== 'verified' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyEmail(emailAddress.id)}
                  disabled={loadingAction === `verify-${emailAddress.id}`}
                  className="min-h-[44px]"
                >
                  {loadingAction === `verify-${emailAddress.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </Button>
              )}

              {emailAddress.id !== user.primaryEmailAddress?.id &&
                emailAddress.verification?.status === 'verified' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetPrimary(emailAddress.id)}
                  disabled={loadingAction === `primary-${emailAddress.id}`}
                  className="min-h-[44px]"
                >
                  {loadingAction === `primary-${emailAddress.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Set Primary'
                  )}
                </Button>
              )}

              {emailAddress.id !== user.primaryEmailAddress?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteEmail(emailAddress.id)}
                  disabled={loadingAction === `delete-${emailAddress.id}`}
                  className="min-h-[44px]"
                >
                  {loadingAction === `delete-${emailAddress.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}

        {user.emailAddresses.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No email addresses added yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}