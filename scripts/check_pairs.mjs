import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const pairs = await p.partnerPair.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
console.log(JSON.stringify(pairs, null, 2));
await p.$disconnect();
