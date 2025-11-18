import { NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

const TESTS_DIR = join(process.cwd(), '..', 'src', 'tests')

interface TestMetadata {
  id: string
  name: string
  file: string
  suite: string
  description?: string
  estimatedDuration?: number
}

export async function GET() {
  try {
    // Discover test files
    const testFiles: TestMetadata[] = []
    
    async function discoverTests(dir: string, suite: string = '') {
      const entries = await readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        
        if (entry.isDirectory()) {
          await discoverTests(fullPath, entry.name)
        } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
          const relativePath = fullPath.replace(TESTS_DIR, '').replace(/^\//, '')
          const testName = entry.name.replace(/\.test\.(ts|tsx)$/, '')
          
          testFiles.push({
            id: relativePath.replace(/[^a-zA-Z0-9]/g, '_'),
            name: testName,
            file: relativePath,
            suite: suite || 'root',
          })
        }
      }
    }
    
    await discoverTests(TESTS_DIR)
    
    return NextResponse.json({
      tests: testFiles,
      total: testFiles.length,
    })
  } catch (error) {
    console.error('Error discovering tests:', error)
    return NextResponse.json(
      { error: 'Failed to discover tests' },
      { status: 500 }
    )
  }
}

