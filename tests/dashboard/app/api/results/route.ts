import { NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

const RESULTS_DIR = join(process.cwd(), '..', 'results')

export async function GET() {
  try {
    const files = await readdir(RESULTS_DIR)
    const suiteFiles = files.filter(f => f.startsWith('suite_') && f.endsWith('.json'))
    
    const suites = []
    for (const file of suiteFiles) {
      try {
        const content = await readFile(join(RESULTS_DIR, file), 'utf-8')
        suites.push(JSON.parse(content))
      } catch {
        // Skip invalid files
      }
    }
    
    // Sort by timestamp (newest first)
    suites.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    
    return NextResponse.json({
      results: suites,
      total: suites.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get test results' },
      { status: 500 }
    )
  }
}

