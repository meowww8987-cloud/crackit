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
  // Exclude heavy optional deps from the standalone server bundle.
  // - sharp: only needed for next/image optimization (we don't use it)
  // - @img: same as above
  // - Prisma non-SQLite engines: we only use SQLite
  // This shaves ~95MB off the deployment.
  outputFileTracingExcludes: {
    '*': [
      './node_modules/typescript/**/*',
      './node_modules/@img/**/*',
      './node_modules/sharp/**/*',
      './node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm*',
      './node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm*',
      './node_modules/@prisma/client/runtime/query_engine_bg.cockroachdb.wasm*',
      './node_modules/@prisma/client/runtime/query_engine_bg.sqlserver.wasm*',
      './node_modules/@prisma/client/runtime/query_compiler_bg.mysql.wasm*',
      './node_modules/@prisma/client/runtime/query_compiler_bg.postgresql.wasm*',
      './node_modules/@prisma/client/runtime/query_compiler_bg.cockroachdb.wasm*',
      './node_modules/@prisma/client/runtime/query_compiler_bg.sqlserver.wasm*',
    ],
  },
};

export default nextConfig;
