import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/partner/sync — upload your study data to the pair
// GET /api/partner/sync?code=XXX&user=A — fetch partner's data
export async function POST(req: NextRequest) {
  try {
    const { code, isUserB, data } = await req.json();
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    const pair = await db.partnerPair.findUnique({ where: { code } });
    if (!pair) return NextResponse.json({ error: 'Pair not found' }, { status: 404 });

    const dataStr = JSON.stringify({ ...data, updatedAt: Date.now() });
    const updateField = isUserB ? 'userBData' : 'userAData';
    const timeField = isUserB ? 'userBUpdatedAt' : 'userAUpdatedAt';

    await db.partnerPair.update({
      where: { id: pair.id },
      data: { [updateField]: dataStr, [timeField]: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const user = req.nextUrl.searchParams.get('user'); // 'A' or 'B'
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    const pair = await db.partnerPair.findUnique({ where: { code } });
    if (!pair) return NextResponse.json({ error: 'Pair not found' }, { status: 404 });

    // If user=A, return userB's data (the partner's). If user=B, return userA's.
    // IMPORTANT: always return partnerName even if partnerData is null — this
    // is how the creator (user A) learns that someone has joined their pair.
    const partnerField = user === 'A' ? 'userBData' : 'userAData';
    const partnerName = user === 'A' ? pair.userBName : pair.userAName;
    const partnerTime = user === 'A' ? pair.userBUpdatedAt : pair.userAUpdatedAt;

    const partnerDataStr = pair[partnerField];

    return NextResponse.json({
      // partnerName is non-null the moment the partner joins, regardless of
      // whether they've synced any study data yet.
      partnerName: partnerName ?? null,
      partnerJoined: !!partnerName,
      // data may be null right after join (before partner's first sync) —
      // the client treats null data as "0s studied" which is correct.
      data: partnerDataStr ? JSON.parse(partnerDataStr) : null,
      lastSeen: partnerTime,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
