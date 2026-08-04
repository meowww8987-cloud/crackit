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
 * Ensures the database tables exist. Uses dynamic imports for fs/path so
 * the module doesn't crash on platforms that don't support Node.js fs
 * (like edge runtimes). The table creation uses CREATE TABLE IF NOT EXISTS
 * so it's safe to call on every request.
 */
export async function ensureDbInitialized() {
  if (globalForPrisma.__dbInitialized) return;
  try {
    // Try to create the db directory (dynamic import — won't crash if fs unavailable)
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dbDir = path.join(process.cwd(), 'db');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    } catch {}

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
    console.error('[db] Initialization error:', e);
    globalForPrisma.__dbInitialized = true;
  }
}
