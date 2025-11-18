'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Trash2, UserPlus, Mail, Phone, Calendar, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

interface FamilyMember {
  id: string
  name: string
  email: string
  role: string
  phoneNumber?: string
  joinedAt: string
}

interface FamilyDetails {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    name: string
    email: string
  }
  members: FamilyMember[]
  memberCount: number
}

interface UnassignedMember {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  role: string
  phoneNumber?: string
  emailVerified: boolean
  createdAt: string
}

export default function FamilyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const familyId = params.id as string

  const [family, setFamily] = useState<FamilyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add Member Modal State
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [unassignedMembers, setUnassignedMembers] = useState<UnassignedMember[]>([])
  const [loadingUnassigned, setLoadingUnassigned] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('existing')

  // Create New Member State
  const [newMemberData, setNewMemberData] = useState({
    email: '',
    firstName: '',
    lastName: ''
  })
  const [creatingNewMember, setCreatingNewMember] = useState(false)
  const [createMemberError, setCreateMemberError] = useState<string | null>(null)

  // Fetch family details
  const fetchFamily = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/families/${familyId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Family not found')
        } else {
          throw new Error('Failed to fetch family details')
        }
        return
      }

      const data = await response.json()
      setFamily(data.family)
    } catch (err) {
      console.error('Error fetching family:', err)
      setError(err instanceof Error ? err.message : 'Failed to load family details')
    } finally {
      setLoading(false)
    }
  }, [familyId])

  // Handle family deletion
  const handleDeleteFamily = async () => {
    if (!family) return

    if (!confirm(`Are you sure you want to delete "${family.name}"? This action cannot be undone and will unassign all members.`)) {
      return
    }

    try {
      const response = await fetch(`/api/families/${familyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete family')
      }

      // Redirect to families list
      router.push('/admin/families')
    } catch (err) {
      console.error('Error deleting family:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete family')
    }
  }

  // Fetch unassigned members when modal opens
  const fetchUnassignedMembers = useCallback(async () => {
    try {
      setLoadingUnassigned(true)
      setAddMemberError(null)

      const response = await fetch('/api/users/unassigned')
      if (!response.ok) {
        throw new Error('Failed to fetch unassigned members')
      }

      const data = await response.json()
      setUnassignedMembers(data.users || [])
    } catch (error) {
      console.error('Error fetching unassigned members:', error)
      setAddMemberError(error instanceof Error ? error.message : 'Failed to load available members')
    } finally {
      setLoadingUnassigned(false)
    }
  }, [])

  // Add member to family
  const addMemberToFamily = useCallback(async (userId: string) => {
    try {
      setAddingMember(true)
      setAddMemberError(null)

      const response = await fetch(`/api/families/${familyId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add member to family')
      }

      // Refresh family data to show new member
      await fetchFamily()

      // Close modal and reset state
      setShowAddMemberDialog(false)
      setSearchQuery('')
      setUnassignedMembers([])
    } catch (error) {
      console.error('Error adding member to family:', error)
      setAddMemberError(error instanceof Error ? error.message : 'Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }, [familyId, fetchFamily])

  // Create new member and assign to family
  const createNewMember = useCallback(async () => {
    try {
      setCreatingNewMember(true)
      setCreateMemberError(null)

      // Validate required fields
      if (!newMemberData.email.trim()) {
        throw new Error('Email is required')
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newMemberData.email.trim(),
          firstName: newMemberData.firstName.trim() || undefined,
          lastName: newMemberData.lastName.trim() || undefined,
          role: 'MEMBER',
          familyId: familyId, // Automatically assign to current family
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create new member')
      }

      const result = await response.json()

      // Show success message
      toast.success(`${result.user.name} has been created and added to ${family?.name}!`, {
        description: 'They will receive a sign-in link via email when they try to access the platform.'
      })

      // Refresh family data to show new member
      await fetchFamily()

      // Reset form and close modal
      setNewMemberData({ email: '', firstName: '', lastName: '' })
      setShowAddMemberDialog(false)
      setActiveTab('existing')
    } catch (error) {
      console.error('Error creating new member:', error)
      setCreateMemberError(error instanceof Error ? error.message : 'Failed to create member')
    } finally {
      setCreatingNewMember(false)
    }
  }, [newMemberData, familyId, family?.name, fetchFamily])

  // Handle new member form input changes
  const handleNewMemberInputChange = useCallback((field: string, value: string) => {
    setNewMemberData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (createMemberError) setCreateMemberError(null)
  }, [createMemberError])

  // Handle modal open
  const handleAddMemberClick = useCallback(() => {
    setShowAddMemberDialog(true)
    setActiveTab('existing')
    fetchUnassignedMembers()
  }, [fetchUnassignedMembers])

  // Filter unassigned members based on search
  const filteredUnassignedMembers = unassignedMembers.filter(member =>
    !searchQuery ||
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Fetch family on component mount
  useEffect(() => {
    fetchFamily()
  }, [fetchFamily])

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
            <CardContent className="p-3 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !family) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/families">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Family Not Found</h1>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {error || 'The requested family could not be found.'}
              </p>
              <Button asChild>
                <Link href="/admin/families">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Families
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild className="min-h-[44px]">
            <Link href="/admin/families">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{family.name}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Family Details • {family.memberCount} {family.memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild className="min-h-[44px]">
            <Link href={`/admin/families/${family.id}/edit`}>
              <Edit className="mr-0 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Edit Family</span>
              <span className="sm:hidden">Edit</span>
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteFamily}
            className="min-h-[44px]"
          >
            <Trash2 className="mr-0 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Delete Family</span>
            <span className="sm:hidden">Delete</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Family Information */}
        <Card>
          <CardHeader>
            <CardTitle>Family Information</CardTitle>
            <CardDescription>
              Basic details about this family
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            <div>
              <h3 className="font-medium">Family Name</h3>
              <p className="text-muted-foreground">{family.name}</p>
            </div>

            {family.description && (
              <div>
                <h3 className="font-medium">Description</h3>
                <p className="text-muted-foreground">{family.description}</p>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="font-medium">Created By</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {family.createdBy?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{family.createdBy?.name || 'Unknown Creator'}</p>
                  <p className="text-xs text-muted-foreground">{family.createdBy?.email || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium">Created</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(family.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <h3 className="font-medium">Last Updated</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(family.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Family Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Family Members</CardTitle>
                <CardDescription>
                  People assigned to this family ({family.members.length})
                </CardDescription>
              </div>
              <Dialog open={showAddMemberDialog} onOpenChange={(open) => {
                setShowAddMemberDialog(open)
                if (!open) {
                  // Reset all state when modal closes
                  setActiveTab('existing')
                  setSearchQuery('')
                  setAddMemberError(null)
                  setCreateMemberError(null)
                  setNewMemberData({ email: '', firstName: '', lastName: '' })
                  setUnassignedMembers([])
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleAddMemberClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Member to {family.name}</DialogTitle>
                    <DialogDescription>
                      Add an existing unassigned member or create a new member for this family.
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing">Add Existing Member</TabsTrigger>
                      <TabsTrigger value="create">Create New Member</TabsTrigger>
                    </TabsList>

                    {/* Add Existing Member Tab */}
                    <TabsContent value="existing" className="space-y-4">
                      {/* Search */}
                      <div className="space-y-2">
                        <Label htmlFor="member-search">Search members</Label>
                        <Input
                          id="member-search"
                          placeholder="Search by name or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Error */}
                      {addMemberError && (
                        <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                          {addMemberError}
                        </div>
                      )}

                      {/* Loading */}
                      {loadingUnassigned && (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
                              <Skeleton className="h-10 w-10 rounded-full" />
                              <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                              <Skeleton className="h-8 w-16" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Members List */}
                      {!loadingUnassigned && (
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {filteredUnassignedMembers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>
                                {searchQuery ? `No unassigned members found matching "${searchQuery}"` :
                                 unassignedMembers.length === 0 ? 'No unassigned members available' :
                                 'No members match your search'}
                              </p>
                              {unassignedMembers.length === 0 && (
                                <p className="text-sm mt-2">
                                  Try creating a new member using the "Create New Member" tab.
                                </p>
                              )}
                            </div>
                          ) : (
                            filteredUnassignedMembers.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback>
                                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{member.name}</p>
                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      <span>{member.email}</span>
                                    </div>
                                    {member.phoneNumber && (
                                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                        <Phone className="h-3 w-3" />
                                        <span>{member.phoneNumber}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="secondary">{member.role}</Badge>
                                  <Button
                                    size="sm"
                                    onClick={() => addMemberToFamily(member.id)}
                                    disabled={addingMember}
                                  >
                                    {addingMember ? 'Adding...' : 'Add'}
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </TabsContent>

                    {/* Create New Member Tab */}
                    <TabsContent value="create" className="space-y-4">
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm text-blue-800">
                            <strong>Create a new member account</strong> and automatically assign them to {family.name}.
                            They will receive an email invitation to set up their account.
                          </p>
                        </div>

                        {/* Create Member Form */}
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="new-email">Email address <span className="text-destructive">*</span></Label>
                            <Input
                              id="new-email"
                              type="email"
                              placeholder="member@example.com"
                              value={newMemberData.email}
                              onChange={(e) => handleNewMemberInputChange('email', e.target.value)}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="new-firstName">First name</Label>
                              <Input
                                id="new-firstName"
                                placeholder="First name"
                                value={newMemberData.firstName}
                                onChange={(e) => handleNewMemberInputChange('firstName', e.target.value)}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="new-lastName">Last name</Label>
                              <Input
                                id="new-lastName"
                                placeholder="Last name"
                                value={newMemberData.lastName}
                                onChange={(e) => handleNewMemberInputChange('lastName', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                            <div>
                              <p className="text-sm font-medium">Role</p>
                              <p className="text-xs text-muted-foreground">Automatically set to Member</p>
                            </div>
                            <Badge variant="secondary">MEMBER</Badge>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                            <div>
                              <p className="text-sm font-medium">Family Assignment</p>
                              <p className="text-xs text-muted-foreground">Will be assigned to {family.name}</p>
                            </div>
                            <Badge variant="outline">{family.name}</Badge>
                          </div>
                        </div>

                        {/* Create Member Error */}
                        {createMemberError && (
                          <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                            {createMemberError}
                          </div>
                        )}

                        {/* Create Member Button */}
                        <div className="flex justify-between pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowAddMemberDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={createNewMember}
                            disabled={!newMemberData.email.trim() || creatingNewMember}
                          >
                            {creatingNewMember ? 'Creating...' : 'Create & Add Member'}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {family.members.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No members yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This family doesn't have any members assigned yet.
                </p>
                <Button variant="outline" className="mt-4" onClick={handleAddMemberClick}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Member
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {family.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{member.email}</span>
                        </div>
                        {member.phoneNumber && (
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{member.phoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={getRoleColor(member.role)}>
                        {member.role}
                      </Badge>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}