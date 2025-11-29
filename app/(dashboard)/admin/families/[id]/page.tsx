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

interface AssignedVolunteer {
  id: string
  name: string
  email: string
  assignedAt: string
  role: string
  assignedBy?: {
    id: string
    name: string
  }
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

  // Volunteer management state
  const [assignedVolunteers, setAssignedVolunteers] = useState<AssignedVolunteer[]>([])
  const [loadingVolunteers, setLoadingVolunteers] = useState(false)
  const [volunteerError, setVolunteerError] = useState<string | null>(null)

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

  // Manage Volunteers Modal State
  const [showVolunteerModal, setShowVolunteerModal] = useState(false)
  const [availableVolunteers, setAvailableVolunteers] = useState<UnassignedMember[]>([])
  const [loadingAvailableVolunteers, setLoadingAvailableVolunteers] = useState(false)
  const [volunteerManageError, setVolunteerManageError] = useState<string | null>(null)
  const [assigningVolunteer, setAssigningVolunteer] = useState(false)
  const [removingVolunteer, setRemovingVolunteer] = useState<string | null>(null)

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

  // Fetch assigned volunteers
  const fetchAssignedVolunteers = useCallback(async () => {
    try {
      setLoadingVolunteers(true)
      setVolunteerError(null)

      const response = await fetch(`/api/families/${familyId}/volunteers`)
      if (!response.ok) {
        throw new Error('Failed to fetch assigned volunteers')
      }

      const data = await response.json()
      setAssignedVolunteers(data.volunteers || [])
    } catch (err) {
      console.error('Error fetching assigned volunteers:', err)
      setVolunteerError(err instanceof Error ? err.message : 'Failed to load assigned volunteers')
    } finally {
      setLoadingVolunteers(false)
    }
  }, [familyId])

  // Fetch available volunteers (not assigned to this family)
  const fetchAvailableVolunteers = useCallback(async () => {
    try {
      setLoadingAvailableVolunteers(true)
      setVolunteerManageError(null)

      const response = await fetch('/api/users?role=VOLUNTEER')
      if (!response.ok) {
        throw new Error('Failed to fetch available volunteers')
      }

      const data = await response.json()
      const volunteers = data.users || []

      // Filter out volunteers already assigned to this family
      const assignedVolunteerIds = new Set(assignedVolunteers.map(v => v.id))
      const availableVolunteers = volunteers.filter((volunteer: UnassignedMember) => !assignedVolunteerIds.has(volunteer.id))

      setAvailableVolunteers(availableVolunteers)
    } catch (err) {
      console.error('Error fetching available volunteers:', err)
      setVolunteerManageError(err instanceof Error ? err.message : 'Failed to load available volunteers')
    } finally {
      setLoadingAvailableVolunteers(false)
    }
  }, [assignedVolunteers])

  // Assign volunteer to family
  const assignVolunteerToFamily = useCallback(async (volunteerId: string) => {
    try {
      setAssigningVolunteer(true)
      setVolunteerManageError(null)

      const response = await fetch(`/api/families/${familyId}/volunteers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ volunteerId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to assign volunteer to family')
      }

      // Refresh assigned volunteers and available volunteers
      await fetchAssignedVolunteers()
      await fetchAvailableVolunteers()

      toast.success('Volunteer assigned successfully!')
    } catch (error) {
      console.error('Error assigning volunteer to family:', error)
      setVolunteerManageError(error instanceof Error ? error.message : 'Failed to assign volunteer')
    } finally {
      setAssigningVolunteer(false)
    }
  }, [familyId, fetchAssignedVolunteers, fetchAvailableVolunteers])

  // Remove volunteer from family
  const removeVolunteerFromFamily = useCallback(async (volunteerId: string) => {
    try {
      setRemovingVolunteer(volunteerId)
      setVolunteerManageError(null)

      const response = await fetch(`/api/families/${familyId}/volunteers/${volunteerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove volunteer from family')
      }

      // Refresh assigned volunteers and available volunteers
      await fetchAssignedVolunteers()
      await fetchAvailableVolunteers()

      toast.success('Volunteer removed successfully!')
    } catch (error) {
      console.error('Error removing volunteer from family:', error)
      setVolunteerManageError(error instanceof Error ? error.message : 'Failed to remove volunteer')
    } finally {
      setRemovingVolunteer(null)
    }
  }, [familyId, fetchAssignedVolunteers, fetchAvailableVolunteers])

  // Handle volunteer modal open
  const handleManageVolunteersClick = useCallback(() => {
    setShowVolunteerModal(true)
    fetchAvailableVolunteers()
  }, [fetchAvailableVolunteers])

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

  // Fetch family and volunteers on component mount
  useEffect(() => {
    fetchFamily()
    fetchAssignedVolunteers()
  }, [fetchFamily, fetchAssignedVolunteers])

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
          <Button variant="default" size="icon" asChild className="min-h-[44px]">
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
                                  Try creating a new member using the &quot;Create New Member&quot; tab.
                                </p>
                              )}
                            </div>
                          ) : (
                            filteredUnassignedMembers.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                  <Avatar className="h-10 w-10 flex-shrink-0">
                                    <AvatarFallback>
                                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{member.name}</p>
                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                      <Mail className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate">{member.email}</span>
                                    </div>
                                    {member.phoneNumber && (
                                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                        <Phone className="h-3 w-3" />
                                        <span>{member.phoneNumber}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
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
                  This family doesn&apos;t have any members assigned yet.
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
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback>
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{member.name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        {member.phoneNumber && (
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{member.phoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
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

      {/* Assigned Volunteers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assigned Volunteers</CardTitle>
              <CardDescription>
                Volunteers who can manage this family ({assignedVolunteers.length})
              </CardDescription>
            </div>
            <Dialog open={showVolunteerModal} onOpenChange={(open) => {
              setShowVolunteerModal(open)
              if (!open) {
                // Reset state when modal closes
                setVolunteerManageError(null)
                setAvailableVolunteers([])
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleManageVolunteersClick}>
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Volunteers
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col backdrop-blur-sm bg-background/95 border shadow-md">
                <DialogHeader className="pb-3 border-b">
                  <DialogTitle className="text-xl font-semibold">Volunteer Management</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Manage volunteer access for <span className="font-medium text-foreground">{family.name}</span>
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="available" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="assigned" className="flex items-center gap-2">
                      Currently Assigned
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {assignedVolunteers.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="available" className="flex items-center gap-2">
                      Available Volunteers
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {availableVolunteers.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>

                  {/* Currently Assigned Tab */}
                  <TabsContent value="assigned" className="flex-1 overflow-y-auto mt-0">
                    {assignedVolunteers.length === 0 ? (
                      <div className="flex items-center justify-center min-h-[300px]">
                        <div className="text-center py-8 px-4">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                            <UserPlus className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">No volunteers assigned yet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Switch to &quot;Available Volunteers&quot; to assign someone
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignedVolunteers.map((volunteer) => (
                          <div
                            key={volunteer.id}
                            className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                          >
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                                {volunteer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{volunteer.name}</p>
                              <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeVolunteerFromFamily(volunteer.id)}
                              disabled={removingVolunteer === volunteer.id}
                              className="shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
                            >
                              {removingVolunteer === volunteer.id ? 'Removing...' : 'Remove'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Available Volunteers Tab */}
                  <TabsContent value="available" className="flex-1 overflow-y-auto mt-0">
                    {volunteerManageError && (
                      <div className="flex items-start gap-2 p-3 mb-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <span className="text-sm text-destructive">{volunteerManageError}</span>
                      </div>
                    )}

                    {loadingAvailableVolunteers ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
                            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-1/2" />
                              <Skeleton className="h-3 w-2/3" />
                            </div>
                            <Skeleton className="h-9 w-16 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : availableVolunteers.length === 0 ? (
                      <div className="flex items-center justify-center min-h-[300px]">
                        <div className="text-center py-8 px-4">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                            <UserPlus className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">No volunteers available</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            All volunteers are already assigned to families
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableVolunteers.map((volunteer) => (
                          <div
                            key={volunteer.id}
                            className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                          >
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                                {volunteer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{volunteer.name}</p>
                              <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => assignVolunteerToFamily(volunteer.id)}
                              disabled={assigningVolunteer}
                              className="shrink-0"
                            >
                              {assigningVolunteer ? 'Assigning...' : 'Assign'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {volunteerError && (
            <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md mb-4">
              {volunteerError}
            </div>
          )}

          {loadingVolunteers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : assignedVolunteers.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No volunteers assigned</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This family doesn&apos;t have any volunteers assigned to manage it yet.
              </p>
              <Button variant="outline" className="mt-4" onClick={handleManageVolunteersClick}>
                <Plus className="h-4 w-4 mr-2" />
                Assign First Volunteer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedVolunteers.map((volunteer) => (
                <div key={volunteer.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {volunteer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{volunteer.name}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{volunteer.email}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {volunteer.role} since {new Date(volunteer.assignedAt).toLocaleDateString()}
                          {volunteer.assignedBy && (
                            <span className="ml-1">by {volunteer.assignedBy.name}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="default">VOLUNTEER</Badge>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/users/${volunteer.id}`}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}