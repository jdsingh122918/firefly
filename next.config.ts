import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark Prisma as server-only to prevent client-side bundling
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
