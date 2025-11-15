"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, MessageSquare, Globe, UsersRound, Lock, X, Check, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

type ForumVisibility = "PUBLIC" | "FAMILY" | "PRIVATE"

interface Family {
  id: string
  name: string
  description?: string
  memberCount: number
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

const visibilityOptions = [
  {
    value: "PUBLIC" as ForumVisibility,
    label: "Public",
    description: "Anyone can view and join this forum",
    icon: Globe,
    color: "text-green-600",
  },
  {
    value: "FAMILY" as ForumVisibility,
    label: "Family Only",
    description: "Only family members can access this forum",
    icon: UsersRound,
    color: "text-blue-600",
  },
  {
    value: "PRIVATE" as ForumVisibility,
    label: "Private",
    description: "Only invited members can access this forum",
    icon: Lock,
    color: "text-orange-600",
  },
]

export function ForumCreationPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Extract user role from pathname (e.g., /admin/forums/new -> admin)
  const userRole = pathname.split('/')[1]

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<ForumVisibility>("PUBLIC")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Visibility-specific options
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [broadcastToAllFamilies, setBroadcastToAllFamilies] = useState(false)

  // Data loading
  const [families, setFamilies] = useState<Family[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Fetch families when visibility is set to FAMILY
  const fetchFamilies = useCallback(async () => {
    try {
      setLoadingFamilies(true)
      const token = await getToken()
      const response = await fetch("/api/families", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch families")
      }

      const data = await response.json()
      setFamilies(data.families || [])
    } catch (err) {
      console.error("Error fetching families:", err)
    } finally {
      setLoadingFamilies(false)
    }
  }, [getToken])

  // Fetch users when visibility is set to PRIVATE
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true)
      const token = await getToken()
      const response = await fetch("/api/users/search", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error("Error fetching users:", err)
    } finally {
      setLoadingUsers(false)
    }
  }, [getToken])

  // Handle visibility change
  const handleVisibilityChange = (value: ForumVisibility) => {
    setVisibility(value)
    setSelectedFamilies([])
    setSelectedUsers([])
    setBroadcastToAllFamilies(false)
    setError(null)

    if (value === "FAMILY") {
      fetchFamilies()
    } else if (value === "PRIVATE") {
      fetchUsers()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError("Forum title is required")
      return
    }

    if (title.length > 100) {
      setError("Forum title must be less than 100 characters")
      return
    }

    if (description.length > 500) {
      setError("Forum description must be less than 500 characters")
      return
    }

    // Validate visibility-specific options
    if (visibility === "FAMILY" && !broadcastToAllFamilies && selectedFamilies.length === 0) {
      setError("Please select at least one family or choose to broadcast to all families")
      return
    }

    if (visibility === "PRIVATE" && selectedUsers.length === 0) {
      setError("Please select at least one user for private forum access")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      // Prepare request body
      const requestBody: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
      }

      // Add visibility-specific data
      if (visibility === "FAMILY") {
        requestBody.familyAccess = {
          broadcastToAll: broadcastToAllFamilies,
          familyIds: broadcastToAllFamilies ? [] : selectedFamilies,
        }
      } else if (visibility === "PRIVATE") {
        requestBody.privateAccess = {
          userIds: selectedUsers,
        }
      }

      const token = await getToken()
      const response = await fetch("/api/forums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create forum")
      }

      const result = await response.json()

      // Redirect to the new forum page
      router.push(`/${userRole}/forums/${result.forum.slug}`)

    } catch (err) {
      console.error("Error creating forum:", err)
      setError(err instanceof Error ? err.message : "Failed to create forum")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(`/${userRole}/forums`)
  }

  const selectedVisibility = visibilityOptions.find(opt => opt.value === visibility)

  return (
    <div className="space-y-2">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href={`/${userRole}/forums`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Forums
        </Link>
      </Button>

      {/* Page Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Create New Forum
          </CardTitle>
          <CardDescription>
            Create a new forum to start conversations and discussions.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title Field */}
            <div className="space-y-2">
              <Label htmlFor="title">Forum Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter forum title..."
                disabled={isSubmitting}
                maxLength={100}
                className="min-h-[44px]"
              />
              <div className="text-xs text-muted-foreground text-right">
                {title.length}/100 characters
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this forum is about..."
                disabled={isSubmitting}
                maxLength={500}
                className="min-h-[80px] resize-none"
              />
              <div className="text-xs text-muted-foreground text-right">
                {description.length}/500 characters
              </div>
            </div>

            {/* Visibility Field */}
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select value={visibility} onValueChange={handleVisibilityChange}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-3">
                          <Icon className={`h-4 w-4 ${option.color}`} />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {/* Current selection display */}
              {selectedVisibility && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/50 rounded">
                  <selectedVisibility.icon className={`h-4 w-4 ${selectedVisibility.color}`} />
                  <span>{selectedVisibility.description}</span>
                </div>
              )}
            </div>

            {/* Family Selection - Only show when FAMILY visibility is selected */}
            {visibility === "FAMILY" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium">Family Access</Label>
                </div>

                {/* Broadcast to All Families Option */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="broadcastToAll"
                    checked={broadcastToAllFamilies}
                    onCheckedChange={setBroadcastToAllFamilies}
                  />
                  <Label htmlFor="broadcastToAll" className="text-sm">
                    Broadcast to all families
                  </Label>
                </div>

                {!broadcastToAllFamilies && (
                  <div className="space-y-2">
                    <Label className="text-sm">Select specific families</Label>
                    {loadingFamilies ? (
                      <div className="text-sm text-muted-foreground">Loading families...</div>
                    ) : families.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No families available</div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {families.map((family) => (
                          <div key={family.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`family-${family.id}`}
                              checked={selectedFamilies.includes(family.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedFamilies(prev => [...prev, family.id])
                                } else {
                                  setSelectedFamilies(prev => prev.filter(id => id !== family.id))
                                }
                              }}
                            />
                            <Label htmlFor={`family-${family.id}`} className="text-sm flex-1">
                              <div className="flex items-center justify-between">
                                <span>{family.name}</span>
                                <Badge variant="secondary" className="ml-2">
                                  {family.memberCount} members
                                </Badge>
                              </div>
                              {family.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {family.description}
                                </div>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedFamilies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedFamilies.map((familyId) => {
                          const family = families.find(f => f.id === familyId)
                          return family ? (
                            <Badge key={familyId} variant="secondary" className="text-xs">
                              {family.name}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-auto p-0 ml-1 hover:bg-transparent"
                                onClick={() => setSelectedFamilies(prev => prev.filter(id => id !== familyId))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User Selection - Only show when PRIVATE visibility is selected */}
            {visibility === "PRIVATE" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-orange-600" />
                  <Label className="text-sm font-medium">Private Access</Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Select users who can access this forum</Label>
                  {loadingUsers ? (
                    <div className="text-sm text-muted-foreground">Loading users...</div>
                  ) : users.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No users available</div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers(prev => [...prev, user.id])
                              } else {
                                setSelectedUsers(prev => prev.filter(id => id !== user.id))
                              }
                            }}
                          />
                          <Label htmlFor={`user-${user.id}`} className="text-sm flex-1">
                            <div className="flex items-center justify-between">
                              <span>{user.name}</span>
                              <Badge variant="outline" className="ml-2">
                                {user.role}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {user.email}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedUsers.map((userId) => {
                        const user = users.find(u => u.id === userId)
                        return user ? (
                          <Badge key={userId} variant="secondary" className="text-xs">
                            {user.name}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-auto p-0 ml-1 hover:bg-transparent"
                              onClick={() => setSelectedUsers(prev => prev.filter(id => id !== userId))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert>
                <AlertDescription className="text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="min-h-[44px] min-w-[100px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Create Forum
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}