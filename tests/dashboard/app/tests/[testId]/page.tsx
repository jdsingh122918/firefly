'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface TestResult {
  testId: string
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  timestamp: string
}

export default function TestDetailPage() {
  const params = useParams()
  const testId = params.testId as string
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (testId) {
      fetch(`/api/tests/${testId}`)
        .then(res => res.json())
        .then(data => {
          setResult(data)
          setLoading(false)
        })
        .catch(err => {
          console.error('Failed to load test result:', err)
          setLoading(false)
        })
    }
  }, [testId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <p>Loading test details...</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/tests" className="text-blue-600 hover:underline mb-4 inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Tests
          </Link>
          <p>Test result not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/tests" className="text-blue-600 hover:underline mb-4 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Tests
        </Link>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{result.name}</h1>
            <div className="flex items-center gap-2">
              {result.status === 'passed' ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : result.status === 'failed' ? (
                <XCircle className="h-6 w-6 text-red-600" />
              ) : (
                <Clock className="h-6 w-6 text-gray-400" />
              )}
              <span className={`font-semibold ${
                result.status === 'passed' ? 'text-green-600' :
                result.status === 'failed' ? 'text-red-600' :
                'text-gray-400'
              }`}>
                {result.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="text-lg font-medium">{result.duration}ms</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Timestamp</p>
              <p className="text-lg font-medium">{new Date(result.timestamp).toLocaleString()}</p>
            </div>

            {result.error && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Error</p>
                <pre className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800 overflow-auto">
                  {result.error}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

