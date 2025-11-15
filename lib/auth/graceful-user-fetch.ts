/**
 * Graceful User Data Fetching
 *
 * Provides utilities to fetch user data with graceful fallbacks when
 * the database is unavailable.
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@prisma/client';
import { isDatabaseError, classifyDatabaseError } from '@/lib/db/database-health';

export interface UserData {
  id?: string;
  clerkId: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  isFromDatabase: boolean;
  isFromCache: boolean;
  databaseError?: string;
}

export interface GracefulUserResult {
  user: UserData;
  clerkUser: any;
  shouldRedirectToUnavailable: boolean;
  redirectParams?: Record<string, string>;
}

/**
 * Fetch user data with graceful database fallbacks
 */
export async function getGracefulUserData(): Promise<GracefulUserResult> {
  // Get auth data from Clerk (always available)
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Get full Clerk user profile
  const clerkUser = await currentUser();

  // Extract fallback role from session claims
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const fallbackRole = (metadata?.role as UserRole) || UserRole.MEMBER;

  // Create fallback user data from Clerk
  const fallbackUserData: UserData = {
    clerkId: userId,
    role: fallbackRole,
    firstName: clerkUser?.firstName,
    lastName: clerkUser?.lastName,
    email: clerkUser?.emailAddresses[0]?.emailAddress,
    imageUrl: clerkUser?.imageUrl,
    isFromDatabase: false,
    isFromCache: false,
  };

  try {
    // Attempt to fetch user from database with timeout
    const dbUserPromise = prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        clerkId: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        familyId: true,
      }
    });

    // Add timeout to database query
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    );

    const dbUser = await Promise.race([dbUserPromise, timeoutPromise]) as any;

    if (dbUser) {
      console.log('✅ Successfully fetched user from database');

      return {
        user: {
          ...fallbackUserData,
          id: dbUser.id,
          role: dbUser.role,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          email: dbUser.email,
          isFromDatabase: true,
        },
        clerkUser,
        shouldRedirectToUnavailable: false,
      };
    } else {
      console.warn('⚠️ User not found in database, using Clerk fallback');

      return {
        user: fallbackUserData,
        clerkUser,
        shouldRedirectToUnavailable: false,
      };
    }

  } catch (error) {
    console.error('❌ Database error in graceful user fetch:', error);

    // Check if this is a database connectivity error
    if (isDatabaseError(error)) {
      const errorType = classifyDatabaseError(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';

      console.warn('🔄 Using fallback user data due to database issue');

      // For critical errors, redirect to unavailable page
      if (errorType === 'AUTH' || errorType === 'CONNECTION') {
        return {
          user: {
            ...fallbackUserData,
            databaseError: errorMessage,
          },
          clerkUser,
          shouldRedirectToUnavailable: true,
          redirectParams: {
            error: errorMessage,
            errorType: errorType,
            retryAfter: errorType === 'CONNECTION' ? '30' : '60',
          },
        };
      }

      // For timeouts or other issues, use fallback but don't redirect
      return {
        user: {
          ...fallbackUserData,
          databaseError: errorMessage,
        },
        clerkUser,
        shouldRedirectToUnavailable: false,
      };
    }

    // Re-throw non-database errors
    throw error;
  }
}

/**
 * Check if we should use cached/fallback data instead of database
 */
export function shouldUseFallbackData(error: unknown): boolean {
  return isDatabaseError(error);
}

/**
 * Get cached user data from localStorage (client-side only)
 */
export function getCachedUserData(clerkId: string): UserData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(`firefly_user_${clerkId}`);
    if (!cached) return null;

    const userData = JSON.parse(cached);

    // Check if cache is still fresh (30 minutes)
    const cacheTime = new Date(userData._cacheTime || 0);
    const now = new Date();
    const thirtyMinutes = 30 * 60 * 1000;

    if (now.getTime() - cacheTime.getTime() > thirtyMinutes) {
      localStorage.removeItem(`firefly_user_${clerkId}`);
      return null;
    }

    return {
      ...userData,
      isFromCache: true,
      isFromDatabase: false,
    };
  } catch {
    return null;
  }
}

/**
 * Cache user data to localStorage (client-side only)
 */
export function cacheUserData(userData: UserData): void {
  if (typeof window === 'undefined') return;
  if (!userData.isFromDatabase) return; // Only cache database data

  try {
    const cacheData = {
      ...userData,
      _cacheTime: new Date().toISOString(),
    };

    localStorage.setItem(`firefly_user_${userData.clerkId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache user data:', error);
  }
}