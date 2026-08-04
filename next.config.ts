import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['*'],
  devIndicators: false,
  // Exclude heavy deps NOT needed at runtime + non-SQLite Prisma engines.
  // We ONLY use SQLite — keep sqlite engines, remove all others.
  // This reduces deployment size from ~98MB to ~40MB.
  outputFileTracingExcludes: {
    '*': [
      './node_modules/typescript/**/*',
      './node_modules/@img/**/*',
      './node_modules/sharp/**/*',
      // Remove ALL non-SQLite Prisma engines (MySQL, PostgreSQL, CockroachDB, SQL Server)
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
