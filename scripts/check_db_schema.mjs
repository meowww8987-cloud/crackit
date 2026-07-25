import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  // Check if PartnerPair table exists and has correct schema
  const result = await p.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='PartnerPair'`;
  console.log('PartnerPair table exists:', result.length > 0);
  if (result.length > 0) {
    const schema = await p.$queryRaw`SELECT sql FROM sqlite_master WHERE type='table' AND name='PartnerPair'`;
    console.log('Schema:', schema[0].sql);
  }
  // Try a create to verify it works
  const pair = await p.partnerPair.create({
    data: {
      code: 'TEST' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      userAName: 'DBTest',
      userAData: JSON.stringify({ todaySec: 0, streak: 0, lastSubject: null, lastTestScore: null, weekSec: 0, updatedAt: Date.now() }),
    },
  });
  console.log('Create works! Sample:', pair.code);
  // Clean up
  await p.partnerPair.delete({ where: { id: pair.id } });
  console.log('Cleaned up test pair.');
} catch (e) {
  console.error('DB ERROR:', e.message);
}
await p.$disconnect();
