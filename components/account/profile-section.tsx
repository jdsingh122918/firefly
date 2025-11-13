'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function ProfileSection() {
  const { user } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')

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
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Manage your profile information and profile picture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Picture Section */}
        <div className="flex items-center space-x-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.imageUrl} alt={displayName} />
              <AvatarFallback className="text-lg font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Profile Picture</h3>
            <p className="text-sm text-muted-foreground">
              Recommended size: 1:1, up to 10MB
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                asChild
              >
                <label htmlFor="profile-image" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
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
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => user.setProfileImage({ file: null })}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Name Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Personal Information</h3>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              {isEditing ? (
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <div className="h-9 px-3 py-1 border border-input rounded-md bg-muted flex items-center">
                  {user.firstName || 'Not set'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              {isEditing ? (
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <div className="h-9 px-3 py-1 border border-input rounded-md bg-muted flex items-center">
                  {user.lastName || 'Not set'}
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
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Email Section (Read-only for now, will add management in next component) */}
        <div className="space-y-2">
          <Label>Email Address</Label>
          <div className="h-9 px-3 py-1 border border-input rounded-md bg-muted flex items-center justify-between">
            <span>{user.primaryEmailAddress?.emailAddress}</span>
            <span className="text-xs text-muted-foreground">
              {user.primaryEmailAddress?.verification?.status === 'verified' ? '✓ Verified' : '⚠ Unverified'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}