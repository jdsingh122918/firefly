'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Trash2, UserPlus, Mail, Phone, Calendar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

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
  createdBy: {
    id: string
    name: string
    email: string
  }
  members: FamilyMember[]
  memberCount: number
}

export default function FamilyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const familyId = params.id as string

  const [family, setFamily] = useState<FamilyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/families">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{family.name}</h1>
            <p className="text-muted-foreground">
              Family Details • {family.memberCount} {family.memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/families/${family.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Family
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteFamily}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Family
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
          <CardContent className="space-y-4">
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
                    {family.createdBy.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{family.createdBy.name}</p>
                  <p className="text-xs text-muted-foreground">{family.createdBy.email}</p>
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
              <Button size="sm" variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {family.members.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No members yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add the first member to get started.
                </p>
                <div className="mt-6">
                  <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </div>
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