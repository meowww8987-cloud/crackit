import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __dbInitialized: boolean | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Ensures the database tables exist. On Vercel serverless, the build step
 * doesn't run `prisma db push` (to avoid write-permission issues during build).
 * So we auto-create tables on first request using raw SQL.
 *
 * For PostgreSQL, uses CREATE TABLE IF NOT EXISTS (safe to call every request).
 */
export async function ensureDbInitialized() {
  if (globalForPrisma.__dbInitialized) return;
  try {
    // Create PartnerPair table if it doesn't exist (PostgreSQL syntax)
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "PartnerPair" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "userAName" TEXT NOT NULL,
      "userBName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userAData" TEXT,
      "userBData" TEXT,
      "userAUpdatedAt" TIMESTAMP(3),
      "userBUpdatedAt" TIMESTAMP(3)
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "PartnerPair_code_key" ON "PartnerPair"("code")`;
    globalForPrisma.__dbInitialized = true;
  } catch (e) {
    console.error('[db] Initialization error:', e);
    globalForPrisma.__dbInitialized = true;
  }
}
