'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Trash2, Mail, Phone, Calendar, User, Shield, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FamilyCombobox } from '@/components/ui/family-combobox'

interface UserDetails {
  id: string
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  name: string
  role: string
  familyId?: string
  family?: {
    id: string
    name: string
  }
  phoneNumber?: string
  phoneVerified: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    name: string
    email: string
  }
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [familyAssignDialog, setFamilyAssignDialog] = useState(false)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | undefined>()
  const [assigningFamily, setAssigningFamily] = useState(false)

  // Fetch user details
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/users/${userId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('User not found')
        } else {
          throw new Error('Failed to fetch user details')
        }
        return
      }

      const data = await response.json()
      setUser(data.user)
    } catch (err) {
      console.error('Error fetching user:', err)
      setError(err instanceof Error ? err.message : 'Failed to load user details')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Handle user deletion
  const handleDeleteUser = async () => {
    if (!user) return

    if (!confirm(`Are you sure you want to delete "${user.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }

      // Redirect to users list
      router.push('/admin/users')
    } catch (err) {
      console.error('Error deleting user:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  // Handle family assignment
  const handleAssignFamily = async () => {
    if (!user) return

    try {
      setAssigningFamily(true)

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familyId: selectedFamilyId || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update family assignment')
      }

      // Refresh user data to show updated family
      await fetchUser()
      setFamilyAssignDialog(false)
      setSelectedFamilyId(undefined)

      console.log('✅ Family assignment updated successfully')
    } catch (err) {
      console.error('Error assigning family:', err)
      alert(err instanceof Error ? err.message : 'Failed to assign family')
    } finally {
      setAssigningFamily(false)
    }
  }

  // Open family assignment dialog
  const openFamilyAssignDialog = () => {
    setSelectedFamilyId(user?.familyId || undefined)
    setFamilyAssignDialog(true)
  }

  // Fetch user on component mount
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">User Not Found</h1>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {error || 'The requested user could not be found.'}
              </p>
              <Button asChild>
                <Link href="/admin/users">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Users
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive'
      case 'VOLUNTEER':
        return 'default'
      case 'MEMBER':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return Shield
      case 'VOLUNTEER':
        return User
      case 'MEMBER':
        return Users
      default:
        return User
    }
  }

  const RoleIcon = getRoleIcon(user.role)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="flex items-start space-x-3 sm:space-x-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-start space-x-3 sm:space-x-4 min-w-0 flex-1">
            <Avatar className="h-12 w-12 sm:h-16 sm:w-16 shrink-0">
              <AvatarFallback className="text-sm sm:text-lg">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant={getRoleColor(user.role)} className="flex items-center space-x-1">
                  <RoleIcon className="h-3 w-3" />
                  <span>{user.role}</span>
                </Badge>
                {user.emailVerified && (
                  <Badge variant="outline" className="text-green-600">
                    ✓ Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href={`/admin/users/${user.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              <span className="sm:inline">Edit User</span>
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteUser}
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span className="sm:inline">Delete User</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>
              Basic details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium">Email Address</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{user.email}</span>
                {user.emailVerified && (
                  <span className="text-green-600 text-sm">✓ Verified</span>
                )}
              </div>
            </div>

            {user.phoneNumber && (
              <div>
                <h3 className="font-medium">Phone Number</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{user.phoneNumber}</span>
                  {user.phoneVerified && (
                    <span className="text-green-600 text-sm">✓ Verified</span>
                  )}
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="font-medium">Role & Permissions</h3>
              <div className="flex items-center space-x-2 mt-1">
                <RoleIcon className="h-4 w-4 text-muted-foreground" />
                <Badge variant={getRoleColor(user.role)}>
                  {user.role}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {user.role === 'ADMIN' && 'Full system access - can manage all users and families'}
                {user.role === 'VOLUNTEER' && 'Can manage families and create member users'}
                {user.role === 'MEMBER' && 'Basic access - can view their family information'}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium">Joined</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="font-medium">Last Updated</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {new Date(user.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {user.createdBy && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium">Created By</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {user.createdBy.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.createdBy.name || 'Unknown Creator'}</p>
                      <p className="text-xs text-muted-foreground">{user.createdBy.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Family Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Family Assignment</CardTitle>
            <CardDescription>
              Family group membership and care coordination
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.family ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Users className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">{user.family.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Family member since {new Date(user.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/families/${user.family.id}`}>
                      View Family
                    </Link>
                  </Button>
                </div>

                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={openFamilyAssignDialog}>
                    Change Family Assignment
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No family assigned</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This user is not currently assigned to any family group.
                </p>
                <div className="mt-6">
                  <Button size="sm" variant="outline" onClick={openFamilyAssignDialog}>
                    Assign to Family
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>
            Technical details and account status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-medium">User ID</h3>
              <p className="text-muted-foreground font-mono text-xs">{user.id}</p>
            </div>
            <div>
              <h3 className="font-medium">Clerk ID</h3>
              <p className="text-muted-foreground font-mono text-xs">{user.clerkId}</p>
            </div>
            <div>
              <h3 className="font-medium">Account Status</h3>
              <p className="text-muted-foreground">
                {user.emailVerified ? (
                  <span className="text-green-600">Active & Verified</span>
                ) : (
                  <span className="text-amber-600">Pending Verification</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Family Assignment Dialog */}
      <Dialog open={familyAssignDialog} onOpenChange={setFamilyAssignDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Family Assignment</DialogTitle>
            <DialogDescription>
              Assign {user?.name} to a family group for care coordination.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Family</label>
                <div className="mt-2">
                  <FamilyCombobox
                    value={selectedFamilyId}
                    onValueChange={setSelectedFamilyId}
                    placeholder="Search for a family..."
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFamilyAssignDialog(false)}
              disabled={assigningFamily}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignFamily}
              disabled={assigningFamily}
            >
              {assigningFamily ? 'Assigning...' : 'Update Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}