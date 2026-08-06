import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

// POST /api/partner/create — create a new partner pair, get a code
export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    // Generate 6-char code
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();

    const pair = await db.partnerPair.create({
      data: {
        code,
        userAName: name,
        userAData: JSON.stringify({
          todaySec: 0, streak: 0, lastSubject: null, lastTestScore: null, weekSec: 0, updatedAt: Date.now(),
        }),
      },
    });

    return NextResponse.json({ code: pair.code, id: pair.id });
  } catch (e: any) {
    // Log the full error for debugging — check Vercel function logs to see this
    console.error('[partner/create] Error:', e?.message || e);

    // Return the ACTUAL error message so the user can see what's wrong
    return NextResponse.json({
      error: e?.message || 'Failed to create pair',
    }, { status: 500 });
  }
}
