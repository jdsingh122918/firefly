'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, Play } from 'lucide-react'

interface Test {
  id: string
  name: string
  file: string
  suite: string
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tests')
      .then(res => res.json())
      .then(data => {
        setTests(data.tests || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load tests:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <p>Loading tests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Cases</h1>
          <p className="text-gray-600">
            {tests.length} test cases found
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.map(test => (
            <Link
              key={test.id}
              href={`/tests/${test.id}`}
              className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{test.name}</h3>
                <Clock className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-2">{test.suite}</p>
              <p className="text-xs text-gray-400 truncate">{test.file}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

