import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

// POST /api/partner/join — join an existing pair with a code
export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { code, name } = await req.json();
    if (!code || !name) return NextResponse.json({ error: 'Code and name required' }, { status: 400 });

    const pair = await db.partnerPair.findUnique({ where: { code: code.toUpperCase() } });
    if (!pair) return NextResponse.json({ error: `Code "${code.toUpperCase()}" not found. Ask your partner to share their CURRENT code.` }, { status: 404 });
    if (pair.userBName) return NextResponse.json({ error: 'This pair already has 2 people. Create a new pair instead.' }, { status: 400 });

    const updated = await db.partnerPair.update({
      where: { id: pair.id },
      data: {
        userBName: name,
        userBData: JSON.stringify({
          todaySec: 0, streak: 0, lastSubject: null, lastTestScore: null, weekSec: 0, updatedAt: Date.now(),
        }),
      },
    });

    return NextResponse.json({
      code: updated.code,
      partnerName: updated.userAName,
      yourName: name,
      isUserB: true,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to join pair' }, { status: 500 });
  }
}
