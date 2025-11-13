import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Webhook test endpoint active",
    endpoints: {
      "GET /api/debug/webhook-test": "This info page",
      "POST /api/debug/webhook-test/simulate": "Simulate webhook call",
      "GET /api/debug/webhook-test/config": "Check webhook configuration",
      "POST /api/debug/webhook-test/ping": "Simple endpoint test",
    },
    instructions: {
      "1": "Check webhook configuration with GET /config",
      "2": "Test basic connectivity with POST /ping",
      "3": "Simulate user creation with POST /simulate",
      "4": "Check actual webhook at /api/webhooks/clerk",
    },
  });
}

export async function POST(request: Request) {
  console.log("🧪 ===== WEBHOOK TEST ENDPOINT HIT =====");
  console.log(`🧪 Method: ${request.method}`);
  console.log(`🧪 URL: ${request.url}`);
  console.log(`🧪 Headers:`, Object.fromEntries(request.headers.entries()));

  try {
    const body = await request.text();
    console.log(`🧪 Body: ${body}`);

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
      console.log(`🧪 Parsed body:`, parsedBody);
    } catch {
      console.log(`🧪 Body is not valid JSON`);
    }

    return NextResponse.json({
      success: true,
      received: {
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
        parsedBody: parsedBody || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("🧪 Test endpoint error:", error);
    return NextResponse.json(
      {
        error: "Test endpoint failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
