/**
 * Database Health Management Utilities
 *
 * Provides utilities to detect database connectivity issues and handle
 * graceful failures when the database is unavailable.
 */

import { prisma } from "@/lib/db/prisma";

export interface DatabaseHealthStatus {
  isHealthy: boolean;
  lastChecked: Date;
  error?: string;
  errorType?: 'CONNECTION' | 'TIMEOUT' | 'AUTH' | 'UNKNOWN';
  retryAfter?: number; // seconds
}

let cachedHealthStatus: DatabaseHealthStatus | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_CACHE_MS = 30000; // Cache health status for 30 seconds

/**
 * Check if an error is a database connectivity error
 */
export function isDatabaseError(error: unknown): boolean {
  if (!error) return false;

  const errorString = error instanceof Error ? error.message : String(error);

  // MongoDB Atlas connection errors
  const connectionErrors = [
    'Server selection timeout',
    'No available servers',
    'Connection refused',
    'ENOTFOUND',
    'ECONNREFUSED',
    'MongoServerSelectionError',
    'MongoNetworkError',
    'MongoTimeoutError',
    'InternalError'
  ];

  // Prisma connection errors
  const prismaErrors = [
    'Can\'t reach database server',
    'Connection timeout',
    'Database connection error',
    'PrismaClientKnownRequestError'
  ];

  const allErrors = [...connectionErrors, ...prismaErrors];
  return allErrors.some(pattern => errorString.includes(pattern));
}

/**
 * Classify the type of database error
 */
export function classifyDatabaseError(error: unknown): DatabaseHealthStatus['errorType'] {
  if (!error) return 'UNKNOWN';

  const errorString = error instanceof Error ? error.message : String(error);

  if (errorString.includes('authentication failed') || errorString.includes('unauthorized') || errorString.includes('Authentication failed')) {
    return 'AUTH';
  }

  if (errorString.includes('timeout') || errorString.includes('Server selection timeout') || errorString.includes('MongoNetworkTimeoutError') || errorString.includes('TimeoutError')) {
    return 'TIMEOUT';
  }

  if (errorString.includes('Connection') || errorString.includes('No available servers') || errorString.includes('ECONNREFUSED') || errorString.includes('ENOTFOUND')) {
    return 'CONNECTION';
  }

  return 'UNKNOWN';
}

/**
 * Perform a lightweight database health check
 */
export async function checkDatabaseHealth(useCache = true): Promise<DatabaseHealthStatus> {
  const now = Date.now();

  // Return cached result if still fresh
  if (useCache && cachedHealthStatus && (now - lastHealthCheck) < HEALTH_CHECK_CACHE_MS) {
    return cachedHealthStatus;
  }

  const healthStatus: DatabaseHealthStatus = {
    isHealthy: false,
    lastChecked: new Date(),
  };

  try {
    // Simple connection test with short timeout - use MongoDB-compatible query
    await Promise.race([
      // For MongoDB, we'll try to count users or just connect
      prisma.user.count(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      )
    ]);

    healthStatus.isHealthy = true;
  } catch (error) {
    console.warn('Database health check failed:', error);

    healthStatus.error = error instanceof Error ? error.message : String(error);
    healthStatus.errorType = classifyDatabaseError(error);

    // Set retry delay based on error type
    switch (healthStatus.errorType) {
      case 'CONNECTION':
        healthStatus.retryAfter = 30; // 30 seconds for connection issues
        break;
      case 'TIMEOUT':
        healthStatus.retryAfter = 15; // 15 seconds for timeouts
        break;
      case 'AUTH':
        healthStatus.retryAfter = 300; // 5 minutes for auth issues (likely needs manual fix)
        break;
      default:
        healthStatus.retryAfter = 60; // 1 minute for unknown issues
    }
  }

  // Cache the result
  cachedHealthStatus = healthStatus;
  lastHealthCheck = now;

  return healthStatus;
}

/**
 * Attempt database operation with graceful fallback
 */
export async function withDatabaseFallback<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<{ success: boolean; data: T; error?: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    if (isDatabaseError(error)) {
      console.warn('Database operation failed, using fallback:', error);
      return {
        success: false,
        data: fallback,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    // Re-throw non-database errors
    throw error;
  }
}

/**
 * Clear the health check cache (useful for forcing a fresh check)
 */
export function clearHealthCache(): void {
  cachedHealthStatus = null;
  lastHealthCheck = 0;
}

/**
 * Get a user-friendly error message for database issues
 */
export function getDatabaseErrorMessage(errorType: DatabaseHealthStatus['errorType']): string {
  switch (errorType) {
    case 'CONNECTION':
      return 'Unable to connect to the database. Please check your internet connection and try again.';
    case 'TIMEOUT':
      return 'Database is responding slowly. Please wait a moment and try again.';
    case 'AUTH':
      return 'Database authentication issue. Please contact system administrator.';
    default:
      return 'Database is temporarily unavailable. Please try again in a few moments.';
  }
}