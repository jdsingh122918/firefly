/**
 * Database Health Management Utilities - Client Safe
 *
 * Provides client-safe utilities to detect database connectivity issues
 * and handle graceful failures. This module contains only pure functions
 * with no server-side dependencies or database operations.
 */

export interface DatabaseHealthStatus {
  isHealthy: boolean;
  lastChecked: Date;
  error?: string;
  errorType?: 'CONNECTION' | 'TIMEOUT' | 'AUTH' | 'UNKNOWN';
  retryAfter?: number; // seconds
}

/**
 * Check if an error is a database connectivity error
 * Pure function - safe for client-side use
 */
export function isDatabaseErrorClient(error: unknown): boolean {
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
 * Pure function - safe for client-side use
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
 * Get a user-friendly error message for database issues
 * Pure function - safe for client-side use
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