import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed output: "standalone" — z.ai may not support standalone mode.
  // Standard Next.js build works on all platforms.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['*'],
  devIndicators: false,
};

export default nextConfig;
