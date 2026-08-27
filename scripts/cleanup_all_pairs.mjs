import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.partnerPair.deleteMany({});
console.log(`Deleted ${r.count} pair(s). DB is now clean.`);
await p.$disconnect();
