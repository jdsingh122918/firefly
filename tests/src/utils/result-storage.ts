import fs from 'fs/promises'
import path from 'path'
import { TestResult, TestSuite } from './test-runner'

const RESULTS_DIR = path.resolve(__dirname, '../../results')
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../results/screenshots')

export async function ensureResultsDirectory(): Promise<void> {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true })
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

export async function saveTestResult(result: TestResult): Promise<void> {
  await ensureResultsDirectory()
  
  const filePath = path.join(RESULTS_DIR, `${result.testId}.json`)
  await fs.writeFile(filePath, JSON.stringify(result, null, 2))
}

export async function saveTestSuite(suite: TestSuite): Promise<void> {
  await ensureResultsDirectory()
  
  const filePath = path.join(RESULTS_DIR, `suite_${suite.id}.json`)
  await fs.writeFile(filePath, JSON.stringify(suite, null, 2))
}

export async function getTestResult(testId: string): Promise<TestResult | null> {
  try {
    const filePath = path.join(RESULTS_DIR, `${testId}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function getAllTestResults(): Promise<TestResult[]> {
  await ensureResultsDirectory()
  
  try {
    const files = await fs.readdir(RESULTS_DIR)
    const resultFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('suite_'))
    
    const results: TestResult[] = []
    for (const file of resultFiles) {
      try {
        const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8')
        results.push(JSON.parse(content))
      } catch {
        // Skip invalid files
      }
    }
    
    return results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  } catch {
    return []
  }
}

export async function getAllTestSuites(): Promise<TestSuite[]> {
  await ensureResultsDirectory()
  
  try {
    const files = await fs.readdir(RESULTS_DIR)
    const suiteFiles = files.filter(f => f.startsWith('suite_') && f.endsWith('.json'))
    
    const suites: TestSuite[] = []
    for (const file of suiteFiles) {
      try {
        const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8')
        suites.push(JSON.parse(content))
      } catch {
        // Skip invalid files
      }
    }
    
    return suites.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  } catch {
    return []
  }
}

export async function getTestHistory(testName: string, limit = 10): Promise<TestResult[]> {
  const allResults = await getAllTestResults()
  return allResults
    .filter(r => r.name.includes(testName))
    .slice(0, limit)
}

