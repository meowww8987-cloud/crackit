import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('All PartnerPair rows:');
const pairs = await p.partnerPair.findMany({ orderBy: { createdAt: 'desc' } });
console.log(JSON.stringify(pairs, null, 2));
console.log(`Total: ${pairs.length}`);
await p.$disconnect();
