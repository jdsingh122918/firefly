'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HealthcareTagsInitializer } from '@/components/admin/healthcare-tags-initializer'
import { toast } from 'sonner'

interface SyncResult {
  success?: boolean;
  dryRun?: boolean;
  summary?: {
    clerkUsersFound: number;
    usersCreated: number;
    duplicatesFound: number;
    orphanedUsersFound: number;
    totalDeleted: number;
  };
  details?: {
    created: Array<{ clerkId: string; email: string }>;
    duplicates: Array<{
      field: string;
      value: string;
      kept: { id: string; email: string; createdAt: string };
      removed: Array<{ id: string; email: string; createdAt: string }>;
    }>;
    orphanedUsers: Array<{
      id: string;
      clerkId: string;
      email: string;
      createdAt: string;
    }>;
  };
  message?: string;
  user?: object;
  error?: string;
}

export default function DebugPage() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resettingChat, setResettingChat] = useState(false)
  const [syncingClerk, setSyncingClerk] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  const syncUser = async () => {
    try {
      setSyncing(true)

      const response = await fetch('/api/debug/sync-user', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setResult(data)
      toast.success('User synced successfully!')
    } catch (error) {
      console.error('Error syncing user:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync user'
      toast.error(errorMessage)
      setResult({ error: errorMessage })
    } finally {
      setSyncing(false)
    }
  }

  const resetDatabase = async () => {
    if (!confirm('Are you sure you want to reset the entire database? This will delete ALL data and cannot be undone!')) {
      return
    }

    try {
      setResetting(true)

      const response = await fetch('/api/debug/reset-database', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed')
      }

      setResult(data)
      toast.success('Database reset successfully!')
    } catch (error) {
      console.error('Error resetting database:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset database'
      toast.error(errorMessage)
      setResult({ error: errorMessage })
    } finally {
      setResetting(false)
    }
  }

  const resetChatHistory = async () => {
    if (!confirm('Are you sure you want to reset all chat history? This will delete ALL messages and conversations and cannot be undone!')) {
      return
    }

    try {
      setResettingChat(true)

      const response = await fetch('/api/debug/reset-chat-history', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Chat history reset failed')
      }

      setResult(data)
      toast.success('Chat history reset successfully!')
    } catch (error) {
      console.error('Error resetting chat history:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset chat history'
      toast.error(errorMessage)
      setResult({ error: errorMessage })
    } finally {
      setResettingChat(false)
    }
  }

  const checkDatabase = async () => {
    try {
      const response = await fetch('/api/debug/database')
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Error checking database:', error)
      toast.error('Failed to check database')
    }
  }

  const syncClerkUsers = async (dryRun: boolean) => {
    if (!dryRun && !confirm('Are you sure you want to sync all Clerk users and remove duplicates? This will modify the database.')) {
      return
    }

    try {
      setSyncingClerk(true)

      const response = await fetch(`/api/debug/sync-clerk-users?dryRun=${dryRun}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setResult(data)
      if (dryRun) {
        toast.success(`Preview: ${data.summary?.usersCreated || 0} to create, ${data.summary?.duplicatesFound || 0} duplicates, ${data.summary?.orphanedUsersFound || 0} orphaned`)
      } else {
        toast.success(`Synced ${data.summary?.usersCreated || 0} users, deleted ${data.summary?.totalDeleted || 0} (duplicates + orphaned)`)
      }
    } catch (error) {
      console.error('Error syncing Clerk users:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync Clerk users'
      toast.error(errorMessage)
      setResult({ error: errorMessage })
    } finally {
      setSyncingClerk(false)
    }
  }

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  if (!isSignedIn) {
    return <div>Please sign in to access debug tools</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Debug Tools</h1>
        <p className="text-muted-foreground">Tools to diagnose and fix authentication issues</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Database Reset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ⚠️ Reset the entire database to a clean state. This will delete ALL data!
            </p>
            <Button onClick={resetDatabase} disabled={resetting} variant="destructive">
              {resetting ? 'Resetting...' : 'Reset Database'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chat History Reset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              💬 Reset all chat history. This will delete ALL messages and conversations!
            </p>
            <Button onClick={resetChatHistory} disabled={resettingChat} variant="destructive">
              {resettingChat ? 'Resetting...' : 'Reset Chat History'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sync your Clerk user ({userId}) to the database with admin privileges.
            </p>
            <Button onClick={syncUser} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync User to Database'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check current database state and user counts.
            </p>
            <Button onClick={checkDatabase} variant="outline">
              Check Database State
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Clerk Sync & Cleanup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sync all Clerk users to the database, remove duplicates, and delete orphaned users
              (DB users whose Clerk accounts no longer exist). Preview first to see changes.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => syncClerkUsers(true)}
                disabled={syncingClerk}
                variant="outline"
              >
                {syncingClerk ? 'Processing...' : 'Preview Sync'}
              </Button>
              <Button
                onClick={() => syncClerkUsers(false)}
                disabled={syncingClerk}
                variant="default"
              >
                {syncingClerk ? 'Processing...' : 'Sync & Cleanup'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Healthcare Tags Initializer */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Healthcare System Tags</h2>
        <p className="text-sm text-muted-foreground">
          Initialize predefined healthcare service tags for system-wide use
        </p>
        <HealthcareTagsInitializer />
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}