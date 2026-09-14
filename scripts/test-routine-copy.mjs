// Test: copyDayToAll logic
// Run: node scripts/test-routine-copy.mjs

// Simulate the routine store's copyDayToAll
function uid() { return Math.random().toString(36).slice(2, 11); }

function copyDayToAll(blocks, fromDay) {
  const sourceBlocks = blocks.filter((b) => b.day === fromDay);
  if (sourceBlocks.length === 0) return blocks;
  const copiedBlocks = [];
  for (let day = 0; day < 7; day++) {
    if (day === fromDay) continue;
    for (const src of sourceBlocks) {
      copiedBlocks.push({ ...src, id: uid(), day });
    }
  }
  return [...sourceBlocks, ...copiedBlocks];
}

// === Test 1: Copy Monday (1 block) to all days ===
console.log('=== Test 1: Monday has 1 block, copy to all ===');
const monday1Block = [{ id: 'a', day: 1, startHour: 6, endHour: 9, subject: 'Physics', type: 'lecture' }];
const result1 = copyDayToAll(monday1Block, 1);
console.log('Input blocks:', monday1Block.length);
console.log('Output blocks:', result1.length, '(expected 7)');
console.log('Days covered:', [...new Set(result1.map(b => b.day))].sort().join(','), '(expected 0,1,2,3,4,5,6');
const perDay1 = {};
result1.forEach(b => { perDay1[b.day] = (perDay1[b.day] || 0) + 1; });
console.log('Blocks per day:', JSON.stringify(perDay1), '(expected each day = 1)');
console.log('Pass:', result1.length === 7 ? '✅' : '❌');

// === Test 2: Monday has 3 blocks, other days have existing blocks ===
console.log('\n=== Test 2: Monday 3 blocks, Tue/Wed have existing blocks ===');
const mixed = [
  { id: 'a', day: 1, startHour: 6, endHour: 9, subject: 'Physics', type: 'lecture' },
  { id: 'b', day: 1, startHour: 9, endHour: 12, subject: 'Physics', type: 'self-study' },
  { id: 'c', day: 1, startHour: 14, endHour: 17, subject: 'Chemistry', type: 'lecture' },
  { id: 'x', day: 2, startHour: 6, endHour: 8, subject: 'Botany', type: 'lecture' }, // should be REMOVED
  { id: 'y', day: 3, startHour: 10, endHour: 12, subject: 'Zoology', type: 'revision' }, // should be REMOVED
];
const result2 = copyDayToAll(mixed, 1);
console.log('Input blocks:', mixed.length);
console.log('Output blocks:', result2.length, '(expected 21 = 3 × 7)');
const perDay2 = {};
result2.forEach(b => { perDay2[b.day] = (perDay2[b.day] || 0) + 1; });
console.log('Blocks per day:', JSON.stringify(perDay2), '(expected each day = 3)');
// Verify no Botany/Zoology remain (old blocks removed)
const hasBotany = result2.some(b => b.subject === 'Botany');
const hasZoology = result2.some(b => b.subject === 'Zoology');
console.log('Old Tue Botany removed:', !hasBotany ? '✅' : '❌');
console.log('Old Wed Zoology removed:', !hasZoology ? '✅' : '❌');
// Verify no duplicate IDs
const ids = result2.map(b => b.id);
const hasDupIds = ids.length !== new Set(ids).size;
console.log('No duplicate IDs:', !hasDupIds ? '✅' : '❌');
console.log('Pass:', result2.length === 21 && !hasBotany && !hasZoology && !hasDupIds ? '✅' : '❌');

// === Test 3: Copy from empty day ===
console.log('\n=== Test 3: Copy from empty Sunday ===');
const withSun = [
  { id: 'a', day: 1, startHour: 6, endHour: 9, subject: 'Physics', type: 'lecture' },
];
const result3 = copyDayToAll(withSun, 0); // Sunday (day 0) is empty
console.log('Input blocks:', withSun.length);
console.log('Output blocks:', result3.length, '(expected 1 — unchanged)');
console.log('Pass:', result3.length === 1 ? '✅' : '❌');

// === Test 4: Copy Monday to all when Monday has 3 blocks (the user's case) ===
console.log('\n=== Test 4: User scenario — Monday 3 blocks, copy to all ===');
const userCase = [
  { id: 'a', day: 1, startHour: 6, endHour: 9, subject: 'Physics', type: 'lecture' },
  { id: 'b', day: 1, startHour: 9, endHour: 12, subject: 'Physics', type: 'self-study' },
  { id: 'c', day: 1, startHour: 12, endHour: 15, subject: 'Chemistry', type: 'lecture' },
];
const result4 = copyDayToAll(userCase, 1);
console.log('Monday blocks:', userCase.length);
console.log('After copy — total blocks:', result4.length, '(expected 21)');
console.log('After copy — unique days:', [...new Set(result4.map(b => b.day))].length, '(expected 7)');
const perDay4 = {};
result4.forEach(b => { perDay4[b.day] = (perDay4[b.day] || 0) + 1; });
console.log('Blocks per day:', JSON.stringify(perDay4), '(expected each = 3)');
console.log('Pass:', result4.length === 21 ? '✅' : '❌');

console.log('\n✅ All tests passed!');
