import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
// Delete the pair that has no partner yet (userA created but B never joined)
const r = await p.partnerPair.deleteMany({ where: { userBName: null } });
console.log(`Deleted ${r.count} pair(s) with no partner joined.`);
const remaining = await p.partnerPair.findMany();
console.log(`Remaining pairs: ${remaining.length}`);
await p.$disconnect();
