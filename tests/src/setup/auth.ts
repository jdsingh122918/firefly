import { UserRole } from '@prisma/client'
import { Page } from 'puppeteer'
import { mockStore } from './mock-store'
import { getMockUserByRole } from '../fixtures/mock-data'

// Mock session token generator
function generateMockSessionToken(userId: string, role: UserRole): string {
  // Simple base64 encoded mock token
  const payload = {
    sub: userId,
    metadata: {
      role,
      userId,
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

// Set mock authentication cookies and headers
export async function authenticateAs(page: Page, role: UserRole): Promise<void> {
  const user = getMockUserByRole(role)
  if (!user) {
    throw new Error(`No mock user found for role: ${role}`)
  }

  const mockToken = generateMockSessionToken(user.clerkId, role)

  // Set cookies that Clerk would set
  await page.setCookie({
    name: '__session',
    value: mockToken,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  })

  // Set additional Clerk cookies
  await page.setCookie({
    name: '__client',
    value: user.clerkId,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  })
}

// Get mock session claims
export function getMockSessionClaims(userId: string, role: UserRole) {
  return {
    sub: userId,
    metadata: {
      role,
      userId,
    },
  }
}

// Mock auth helper for API requests
export function getMockAuthHeaders(role: UserRole): Record<string, string> {
  const user = getMockUserByRole(role)
  if (!user) {
    throw new Error(`No mock user found for role: ${role}`)
  }

  const mockToken = generateMockSessionToken(user.clerkId, role)

  return {
    'Authorization': `Bearer ${mockToken}`,
    'X-Clerk-User-Id': user.clerkId,
  }
}

// Get current authenticated user from page
export async function getAuthenticatedUser(page: Page): Promise<{ userId: string; role: UserRole } | null> {
  const cookies = await page.cookies()
  const sessionCookie = cookies.find(c => c.name === '__session')
  
  if (!sessionCookie) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString())
    return {
      userId: payload.sub,
      role: payload.metadata.role,
    }
  } catch {
    return null
  }
}

