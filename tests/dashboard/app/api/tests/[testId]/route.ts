import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const RESULTS_DIR = join(process.cwd(), '..', 'results')

export async function GET(
  request: Request,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params
    
    // Get test result
    try {
      const resultPath = join(RESULTS_DIR, `${testId}.json`)
      const content = await readFile(resultPath, 'utf-8')
      const result = JSON.parse(content)
      
      return NextResponse.json(result)
    } catch {
      return NextResponse.json(
        { error: 'Test result not found' },
        { status: 404 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get test details' },
      { status: 500 }
    )
  }
}

