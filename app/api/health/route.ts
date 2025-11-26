import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint for Docker container orchestration
 * Returns 200 if database is connected, 503 if unhealthy
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Test database connection with a lightweight query
    await prisma.user.count();

    const responseTimeMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTimeMs,
      services: {
        database: 'connected',
        app: 'running',
      },
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTimeMs,
        services: {
          database: 'disconnected',
          app: 'running',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
