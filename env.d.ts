namespace NodeJS {
  interface ProcessEnv {
    // Clerk
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    NEXT_PUBLIC_CLERK_SIGN_IN_URL?: string;
    NEXT_PUBLIC_CLERK_SIGN_UP_URL?: string;
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL?: string;
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL?: string;

    // Database
    DATABASE_URL: string;

    // Webhook
    CLERK_WEBHOOK_SECRET: string;

    // API
    GRAPHQL_ENDPOINT?: string;
  }
}

// Clerk Session Claims Type Extensions
declare global {
  /**
   * Custom JWT session claims for Clerk authentication
   * This interface extends the default session claims with custom metadata
   *
   * Note: Requires session token customization in Clerk Dashboard:
   * Sessions → Customize session token → Add: {"metadata": {{user.public_metadata}}}
   */
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: "ADMIN" | "VOLUNTEER" | "MEMBER";
      familyId?: string;
      userId?: string;
    };
  }
}
