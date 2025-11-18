import { UserRole } from "@prisma/client";
import { Page } from "puppeteer";
import { mockStore } from "./mock-store";
import { getMockUserByRole } from "../fixtures/mock-data";

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
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// Set mock authentication cookies and headers
export async function authenticateAs(
  page: Page,
  role: UserRole
): Promise<void> {
  const user = getMockUserByRole(role);
  if (!user) {
    throw new Error(`No mock user found for role: ${role}`);
  }

  // Clear any existing Clerk cookies to prevent Clerk from trying to validate them
  // This prevents the "infinite redirect loop" warning
  const existingCookies = await page.cookies();
  const clerkCookieNames = [
    "__session",
    "__client",
    "__clerk_db_jwt",
    "__clerk_redirect_url",
  ];

  for (const cookie of existingCookies) {
    if (clerkCookieNames.includes(cookie.name)) {
      await page.deleteCookie({
        name: cookie.name,
        domain: cookie.domain || "localhost",
        path: cookie.path || "/",
      });
    }
  }

  // Set test mode cookies that the middleware will read
  // These bypass Clerk validation when INTEGRATION_TEST_MODE=true
  await page.setCookie({
    name: "__test_user_id",
    value: user.clerkId,
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  });

  await page.setCookie({
    name: "__test_user_role",
    value: role,
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  });

  // In test mode, we don't set Clerk cookies to avoid Clerk trying to validate them
  // The middleware will use the test cookies instead
  // This prevents the "infinite redirect loop" warning from Clerk
}

// Get mock session claims
export function getMockSessionClaims(userId: string, role: UserRole) {
  return {
    sub: userId,
    metadata: {
      role,
      userId,
    },
  };
}

// Mock auth helper for API requests
export function getMockAuthHeaders(role: UserRole): Record<string, string> {
  const user = getMockUserByRole(role);
  if (!user) {
    throw new Error(`No mock user found for role: ${role}`);
  }

  const mockToken = generateMockSessionToken(user.clerkId, role);

  return {
    Authorization: `Bearer ${mockToken}`,
    "X-Clerk-User-Id": user.clerkId,
  };
}

// Get current authenticated user from page
export async function getAuthenticatedUser(
  page: Page
): Promise<{ userId: string; role: UserRole } | null> {
  const cookies = await page.cookies();
  const sessionCookie = cookies.find((c) => c.name === "__session");

  if (!sessionCookie) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString()
    );
    return {
      userId: payload.sub,
      role: payload.metadata.role,
    };
  } catch {
    return null;
  }
}
