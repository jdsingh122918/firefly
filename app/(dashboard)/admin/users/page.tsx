'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Edit, Trash2, Users, MoreHorizontal, CheckCircle, Calendar, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { UserTile } from '@/components/users/user-tile'
import { UserRole } from '@prisma/client'

interface User {
  id: string
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  name: string
  role: UserRole
  familyId?: string
  family?: {
    id: string
    name: string
  }
  phoneNumber?: string
  phoneVerified: boolean
  emailVerified: boolean
  createdAt: string
  createdBy?: {
    id: string
    name: string
  }
}

interface UsersResponse {
  users: User[]
  total: number
  filters: {
    role: string | null
    familyId: string | null
    search: string | null
    withoutFamily: boolean
  }
}


export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [familyFilter, setFamilyFilter] = useState<string>('')

  // Fetch users from API - stable function without useCallback
  const fetchUsers = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true)
      } else {
        setSearching(true)
      }

      // Build query parameters
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (roleFilter && roleFilter !== 'all') params.append('role', roleFilter)
      if (familyFilter === 'none') params.append('withoutFamily', 'true')
      else if (familyFilter && familyFilter !== 'all') params.append('familyId', familyFilter)

      const response = await fetch(`/api/users?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data: UsersResponse = await response.json()
      setUsers(data.users)
      setError(null) // Clear any previous errors
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      } else {
        setSearching(false)
      }
    }
  }

  // Initial load when component mounts
  useEffect(() => {
    fetchUsers(true)
  }, [])

  // Debounced search - single effect with direct dependency on filter states
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchUsers(false)
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm, roleFilter, familyFilter])

  // Handle user deletion
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete "${userName}"? This action cannot be undone.`)) {
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

      // Success! Show toast and refresh the users list
      toast.success(`User "${userName}" deleted successfully`)
      await fetchUsers(false)
    } catch (err) {
      console.error('Error deleting user:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user'
      toast.error(errorMessage)
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-6 sm:h-8 w-32" />
            <Skeleton className="h-4 w-80 mt-2" />
          </div>
          <Skeleton className="h-11 w-full sm:w-32" />
        </div>

        <Card className="border-2 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Loading Filters */}
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-11 flex-1" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Skeleton className="h-11 w-full sm:w-32" />
                  <Skeleton className="h-11 w-full sm:w-36" />
                </div>
              </div>

              {/* Loading Desktop Table */}
              <div className="hidden lg:block space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>

              {/* Loading Medium Tablet: 2-Column Tiles */}
              <div className="hidden md:grid lg:hidden gap-3 grid-cols-2 max-w-4xl mx-auto">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border-2 border-primary/20 backdrop-blur-sm shadow-sm rounded-lg p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1">
                        <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 mb-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                    <div className="flex justify-between items-center pt-1 sm:pt-2 border-t border-border/50">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Loading Mobile Tiles */}
              <div className="grid gap-3 md:hidden max-w-md mx-auto">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-2 border-primary/20 backdrop-blur-sm shadow-sm rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-11 w-11" />
                    </div>
                  </div>
                ))}
              </div>
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
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage platform users and their roles</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Error: {error}</p>
              <Button onClick={() => fetchUsers(true)}>Try Again</Button>
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
          <h1 className="text-2xl sm:text-3xl font-bold">Users</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage platform users and their roles ({users.length} total)
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto min-h-[44px]">
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Link>
        </Button>
      </div>

      {/* Users Content */}
      <Card className="border-2 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage all platform users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            {/* Search Bar */}
            <div className="flex items-center space-x-2 w-full">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-32 min-h-[44px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>

              <Select value={familyFilter} onValueChange={setFamilyFilter}>
                <SelectTrigger className="w-full sm:w-36 min-h-[44px]">
                  <SelectValue placeholder="All Families" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Families</SelectItem>
                  <SelectItem value="none">No Family</SelectItem>
                  {/* TODO: Add actual family options */}
                </SelectContent>
              </Select>

              {(searchTerm || roleFilter || familyFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto min-h-[44px]"
                  onClick={() => {
                    setSearchTerm('')
                    setRoleFilter('')
                    setFamilyFilter('')
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No users found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || roleFilter || familyFilter
                  ? 'Try adjusting your search terms or filters.'
                  : 'Get started by creating your first user.'}
              </p>
              {!searchTerm && !roleFilter && !familyFilter && (
                <div className="mt-6">
                  <Button asChild className="min-h-[44px]">
                    <Link href="/admin/users/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create User
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Desktop Table View */}
          {users.length > 0 && (
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm">
                              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link
                              href={`/admin/users/${user.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {user.name}
                            </Link>
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.family ? (
                          <Link
                            href={`/admin/families/${user.family.id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {user.family.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">
                            No family assigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.phoneNumber && (
                            <div className="text-muted-foreground">
                              {user.phoneNumber}
                              {user.phoneVerified && (
                                <span className="ml-2 text-green-600">✓</span>
                              )}
                            </div>
                          )}
                          {user.emailVerified && (
                            <div className="text-green-600 text-xs">
                              Email verified
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                          {user.createdBy?.name && (
                            <div className="text-xs text-muted-foreground">
                              by {user.createdBy.name}
                            </div>
                          )}
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
                              <Link href={`/admin/users/${user.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/users/${user.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteUser(user.id, user.name)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
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
          {users.length > 0 && (
            <div className="grid gap-3 md:hidden">
              {users.map((user) => (
                <UserTile
                  key={user.id}
                  user={{
                    ...user,
                    createdAt: new Date(user.createdAt)
                  }}
                  onDelete={handleDeleteUser}
                />
              ))}
            </div>
          )}

          {/* Medium Tablet: 2-Column Tiles View */}
          {users.length > 0 && (
            <div className="hidden md:grid lg:hidden gap-3 grid-cols-2">
              {users.map((user) => (
                <UserTile
                  key={user.id}
                  user={{
                    ...user,
                    createdAt: new Date(user.createdAt)
                  }}
                  onDelete={handleDeleteUser}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}