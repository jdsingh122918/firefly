'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Edit, Trash2, Users, MoreHorizontal } from 'lucide-react'
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

interface User {
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
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [familyFilter, setFamilyFilter] = useState<string>('')

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)

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
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, roleFilter, familyFilter])

  // Fetch users on component mount and when filters change
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Debounced search
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchUsers()
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [fetchUsers])

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
      await fetchUsers()
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
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-80 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
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
              <Button onClick={fetchUsers}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage platform users and their roles ({users.length} total)
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Link>
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage all platform users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center space-x-2 flex-1 min-w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-32">
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
              <SelectTrigger className="w-36">
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

          {/* Table */}
          {users.length === 0 ? (
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
                  <Button asChild>
                    <Link href="/admin/users/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create User
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
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
                        {user.createdBy && (
                          <div className="text-xs text-muted-foreground">
                            by {user.createdBy.name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}