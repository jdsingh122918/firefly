import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { UserRole } from "@/lib/auth/roles";
import { CreateUserInput } from "@/lib/types";

// Webhook event types from Clerk
type ClerkWebhookEvent =
  | {
      type: "user.created";
      data: ClerkUser;
    }
  | {
      type: "user.updated";
      data: ClerkUser;
    }
  | {
      type: "user.deleted";
      data: ClerkUser;
    };

interface ClerkUser {
  id: string;
  email_addresses: Array<{
    email_address: string;
    verification?: {
      status: string;
    };
  }>;
  first_name: string | null;
  last_name: string | null;
  phone_numbers?: Array<{
    phone_number: string;
    verification?: {
      status: string;
    };
  }>;
  public_metadata?: {
    role?: UserRole;
  };
  private_metadata?: {
    role?: UserRole;
  };
  unsafe_metadata?: {
    role?: UserRole;
  };
}

const userRepository = new UserRepository();

export async function POST(request: NextRequest) {
  const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`🔔 [${webhookId}] ===== CLERK WEBHOOK RECEIVED =====`);
  console.log(`🔔 [${webhookId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`🔔 [${webhookId}] Method: ${request.method}`);
  console.log(`🔔 [${webhookId}] URL: ${request.url}`);

  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    console.log(
      `🔔 [${webhookId}] Webhook secret configured: ${webhookSecret ? "YES" : "NO"}`,
    );
    console.log(
      `🔔 [${webhookId}] Webhook secret length: ${webhookSecret?.length || 0}`,
    );

    if (!webhookSecret) {
      console.error(`❌ [${webhookId}] CLERK_WEBHOOK_SECRET is not set`);
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    // Get headers for signature verification
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    console.log(`🔔 [${webhookId}] Headers received:`);
    console.log(`🔔 [${webhookId}]   svix-id: ${svix_id || "MISSING"}`);
    console.log(
      `🔔 [${webhookId}]   svix-timestamp: ${svix_timestamp || "MISSING"}`,
    );
    console.log(
      `🔔 [${webhookId}]   svix-signature: ${svix_signature ? "PRESENT" : "MISSING"}`,
    );

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error(`❌ [${webhookId}] Missing required svix headers`);
      console.error(
        `❌ [${webhookId}] This usually means the request is not from Clerk`,
      );
      return NextResponse.json(
        { error: "Missing svix headers" },
        { status: 400 },
      );
    }

    // Get request body
    const body = await request.text();
    console.log(`🔔 [${webhookId}] Body length: ${body.length} characters`);
    console.log(
      `🔔 [${webhookId}] Body preview: ${body.substring(0, 200)}${body.length > 200 ? "..." : ""}`,
    );

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    let event: ClerkWebhookEvent;

    try {
      console.log(`🔔 [${webhookId}] Starting signature verification...`);
      event = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as ClerkWebhookEvent;
      console.log(`✅ [${webhookId}] Signature verification successful`);
      console.log(`🔔 [${webhookId}] Event type: ${event.type}`);
      console.log(`🔔 [${webhookId}] Event data preview:`, {
        id: event.data.id,
        email: event.data.email_addresses?.[0]?.email_address,
        firstName: event.data.first_name,
        lastName: event.data.last_name,
      });
    } catch (err) {
      console.error(`❌ [${webhookId}] Signature verification failed:`, err);
      console.error(
        `❌ [${webhookId}] This indicates the webhook secret is wrong or request is not from Clerk`,
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle different event types
    console.log(`🔔 [${webhookId}] Processing event: ${event.type}`);

    try {
      switch (event.type) {
        case "user.created":
          console.log(`🔔 [${webhookId}] Handling user.created event`);
          await handleUserCreated(event.data, webhookId);
          break;
        case "user.updated":
          console.log(`🔔 [${webhookId}] Handling user.updated event`);
          await handleUserUpdated(event.data, webhookId);
          break;
        case "user.deleted":
          console.log(`🔔 [${webhookId}] Handling user.deleted event`);
          await handleUserDeleted(event.data, webhookId);
          break;
        default:
          console.log(
            `⚠️ [${webhookId}] Unhandled webhook event type: ${(event as { type?: string }).type}`,
          );
          console.log(
            `⚠️ [${webhookId}] Available handlers: user.created, user.updated, user.deleted`,
          );
      }
      console.log(`✅ [${webhookId}] Event processing completed successfully`);
    } catch (handlerError) {
      console.error(`❌ [${webhookId}] Event handler failed:`, handlerError);
      throw handlerError; // Re-throw to be caught by outer catch block
    }

    console.log(
      `🔔 [${webhookId}] Webhook processing completed - returning success`,
    );
    return NextResponse.json({
      success: true,
      webhookId,
      eventType: event.type,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ [${webhookId}] Webhook processing failed:`, error);
    console.error(`❌ [${webhookId}] Error details:`, {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        webhookId,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function handleUserCreated(clerkUser: ClerkUser, webhookId: string) {
  try {
    console.log(`👤 [${webhookId}] ===== PROCESSING USER CREATED =====`);
    console.log(`👤 [${webhookId}] Clerk ID: ${clerkUser.id}`);

    // Check if user already exists (avoid duplicates)
    console.log(`👤 [${webhookId}] Checking if user exists in database...`);
    const existingUser = await userRepository.getUserByClerkId(clerkUser.id);
    if (existingUser) {
      console.log(
        `⚠️ [${webhookId}] User already exists in database: ${existingUser.email} (ID: ${existingUser.id})`,
      );
      console.log(`⚠️ [${webhookId}] Skipping creation to avoid duplicates`);
      return;
    }

    // Extract primary email
    console.log(`👤 [${webhookId}] Extracting user data from Clerk payload...`);
    const primaryEmail = clerkUser.email_addresses[0]?.email_address;
    console.log(
      `👤 [${webhookId}] Email addresses:`,
      clerkUser.email_addresses?.map((e) => e.email_address),
    );

    if (!primaryEmail) {
      console.error(
        `❌ [${webhookId}] No email found for user ${clerkUser.id}`,
      );
      console.error(
        `❌ [${webhookId}] Email addresses array:`,
        clerkUser.email_addresses,
      );
      throw new Error(`No email address found for user ${clerkUser.id}`);
    }

    // Extract role from metadata (default to MEMBER if not set)
    console.log(`👤 [${webhookId}] Extracting role from metadata...`);
    console.log(
      `👤 [${webhookId}] public_metadata:`,
      clerkUser.public_metadata,
    );
    console.log(
      `👤 [${webhookId}] private_metadata:`,
      clerkUser.private_metadata,
    );
    console.log(
      `👤 [${webhookId}] unsafe_metadata:`,
      clerkUser.unsafe_metadata,
    );
    const role = extractUserRole(clerkUser, webhookId);

    // Extract phone number if available
    const phoneNumber = clerkUser.phone_numbers?.[0]?.phone_number || undefined;
    console.log(
      `👤 [${webhookId}] Phone number: ${phoneNumber || "Not provided"}`,
    );

    // Create user input
    const createUserData: CreateUserInput = {
      clerkId: clerkUser.id,
      email: primaryEmail,
      firstName: clerkUser.first_name || undefined,
      lastName: clerkUser.last_name || undefined,
      role,
      phoneNumber,
    };

    console.log(`👤 [${webhookId}] Creating user with data:`, {
      clerkId: createUserData.clerkId,
      email: createUserData.email,
      firstName: createUserData.firstName,
      lastName: createUserData.lastName,
      role: createUserData.role,
      phoneNumber: createUserData.phoneNumber,
    });

    // Create user in database
    console.log(`👤 [${webhookId}] Calling userRepository.createUser()...`);
    const newUser = await userRepository.createUser(createUserData);
    console.log(`✅ [${webhookId}] User created successfully!`);
    console.log(`✅ [${webhookId}] Database ID: ${newUser.id}`);
    console.log(`✅ [${webhookId}] Email: ${newUser.email}`);
    console.log(`✅ [${webhookId}] Role: ${newUser.role}`);
  } catch (error) {
    console.error(
      `❌ [${webhookId}] Error creating user for Clerk ID ${clerkUser.id}:`,
      error,
    );
    console.error(`❌ [${webhookId}] Error details:`, {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack:
        error instanceof Error
          ? error.stack?.split("\n").slice(0, 5)
          : undefined,
    });
    throw error;
  }
}

async function handleUserUpdated(clerkUser: ClerkUser, webhookId: string) {
  try {
    console.log(`🔄 [${webhookId}] ===== PROCESSING USER UPDATED =====`);
    console.log(`🔄 [${webhookId}] Clerk ID: ${clerkUser.id}`);

    // Find existing user
    const existingUser = await userRepository.getUserByClerkId(clerkUser.id);
    if (!existingUser) {
      console.log(`User not found in database, creating: ${clerkUser.id}`);
      // If user doesn't exist, create them
      await handleUserCreated(clerkUser, webhookId);
      return;
    }

    // Extract role from metadata
    const newRole = extractUserRole(clerkUser, webhookId);

    // Update role if it changed
    if (existingUser.role !== newRole) {
      await userRepository.updateUserRole(existingUser.id, newRole);
      console.log(
        `User role updated: ${existingUser.email} (${existingUser.role} -> ${newRole})`,
      );
    }

    // Note: For simplicity, we're only syncing role changes from Clerk metadata
    // Additional fields like firstName, lastName, email could be synced here if needed
  } catch (error) {
    console.error(`Error updating user for Clerk ID ${clerkUser.id}:`, error);
    throw error;
  }
}

async function handleUserDeleted(clerkUser: ClerkUser, webhookId: string) {
  try {
    console.log(`🗑️ [${webhookId}] ===== PROCESSING USER DELETED =====`);
    console.log(`🗑️ [${webhookId}] Clerk ID: ${clerkUser.id}`);

    // Find user in database
    const existingUser = await userRepository.getUserByClerkId(clerkUser.id);
    if (!existingUser) {
      console.log(`User not found in database: ${clerkUser.id}`);
      return;
    }

    // Delete user from database
    await userRepository.deleteUser(existingUser.id);
    console.log(`User deleted successfully: ${existingUser.email}`);
  } catch (error) {
    console.error(`Error deleting user for Clerk ID ${clerkUser.id}:`, error);
    throw error;
  }
}

/**
 * Extract user role from Clerk metadata
 * Checks public_metadata, private_metadata, and unsafe_metadata in that order
 * Defaults to MEMBER if no role is found
 */
function extractUserRole(clerkUser: ClerkUser, webhookId: string): UserRole {
  console.log(`🔍 [${webhookId}] Extracting user role from metadata...`);

  // Check metadata sources in order of preference
  const roleFromPublic = clerkUser.public_metadata?.role;
  const roleFromPrivate = clerkUser.private_metadata?.role;
  const roleFromUnsafe = clerkUser.unsafe_metadata?.role;

  console.log(`🔍 [${webhookId}] Role sources:`, {
    public: roleFromPublic || "Not set",
    private: roleFromPrivate || "Not set",
    unsafe: roleFromUnsafe || "Not set",
  });

  const role = roleFromPublic || roleFromPrivate || roleFromUnsafe;

  // Validate role and default to MEMBER
  if (role && Object.values(UserRole).includes(role)) {
    console.log(`✅ [${webhookId}] Valid role found: ${role}`);
    return role;
  }

  console.log(
    `⚠️ [${webhookId}] No valid role found for user ${clerkUser.id}, defaulting to MEMBER`,
  );
  console.log(`⚠️ [${webhookId}] Available roles:`, Object.values(UserRole));
  console.log(`⚠️ [${webhookId}] Found role value: ${role}`);
  return UserRole.MEMBER;
}
