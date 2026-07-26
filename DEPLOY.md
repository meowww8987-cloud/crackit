# Deployment Guide

## ⚠️ Important: Database Setup Required

This app uses **PostgreSQL** (not SQLite) because serverless platforms (Vercel, Netlify) have read-only filesystems. SQLite won't work in production.

### Step 1: Get a Free PostgreSQL Database

**Option A: Vercel Postgres (easiest for Vercel)**
1. Go to your Vercel project → **Storage** tab → **Create** → **Postgres**
2. Copy the connection string (looks like `postgres://default:xxx@xxx.db.vercel-storage.com:5432/db`)

**Option B: Neon (recommended — free, works everywhere)**
1. Go to https://neon.tech → Sign up → Create project
2. Copy the connection string

**Option C: Supabase (free, works everywhere)**
1. Go to https://supabase.com → Create project
2. Settings → Database → Connection string → URI

### Step 2: Set Environment Variable

**On Vercel:**
- Project Settings → Environment Variables → Add
- Name: `DATABASE_URL`
- Value: your connection string from Step 1

**Locally:**
- Edit `.env` file, set `DATABASE_URL=postgres://...`

### Step 3: Deploy

```bash
# Install dependencies
bun install     # or: npm install

# Generate Prisma client + create tables
npx prisma generate
npx prisma db push

# Build & start (for non-Vercel platforms)
bun run build
bun run start

# For Vercel: just push to git or upload — Vercel handles build automatically
```

## Quick Start (Local Dev)

1. **Install:** `bun install`
2. **Set up DB:** Create a free PostgreSQL DB (see above), add URL to `.env`
3. **Generate:** `npx prisma generate && npx prisma db push`
4. **Run:** `bun run dev`

## Tech Stack
- Next.js 16.1.3 (Turbopack)
- React 19 + TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL
- Framer Motion + Zustand

## Troubleshooting

**"Failed to create pair" error on deployed site:**
- DATABASE_URL is not set, or points to SQLite (which doesn't work on serverless)
- Fix: Set DATABASE_URL to a PostgreSQL connection string in your hosting platform's environment variables

**Build fails with ERESOLVE error:**
- The `.npmrc` file has `legacy-peer-deps=true` — should be fixed
- If still failing, set Vercel Install Command to: `npm install --legacy-peer-deps`

**Prisma engine errors:**
- `binaryTargets` in schema.prisma includes both `native` and `rhel-openssl-3.0.x`
- This covers local dev + Vercel's serverless runtime
