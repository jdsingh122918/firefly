import { NextResponse } from "next/server";

export async function GET() {
  console.log("🔧 ===== WEBHOOK CONFIGURATION CHECK =====");

  // Check environment variables
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  const config = {
    environment: {
      NODE_ENV: process.env.NODE_ENV,
    },
    clerkConfig: {
      webhookSecret: {
        configured: !!webhookSecret,
        length: webhookSecret?.length || 0,
        startsWithPrefix: webhookSecret?.startsWith("whsec_") || false,
        preview: webhookSecret
          ? `${webhookSecret.substring(0, 10)}...`
          : "Not set",
      },
      secretKey: {
        configured: !!clerkSecretKey,
        length: clerkSecretKey?.length || 0,
        startsWithPrefix: clerkSecretKey?.startsWith("sk_") || false,
        preview: clerkSecretKey
          ? `${clerkSecretKey.substring(0, 10)}...`
          : "Not set",
      },
      publishableKey: {
        configured: !!clerkPublishableKey,
        length: clerkPublishableKey?.length || 0,
        startsWithPrefix: clerkPublishableKey?.startsWith("pk_") || false,
        preview: clerkPublishableKey
          ? `${clerkPublishableKey.substring(0, 10)}...`
          : "Not set",
      },
    },
    databaseConfig: {
      configured: !!databaseUrl,
      isMongoDb: databaseUrl?.includes("mongodb") || false,
      preview: databaseUrl ? `${databaseUrl.substring(0, 20)}...` : "Not set",
    },
    webhookEndpoints: {
      production: "/api/webhooks/clerk",
      test: "/api/debug/webhook-test",
    },
    recommendations: [] as string[],
  };

  // Add recommendations based on configuration
  const recommendations = [];

  if (!webhookSecret) {
    recommendations.push(
      "❌ CLERK_WEBHOOK_SECRET is not set. Get this from Clerk Dashboard > Webhooks",
    );
  } else if (!webhookSecret.startsWith("whsec_")) {
    recommendations.push(
      "⚠️ CLERK_WEBHOOK_SECRET may not be correct format. Should start with 'whsec_'",
    );
  }

  if (!clerkSecretKey) {
    recommendations.push("❌ CLERK_SECRET_KEY is not set");
  } else if (!clerkSecretKey.startsWith("sk_")) {
    recommendations.push(
      "⚠️ CLERK_SECRET_KEY may not be correct format. Should start with 'sk_'",
    );
  }

  if (!clerkPublishableKey) {
    recommendations.push("❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
  } else if (!clerkPublishableKey.startsWith("pk_")) {
    recommendations.push(
      "⚠️ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY may not be correct format. Should start with 'pk_'",
    );
  }

  if (!databaseUrl) {
    recommendations.push("❌ DATABASE_URL is not set");
  } else if (!databaseUrl.includes("mongodb")) {
    recommendations.push(
      "⚠️ DATABASE_URL doesn't appear to be MongoDB. This app expects MongoDB",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ All basic configuration appears correct");
    recommendations.push(
      "💡 Next step: Ensure webhook endpoint is configured in Clerk Dashboard",
    );
    recommendations.push(
      "💡 Webhook URL should be: https://yourdomain.com/api/webhooks/clerk",
    );
    recommendations.push(
      "💡 Required events: user.created, user.updated, user.deleted",
    );
  }

  config.recommendations = recommendations;

  console.log("🔧 Configuration check results:", config);

  return NextResponse.json({
    message: "Webhook configuration check",
    config,
    timestamp: new Date().toISOString(),
  });
}
