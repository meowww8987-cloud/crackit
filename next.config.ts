import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['*'],
  devIndicators: false,
  // Only exclude the heaviest non-SQLite Prisma engines.
  // Keep the SQLite engine — it's required for the app to work.
  outputFileTracingExcludes: {
    '*': [
      './node_modules/typescript/**/*',
      './node_modules/@img/**/*',
      './node_modules/sharp/**/*',
    ],
  },
};

export default nextConfig;
