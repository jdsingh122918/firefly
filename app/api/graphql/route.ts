// Temporarily disabled due to Apollo Server dependency issues
// TODO: Re-enable after resolving @yaacovcr/transform dependency

export async function POST() {
  return Response.json({
    message:
      "GraphQL endpoint temporarily disabled - will be enabled in Phase 3",
  });
}

export async function GET() {
  return Response.json({
    message: "GraphQL endpoint coming soon - authentication flow is working!",
  });
}
