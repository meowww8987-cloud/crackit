import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
// Delete all pairs where userB is null (no one joined) AND created > 5 min ago
const cutoff = new Date(Date.now() - 5 * 60 * 1000);
const r = await p.partnerPair.deleteMany({
  where: { userBName: null, createdAt: { lt: cutoff } }
});
console.log(`Deleted ${r.count} stale pair(s) with no joiner.`);
const remaining = await p.partnerPair.findMany({ orderBy: { createdAt: 'desc' } });
console.log(`Remaining: ${remaining.length} pair(s)`);
remaining.forEach(pair => {
  console.log(`  ${pair.code} — A:${pair.userAName} B:${pair.userBName || '(waiting)'} created ${pair.createdAt.toISOString()}`);
});
await p.$disconnect();
