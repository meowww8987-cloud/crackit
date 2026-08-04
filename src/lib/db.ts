import { PrismaClient } from '@prisma/client'
import fs from 'fs';
import path from 'path';

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
 * Ensures the database file + tables exist. On z.ai / serverless, the build
 * step doesn't run `prisma db push` (to avoid write-permission issues during
 * build). So we auto-create the db file + tables on first request.
 *
 * This is safe to call on every request — SQLite's CREATE TABLE IF NOT EXISTS
 * is a no-op if the table already exists.
 */
export async function ensureDbInitialized() {
  if (globalForPrisma.__dbInitialized) return;
  try {
    // Ensure the db directory exists (relative to process working directory)
    const dbDir = path.join(process.cwd(), 'db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

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
    // Log the actual error so we can debug on the server
    console.error('[db] Initialization error:', e);
    globalForPrisma.__dbInitialized = true;
  }
}
