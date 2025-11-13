import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    return NextResponse.json({
      debug: {
        userId: userId || null,
        hasSessionClaims: !!sessionClaims,
        sessionClaims: sessionClaims || null,
        metadata: sessionClaims?.metadata || null,
        role: (sessionClaims?.metadata as { role?: string })?.role || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug auth failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
