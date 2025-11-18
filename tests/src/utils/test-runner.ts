import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

export interface TestResult {
  testId: string
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  timestamp: string
  screenshots?: string[]
}

export interface TestSuite {
  id: string
  name: string
  tests: TestResult[]
  status: 'passed' | 'failed' | 'running'
  duration: number
  timestamp: string
}

export async function runTests(testPattern?: string): Promise<TestSuite> {
  const testId = `test_${Date.now()}`
  const timestamp = new Date().toISOString()
  
  const vitestArgs = testPattern 
    ? ['run', testPattern]
    : ['run']
  
  const command = `npx vitest ${vitestArgs.join(' ')}`
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env },
    })
    
    // Parse test results from stdout
    const results = parseTestResults(stdout, testId, timestamp)
    
    return {
      id: testId,
      name: testPattern || 'All Tests',
      tests: results,
      status: results.every(r => r.status === 'passed') ? 'passed' : 'failed',
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      timestamp,
    }
  } catch (error: any) {
    return {
      id: testId,
      name: testPattern || 'All Tests',
      tests: [],
      status: 'failed',
      duration: 0,
      timestamp,
    }
  }
}

function parseTestResults(output: string, suiteId: string, timestamp: string): TestResult[] {
  const results: TestResult[] = []
  const lines = output.split('\n')
  
  // Simple parsing - in a real implementation, you'd use Vitest's JSON reporter
  let currentTest: Partial<TestResult> | null = null
  
  for (const line of lines) {
    if (line.includes('✓') || line.includes('PASS')) {
      const match = line.match(/(.+?)\s+\((\d+)ms\)/)
      if (match) {
        results.push({
          testId: `${suiteId}_${results.length}`,
          name: match[1].trim(),
          status: 'passed',
          duration: parseInt(match[2]) || 0,
          timestamp,
        })
      }
    } else if (line.includes('✗') || line.includes('FAIL')) {
      const match = line.match(/(.+?)\s+\((\d+)ms\)/)
      if (match) {
        results.push({
          testId: `${suiteId}_${results.length}`,
          name: match[1].trim(),
          status: 'failed',
          duration: parseInt(match[2]) || 0,
          timestamp,
        })
      }
    }
  }
  
  return results
}

export async function runSingleTest(testFile: string): Promise<TestResult> {
  const suite = await runTests(testFile)
  return suite.tests[0] || {
    testId: `test_${Date.now()}`,
    name: testFile,
    status: 'failed',
    duration: 0,
    timestamp: new Date().toISOString(),
    error: 'Test not found',
  }
}

