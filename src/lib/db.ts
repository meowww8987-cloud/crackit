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
 * Ensures the database tables exist. On z.ai / serverless, the build step
 * doesn't run `prisma db push` (to avoid write-permission issues during build).
 * So we auto-create tables on first request using raw SQL.
 *
 * This is safe to call on every request — SQLite's CREATE TABLE IF NOT EXISTS
 * is a no-op if the table already exists.
 */
export async function ensureDbInitialized() {
  if (globalForPrisma.__dbInitialized) return;
  try {
    // Create PartnerPair table if it doesn't exist
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "PartnerPair" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "userAName" TEXT NOT NULL,
      "userBName" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userAData" TEXT,
      "userBData" TEXT,
      "userAUpdatedAt" DATETIME,
      "userBUpdatedAt" DATETIME
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "PartnerPair_code_key" ON "PartnerPair"("code")`;
    globalForPrisma.__dbInitialized = true;
  } catch (e) {
    // If tables already exist (created by prisma db push locally), this fails
    // silently — that's fine. The error is only logged in dev.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[db] Table creation skipped (may already exist):', e);
    }
    globalForPrisma.__dbInitialized = true;
  }
}
