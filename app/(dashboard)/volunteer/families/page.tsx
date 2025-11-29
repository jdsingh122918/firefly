'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Users } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function VolunteerFamiliesPage() {
  const { isSignedIn } = useAuth()
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetchFamilies = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
      })

      const response = await fetch(`/api/families?${searchParams}`)

      if (!response.ok) {
        throw new Error('Failed to fetch families')
      }

      const data: FamiliesResponse = await response.json()
      setFamilies(data.families)
      setTotal(data.total)
    } catch (err) {
      console.error('Error fetching families:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch families')
      toast.error('Failed to load families')
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm])

  useEffect(() => {
    if (isSignedIn) {
      fetchFamilies()
    }
  }, [fetchFamilies, isSignedIn])

  const handleDelete = async (familyId: string, familyName: string) => {
    if (!window.confirm(`Are you sure you want to delete the family "${familyName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/families/${familyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete family')
      }

      toast.success('Family deleted successfully')
      fetchFamilies() // Refresh the list
    } catch (err) {
      console.error('Error deleting family:', err)
      toast.error('Failed to delete family')
    }
  }

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )

  if (!isSignedIn) {
    return <div>Please sign in to view families.</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Families</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage families you&apos;ve created and their members
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto min-h-[44px]">
          <Link href="/volunteer/families/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Family
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Families</CardTitle>
          <CardDescription>
            Find families by name or description
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search families..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1) // Reset to first page on new search
              }}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Families List */}
      <Card>
        <CardHeader>
          <CardTitle>Families ({total})</CardTitle>
          <CardDescription>
            Families you have access to manage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Error: {error}</p>
              <Button variant="outline" onClick={fetchFamilies} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : families.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-muted-foreground">
                {searchTerm ? 'No families found' : 'No families yet'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm
                  ? 'Try adjusting your search terms.'
                  : 'Get started by creating your first family.'}
              </p>
              {!searchTerm && (
                <div className="mt-6">
                  <Button asChild>
                    <Link href="/volunteer/families/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Family
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Medium Tablet: 2-Column Tiles View */}
              <div className="hidden md:grid lg:hidden gap-3 grid-cols-2">
                {families.map((family) => (
                  <FamilyTile
                    key={family.id}
                    family={family}
                    onDelete={handleDelete}
                    basePath="/volunteer/families"
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Family Name</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead className="w-32">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {families.map((family) => (
                      <TableRow key={family.id}>
                        <TableCell>
                          <div>
                            <Link
                              href={`/volunteer/families/${family.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {family.name}
                            </Link>
                            {family.description && (
                              <div className="text-sm text-muted-foreground">
                                {family.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{family.memberCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{family.createdBy?.name || 'Unknown Creator'}</div>
                            <div className="text-muted-foreground">
                              {family.createdBy?.email || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="default" size="sm" asChild>
                            <Link href={`/volunteer/families/${family.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Tiles View */}
              <div className="grid gap-3 md:hidden">
                {families.map((family) => (
                  <FamilyTile
                    key={family.id}
                    family={family}
                    onDelete={handleDelete}
                    basePath="/volunteer/families"
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 10 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total} families
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page * 10 >= total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}