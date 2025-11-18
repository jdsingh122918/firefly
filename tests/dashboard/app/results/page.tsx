'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react'

interface TestSuite {
  id: string
  name: string
  status: 'passed' | 'failed' | 'running'
  duration: number
  timestamp: string
  tests: Array<{
    name: string
    status: 'passed' | 'failed' | 'skipped'
  }>
}

export default function ResultsPage() {
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/results')
      .then(res => res.json())
      .then(data => {
        setSuites(data.results || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load results:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <p>Loading test history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Test History</h1>
          <p className="text-gray-600">
            {suites.length} test suite executions
          </p>
        </div>

        <div className="space-y-4">
          {suites.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No test results yet. Run some tests to see results here.</p>
            </div>
          ) : (
            suites.map(suite => (
              <div key={suite.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {suite.status === 'passed' ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : suite.status === 'failed' ? (
                      <XCircle className="h-6 w-6 text-red-600" />
                    ) : (
                      <Clock className="h-6 w-6 text-blue-600 animate-spin" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{suite.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(suite.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-semibold">{suite.duration}ms</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">
                    {suite.tests.length} tests • {suite.tests.filter(t => t.status === 'passed').length} passed • {suite.tests.filter(t => t.status === 'failed').length} failed
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {suite.tests.slice(0, 10).map((test, idx) => (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-1 rounded ${
                          test.status === 'passed' ? 'bg-green-100 text-green-800' :
                          test.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {test.name}
                      </span>
                    ))}
                    {suite.tests.length > 10 && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                        +{suite.tests.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

