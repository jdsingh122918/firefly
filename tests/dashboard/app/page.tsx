import Link from 'next/link'
import { TestTube2, Play, History } from 'lucide-react'

export default function DashboardHome() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Firefly Test Dashboard
          </h1>
          <p className="text-gray-600">
            Integration test suite management and monitoring
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <Link
            href="/tests"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center mb-4">
              <TestTube2 className="h-8 w-8 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Test Cases</h2>
            </div>
            <p className="text-gray-600">
              View all test cases, their status, and execution history
            </p>
          </Link>

          <Link
            href="/tests/run"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center mb-4">
              <Play className="h-8 w-8 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Run Tests</h2>
            </div>
            <p className="text-gray-600">
              Execute test suites and monitor real-time progress
            </p>
          </Link>

          <a
            href="/results"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center mb-4">
              <History className="h-8 w-8 text-purple-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Test History</h2>
            </div>
            <p className="text-gray-600">
              Browse execution history and analyze test results
            </p>
          </a>
        </div>
      </div>
    </div>
  )
}

