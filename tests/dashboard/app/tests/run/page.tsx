'use client'

import { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'

export default function RunTestsPage() {
  const [running, setRunning] = useState(false)
  const [testPattern, setTestPattern] = useState('')

  const handleRunTests = async () => {
    setRunning(true)
    try {
      await fetch('/api/tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPattern: testPattern || undefined }),
      })
      // In a real implementation, you'd set up polling or SSE to get results
      setTimeout(() => setRunning(false), 2000)
    } catch (error) {
      console.error('Failed to run tests:', error)
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Run Tests</h1>
          <p className="text-gray-600">
            Execute integration tests for the Firefly platform
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Pattern (optional)
            </label>
            <input
              type="text"
              value={testPattern}
              onChange={(e) => setTestPattern(e.target.value)}
              placeholder="e.g., auth, dashboards, users"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Leave empty to run all tests
            </p>
          </div>

          <button
            onClick={handleRunTests}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Tests
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

