import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __dbInitialized: boolean | undefined
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[db] DATABASE_URL environment variable is not set!');
  }
  if (url && !url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    console.error('[db] DATABASE_URL must start with postgresql:// or postgres://');
    console.error('[db] Current DATABASE_URL starts with:', url.substring(0, 20));
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

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

  // Verify DATABASE_URL is set before attempting any DB operations
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set. Please add it in Vercel → Settings → Environment Variables.');
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error(`DATABASE_URL must start with postgresql:// or postgres://. Current value starts with: "${url.substring(0, 30)}..."`);
  }

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
    console.log('[db] Tables initialized successfully');
  } catch (e: any) {
    console.error('[db] Initialization error:', e?.message || e);
    // Don't set __dbInitialized to true if it failed — let it retry next request
    throw e;
  }
}
