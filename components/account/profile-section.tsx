'use client'

import { useState } from 'react'
import { useUser, useReverification } from '@clerk/nextjs'
import { isClerkRuntimeError } from '@clerk/clerk-react/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, Check, X, Loader2, User, Mail, Plus, Shield, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function ProfileSection() {
  const { user } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')

  // Email management state
  const [newEmail, setNewEmail] = useState('')
  const [isAddingEmail, setIsAddingEmail] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  // Email editing state
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editStep, setEditStep] = useState<'input' | 'adding' | 'verifying' | 'setting-primary' | 'deleting-old' | 'completed'>('input')

  // Reverification wrapper for email operations
  const createEmailWithVerification = useReverification(
    (email: string) => user?.createEmailAddress({ email })
  )

  const handleSave = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })

      toast.success('Profile updated successfully!')
      setIsEditing(false)
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFirstName(user?.firstName || '')
    setLastName(user?.lastName || '')
    setIsEditing(false)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setIsLoading(true)
    try {
      await user.setProfileImage({ file })
      toast.success('Profile picture updated successfully!')
    } catch (error) {
      console.error('Image upload error:', error)
      toast.error('Failed to update profile picture. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Email management functions
  const handleAddEmail = async () => {
    if (!user || !newEmail.trim()) return

    setIsAddingEmail(true)
    try {
      await createEmailWithVerification(newEmail.trim())
      toast.success('Email address added successfully! Please check your inbox to verify it.')
      setNewEmail('')
      setIsDialogOpen(false)
    } catch (error: any) {
      console.error('Add email error:', error)

      // Handle reverification cancellation gracefully
      if (isClerkRuntimeError(error) && error.code === 'reverification_cancelled') {
        toast.info('Email addition cancelled')
        return
      }

      toast.error(error.errors?.[0]?.message || 'Failed to add email address. Please try again.')
    } finally {
      setIsAddingEmail(false)
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

  // Email editing functions
  const handleStartEdit = (emailId: string, currentEmail: string) => {
    setEditingEmailId(emailId)
    setEditEmail(currentEmail)
    setEditStep('input')
    setIsEditDialogOpen(true)
  }

  const handleCancelEdit = () => {
    setEditingEmailId(null)
    setEditEmail('')
    setEditStep('input')
    setIsEditDialogOpen(false)
  }

  const handleEditEmail = async () => {
    if (!user || !editingEmailId || !editEmail.trim()) return

    try {
      // Step 1: Add new email address with reverification
      setEditStep('adding')
      const newEmailAddress = await createEmailWithVerification(editEmail.trim())

      // Step 2: Prepare verification
      setEditStep('verifying')
      if (newEmailAddress) {
        await newEmailAddress.prepareVerification({ strategy: 'email_code' })
      }
      toast.success(`Verification email sent to ${editEmail}. Please check your inbox.`)

      // Step 3: Wait for verification (user will need to verify manually)
      // For now, we'll show instructions and let user continue manually
      setEditStep('completed')
      toast.info('Please verify your new email address, then set it as primary and delete the old one if desired.')

    } catch (error: any) {
      console.error('Edit email error:', error)

      // Handle reverification cancellation gracefully
      if (isClerkRuntimeError(error) && error.code === 'reverification_cancelled') {
        toast.info('Email edit cancelled')
        setEditStep('input')
        return
      }

      toast.error(error.errors?.[0]?.message || 'Failed to update email address.')
      setEditStep('input')
    }
  }

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || user?.username || 'User'

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName?.[0] || user?.username?.[0] || 'U'

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
      <CardHeader className="space-y-1 p-0 pb-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <CardTitle className="text-xl font-semibold">Profile & Email</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Manage your profile information, picture, and email addresses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        {/* Profile Picture Section */}
        <div className="flex items-start space-x-3">
          <div className="relative flex-shrink-0">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user.imageUrl} alt={displayName} />
              <AvatarFallback className="text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-sm font-medium">Profile Picture</h3>
            <p className="text-xs text-muted-foreground leading-tight">
              Recommended: Square format, up to 10MB
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                disabled={isLoading}
                asChild
                className="min-h-[32px] h-8 text-xs w-auto"
              >
                <label htmlFor="profile-image" className="cursor-pointer flex items-center">
                  <Upload className="h-3 w-3 mr-1" />
                  Upload
                  <input
                    id="profile-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="sr-only"
                  />
                </label>
              </Button>
              {user.imageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => user.setProfileImage({ file: null })}
                  className="min-h-[32px] h-8 text-xs w-auto"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Name Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Personal Information</h3>
            {!isEditing && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="min-h-[32px] h-8 text-xs"
              >
                Edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-xs text-muted-foreground font-medium">
                First Name
              </Label>
              {isEditing ? (
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading}
                  className="h-9 text-sm"
                  placeholder="Enter first name"
                />
              ) : (
                <div className="h-9 px-3 py-2 border border-input rounded-md bg-muted/50 flex items-center text-sm">
                  {user.firstName || <span className="text-muted-foreground">Not set</span>}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-xs text-muted-foreground font-medium">
                Last Name
              </Label>
              {isEditing ? (
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoading}
                  className="h-9 text-sm"
                  placeholder="Enter last name"
                />
              ) : (
                <div className="h-9 px-3 py-2 border border-input rounded-md bg-muted/50 flex items-center text-sm">
                  {user.lastName || <span className="text-muted-foreground">Not set</span>}
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center space-x-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                size="sm"
                className="min-h-[36px] h-9 text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                size="sm"
                className="min-h-[36px] h-9 text-sm"
              >
                <X className="h-3 w-3 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Email Management Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <h3 className="text-xl font-semibold">Email Addresses</h3>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="min-h-[44px]">
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
                      disabled={isAddingEmail}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={handleAddEmail}
                      disabled={isAddingEmail || !newEmail.trim()}
                      className="flex-1"
                    >
                      {isAddingEmail ? (
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
                      disabled={isAddingEmail}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Email Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Email Address</DialogTitle>
                  <DialogDescription>
                    {editStep === 'input' && 'Enter a new email address. This will add the new email and send a verification code.'}
                    {editStep === 'adding' && 'Adding new email address...'}
                    {editStep === 'verifying' && 'Sending verification email...'}
                    {editStep === 'completed' && 'New email address added! Please check your inbox to verify it, then set it as primary if desired.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">New Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="Enter new email address"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      disabled={editStep !== 'input'}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={handleEditEmail}
                      disabled={editStep !== 'input' || !editEmail.trim()}
                      className="flex-1"
                    >
                      {editStep === 'adding' || editStep === 'verifying' ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editStep === 'adding' ? 'Adding...' : 'Sending...'}
                        </>
                      ) : editStep === 'completed' ? (
                        'Close'
                      ) : (
                        'Change Email'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={editStep === 'completed' ? handleCancelEdit : handleCancelEdit}
                      disabled={editStep === 'adding' || editStep === 'verifying'}
                    >
                      {editStep === 'completed' ? 'Close' : 'Cancel'}
                    </Button>
                  </div>
                  {editStep === 'completed' && (
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>Next steps:</strong>
                        <br />
                        1. Check your inbox and verify the new email
                        <br />
                        2. Set the new email as primary if desired
                        <br />
                        3. Delete the old email address
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <p className="text-sm text-muted-foreground">
            Manage your email addresses and verification status
          </p>

          <div className="space-y-3">
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
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStartEdit(emailAddress.id, emailAddress.emailAddress)}
                    disabled={loadingAction !== null}
                    className="min-h-[44px]"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>

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
          </div>
        </div>
      </CardContent>
    </Card>
  )
}