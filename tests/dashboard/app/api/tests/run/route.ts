import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { testPattern, testFile } = body
    
    // Run tests using vitest from the tests directory
    // dashboard is at tests/dashboard, so tests directory is one level up
    const testsDir = join(process.cwd(), '..')
    const testPath = testFile || testPattern || ''
    // Use npm run test from the tests directory
    const command = `cd ${testsDir} && npm run test ${testPath ? `-- ${testPath}` : ''}`
    
    console.log('Running test command:', command)
    console.log('Tests directory:', testsDir)
    
    // Start test execution (non-blocking)
    execAsync(command, {
      cwd: testsDir,
      env: { ...process.env },
    }).catch((error) => {
      console.error('Test execution failed:', error)
    })
    
    return NextResponse.json({
      message: 'Test execution started',
      testPattern: testPath || 'all',
    })
  } catch (error) {
    console.error('Test execution error:', error)
    return NextResponse.json(
      { error: 'Failed to start test execution', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

