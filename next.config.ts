import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow dev origins for preview
  allowedDevOrigins: ['*'],
  // Disable HMR to prevent stale module cache issues
  devIndicators: false,
};

export default nextConfig;
