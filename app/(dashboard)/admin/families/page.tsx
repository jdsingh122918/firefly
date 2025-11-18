'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Edit, Trash2, Users, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@clerk/nextjs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FamilyTile } from '@/components/families/family-tile'

interface Family {
  id: string
  name: string
  description?: string
  createdAt: string
  createdBy?: {
    id: string
    name: string
    email: string
  }
  members: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
  memberCount: number
}

interface FamiliesResponse {
  families: Family[]
  total: number
}

export default function FamiliesPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredFamilies, setFilteredFamilies] = useState<Family[]>([])

  // Fetch families from API
  const fetchFamilies = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/families', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please check authentication.')
      }

      if (!response.ok) {
        // Handle 401 specially
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in.')
        }
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to fetch families (${response.status})`)
      }

      const data: FamiliesResponse = await response.json()
      setFamilies(data.families || [])
      setFilteredFamilies(data.families || [])
    } catch (err) {
      console.error('Error fetching families:', err)
      setError(err instanceof Error ? err.message : 'Failed to load families')
    } finally {
      setLoading(false)
    }
  }, [])

  // Filter families based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredFamilies(families)
    } else {
      const filtered = families.filter(family =>
        family.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (family.description && family.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (family.createdBy?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      )
      setFilteredFamilies(filtered)
    }
  }, [searchTerm, families])

  // Fetch families on component mount
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchFamilies()
    }
  }, [isLoaded, isSignedIn, fetchFamilies])

  // Handle family deletion
  const handleDeleteFamily = async (familyId: string, familyName: string) => {
    if (!confirm(`Are you sure you want to delete "${familyName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/families/${familyId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete family')
      }

      // Success! Show toast and refresh the families list
      toast.success(`Family "${familyName}" deleted successfully`)
      await fetchFamilies()
    } catch (err) {
      console.error('Error deleting family:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete family'
      toast.error(errorMessage)
    }
  }

  // Show loading while authentication is being verified
  if (!isLoaded || loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error if not authenticated
  if (isLoaded && !isSignedIn) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Families</h1>
          <p className="text-muted-foreground">Authentication required</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Please sign in to access this page</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Families</h1>
          <p className="text-muted-foreground">Manage families and their members</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Error: {error}</p>
              <Button onClick={fetchFamilies}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Families</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage families and their members ({families.length} total)
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto min-h-[44px]">
          <Link href="/admin/families/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Family
          </Link>
        </Button>
      </div>

      {/* Families Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Families</CardTitle>
          <CardDescription>
            View and manage all families in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center space-x-2 mb-6">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search families by name, description, or creator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Empty State */}
          {filteredFamilies.length === 0 && (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No families found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first family.'}
              </p>
              {!searchTerm && (
                <div className="mt-6">
                  <Button asChild>
                    <Link href="/admin/families/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Family
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Medium Tablet: 2-Column Tiles View */}
          {filteredFamilies.length > 0 && (
            <div className="hidden md:grid lg:hidden gap-3 grid-cols-2">
              {filteredFamilies.map((family) => (
                <FamilyTile
                  key={family.id}
                  family={family}
                  onDelete={handleDeleteFamily}
                  basePath="/admin/families"
                />
              ))}
            </div>
          )}

          {/* Desktop Table View */}
          {filteredFamilies.length > 0 && (
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Family Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFamilies.map((family) => (
                    <TableRow key={family.id}>
                      <TableCell className="font-medium">
                        <div>
                          <Link
                            href={`/admin/families/${family.id}`}
                            className="text-primary hover:underline"
                          >
                            {family.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {family.description || (
                            <span className="text-muted-foreground italic">No description</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {family.memberCount} {family.memberCount === 1 ? 'member' : 'members'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{family.createdBy?.name || 'Unknown Creator'}</div>
                          <div className="text-muted-foreground">{family.createdBy?.email || 'N/A'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(family.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="p-0 min-h-[44px] min-w-[44px]">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/families/${family.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/families/${family.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Family
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteFamily(family.id, family.name)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Family
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile Tiles View */}
          {filteredFamilies.length > 0 && (
            <div className="grid gap-3 md:hidden">
              {filteredFamilies.map((family) => (
                <FamilyTile
                  key={family.id}
                  family={family}
                  onDelete={handleDeleteFamily}
                  basePath="/admin/families"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}