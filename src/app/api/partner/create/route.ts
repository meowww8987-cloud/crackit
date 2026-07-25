import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { todayKey } from '@/lib/utils';

// POST /api/partner/create — create a new partner pair, get a code
export async function POST(req: NextRequest) {
  try {
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
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create pair' }, { status: 500 });
  }
}
