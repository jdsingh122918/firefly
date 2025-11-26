import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { UserRole, canAccessRoute, getDefaultRoute } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

/**
 * NEXT.JS 16 COMPATIBILITY NOTE:
 *
 * This file uses Next.js 16 naming convention (proxy.ts) but still uses
 * Clerk's clerkMiddleware pattern. This is intentional as:
 *
 * 1. Clerk @clerk/nextjs 6.34.5 may not fully support proxy() export pattern yet
 * 2. clerkMiddleware provides stable authentication handling
 * 3. File naming is future-proof for when Clerk adds full proxy support
 *
 * TODO: Monitor Clerk releases for native proxy() function support
 * TODO: Migrate to `export function proxy()` when Clerk documentation confirms support
 *
 * See: https://nextjs.org/docs/messages/middleware-to-proxy
 * See: https://clerk.com/docs (check for proxy.ts examples)
 */

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/verify(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/debug/auth(.*)",
  "/api/debug/database(.*)",
  "/api/debug/sync-user(.*)",
  "/api/debug/reset-database(.*)",
  "/api/debug/webhook-test(.*)",
  "/api/health(.*)", // Docker health checks
]);

// Define role-specific route matchers
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isVolunteerRoute = createRouteMatcher(["/volunteer(.*)"]);
const isMemberRoute = createRouteMatcher(["/member(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const path = request.nextUrl.pathname;

  // Test mode: Extract mock authentication from test headers/cookies
  const isTestMode = process.env.INTEGRATION_TEST_MODE === "true";
  let userId: string | null = null;
  let sessionClaims: any = null;

  if (isTestMode) {
    // Extract test user from test header or cookie
    const testUserId =
      request.headers.get("X-Test-User-Id") ||
      request.cookies.get("__test_user_id")?.value;
    const testUserRole =
      request.headers.get("X-Test-User-Role") ||
      request.cookies.get("__test_user_role")?.value;

    if (testUserId && testUserRole) {
      userId = testUserId;
      sessionClaims = {
        metadata: {
          role: testUserRole,
          userId: testUserId,
        },
        sub: testUserId,
      };

      console.log("🧪 Test Mode Auth:", {
        path,
        userId,
        role: testUserRole,
      });

      // In test mode with test cookies, skip Clerk validation
      // Continue with test auth instead of calling auth()
    } else {
      // Test mode but no test cookies - try Clerk auth (might fail, but that's ok)
      try {
        const authResult = await auth();
        userId = authResult.userId;
        sessionClaims = authResult.sessionClaims;
      } catch (error) {
        // Clerk validation failed in test mode - this is expected
        console.log("🧪 Test Mode: Clerk auth failed (expected):", error);
      }
    }
  } else {
    // Normal mode: use Clerk auth
    const authResult = await auth();
    userId = authResult.userId;
    sessionClaims = authResult.sessionClaims;
  }

  console.log("🔒 Middleware Debug:", {
    path,
    userId: userId ? "present" : "missing",
    sessionClaims: sessionClaims ? "present" : "missing",
    metadata: sessionClaims?.metadata,
    testMode: isTestMode,
  });

  // Allow public routes
  if (isPublicRoute(request)) {
    console.log("✅ Public route access:", path);
    return NextResponse.next();
  }

  // Handle API routes specially - return JSON 401 instead of redirecting
  if (path.startsWith("/api/")) {
    // Require authentication for protected API routes
    if (!userId) {
      console.log("❌ API route unauthorized:", path);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For API routes, check if user exists in database and auto-sync if needed
    try {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true, id: true, email: true },
      });

      if (!dbUser) {
        console.log(
          "⚠️  API route: User not found in database, attempting auto-sync..."
        );

        try {
          // Auto-sync user from Clerk to database
          const clerkUser = await fetch(
            `https://api.clerk.com/v1/users/${userId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
                "Content-Type": "application/json",
              },
            }
          ).then((res) => res.json());

          if (clerkUser && clerkUser.email_addresses?.[0]?.email_address) {
            // Import UserRepository locally to avoid circular dependencies
            const { UserRepository } = await import(
              "@/lib/db/repositories/user.repository"
            );
            const { UserRole } = await import("@/lib/auth/roles");
            const userRepository = new UserRepository();

            // Extract role from Clerk metadata or default to MEMBER
            const role =
              clerkUser.public_metadata?.role ||
              clerkUser.private_metadata?.role ||
              clerkUser.unsafe_metadata?.role ||
              UserRole.MEMBER;

            // Create user in database
            const newUser = await userRepository.createUser({
              clerkId: userId,
              email: clerkUser.email_addresses[0].email_address,
              firstName: clerkUser.first_name || undefined,
              lastName: clerkUser.last_name || undefined,
              role: role as UserRole,
              phoneNumber:
                clerkUser.phone_numbers?.[0]?.phone_number || undefined,
            });

            console.log("✅ API route auto-sync successful:", {
              userId: newUser.id,
              email: newUser.email,
              role: newUser.role,
            });
          }
        } catch (syncError) {
          console.error("❌ API route auto-sync failed:", syncError);
        }
      } else {
        console.log("✅ API route: User found in database:", {
          userId: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
        });
      }
    } catch (error) {
      console.error("❌ API route database check failed:", error);
    }

    // API routes don't need role-based routing, just authentication
    console.log("✅ API route authorized:", path);
    return NextResponse.next();
  }

  // Require authentication for protected non-API routes
  if (!userId) {
    console.log("❌ No userId, redirecting to sign-in");
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Extract user role from session claims
  // NOTE: This requires session token customization in Clerk Dashboard
  const userRole = (sessionClaims?.metadata as { role?: string })
    ?.role as UserRole;

  // Enhanced logging for debugging session claims
  console.log("👤 User role extracted:", {
    userRole,
    userRoleType: typeof userRole,
    metadata: sessionClaims?.metadata,
    hasSessionClaims: !!sessionClaims,
    hasMetadata: !!sessionClaims?.metadata,
  });

  // Check if session token customization is missing
  if (sessionClaims && !sessionClaims.metadata) {
    console.error(
      "⚠️  CONFIGURATION ERROR: Session token metadata is undefined!"
    );
    console.error(
      "📋 Required fix: In Clerk Dashboard → Sessions → Customize session token"
    );
    console.error('📋 Add this JSON: {"metadata": {{user.public_metadata}}}');
    console.error(
      "🔄 After adding, users will need to sign out and back in for new tokens"
    );
  }

  // Enhanced fallback mechanism for missing or invalid roles
  let finalUserRole = userRole;

  if (!userRole) {
    console.log(
      "⚠️  No user role found in session token, attempting database fallback"
    );

    try {
      // Fallback: Query database for user role
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true, id: true, email: true },
      });

      if (dbUser?.role) {
        finalUserRole = dbUser.role as UserRole;
        console.log("✅ Database fallback successful:", {
          userId: dbUser.id,
          email: dbUser.email,
          roleFromDb: finalUserRole,
        });
      } else {
        console.log("⚠️  User not found in database, attempting auto-sync...");

        try {
          // Auto-sync user from Clerk to database
          const clerkUser = await fetch(
            `https://api.clerk.com/v1/users/${userId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
                "Content-Type": "application/json",
              },
            }
          ).then((res) => res.json());

          if (clerkUser && clerkUser.email_addresses?.[0]?.email_address) {
            // Import UserRepository locally to avoid circular dependencies
            const { UserRepository } = await import(
              "@/lib/db/repositories/user.repository"
            );
            const { UserRole } = await import("@/lib/auth/roles");
            const userRepository = new UserRepository();

            // Extract role from Clerk metadata or default to MEMBER
            const role =
              clerkUser.public_metadata?.role ||
              clerkUser.private_metadata?.role ||
              clerkUser.unsafe_metadata?.role ||
              UserRole.MEMBER;

            // Create user in database
            const newUser = await userRepository.createUser({
              clerkId: userId,
              email: clerkUser.email_addresses[0].email_address,
              firstName: clerkUser.first_name || undefined,
              lastName: clerkUser.last_name || undefined,
              role: role as UserRole,
              phoneNumber:
                clerkUser.phone_numbers?.[0]?.phone_number || undefined,
            });

            finalUserRole = newUser.role as UserRole;
            console.log("✅ Auto-sync successful:", {
              userId: newUser.id,
              email: newUser.email,
              roleFromSync: finalUserRole,
            });
          }
        } catch (syncError) {
          console.error("❌ Auto-sync failed:", syncError);
        }
      }
    } catch (error) {
      console.error("❌ Database fallback failed:", error);
    }

    // If still no role after database fallback, apply default logic
    if (!finalUserRole) {
      console.log("🔄 No role found anywhere, applying default member access");

      // For new users without a role, default to member dashboard
      if (path === "/dashboard") {
        console.log("🔄 Redirecting to member dashboard (no role)");
        return NextResponse.redirect(new URL("/member", request.url));
      }

      // Allow access to member routes for users without roles
      if (path.startsWith("/member")) {
        console.log("✅ Allowing access to member route (no role)");
        return NextResponse.next();
      }

      // Redirect other routes to member dashboard
      console.log("🔄 Redirecting to member dashboard (default)");
      return NextResponse.redirect(new URL("/member", request.url));
    }
  }

  // Handle root dashboard redirect
  if (path === "/dashboard") {
    const defaultRoute = getDefaultRoute(finalUserRole);
    console.log("🏠 Dashboard redirect:", { finalUserRole, defaultRoute });
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  // Role-based access control using final resolved role
  const hasRouteAccess = canAccessRoute(finalUserRole, path);
  console.log("🔐 Route access check:", {
    originalUserRole: userRole,
    finalUserRole,
    path,
    hasRouteAccess,
    source: userRole ? "session token" : "database fallback",
  });

  if (!hasRouteAccess) {
    const defaultRoute = getDefaultRoute(finalUserRole);
    console.log("❌ Access denied, redirecting:", { to: defaultRoute });
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  // Additional specific route checks using final role
  if (isAdminRoute(request) && finalUserRole !== UserRole.ADMIN) {
    console.log("❌ Admin route check failed:", {
      finalUserRole,
      expected: UserRole.ADMIN,
    });
    const defaultRoute = getDefaultRoute(finalUserRole);
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  if (
    isVolunteerRoute(request) &&
    finalUserRole !== UserRole.VOLUNTEER &&
    finalUserRole !== UserRole.ADMIN
  ) {
    console.log("❌ Volunteer route check failed:", {
      finalUserRole,
      allowedRoles: [UserRole.VOLUNTEER, UserRole.ADMIN],
    });
    const defaultRoute = getDefaultRoute(finalUserRole);
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  // Check if user can access the requested route based on their role permissions
  if (finalUserRole && !canAccessRoute(finalUserRole, path)) {
    console.log("❌ Route access denied:", {
      finalUserRole,
      path,
      redirectingTo: getDefaultRoute(finalUserRole),
    });
    const defaultRoute = getDefaultRoute(finalUserRole);
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  console.log("✅ Access granted:", {
    originalUserRole: userRole,
    finalUserRole,
    path,
    roleSource: userRole ? "session token" : "database fallback",
  });
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
