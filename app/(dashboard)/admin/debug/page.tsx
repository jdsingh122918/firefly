'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function DebugPage() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<{ message?: string; user?: object; error?: string } | null>(null)

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

      <div className="grid gap-6 md:grid-cols-3">
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