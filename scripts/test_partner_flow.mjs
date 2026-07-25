// Simulates: A creates pair → B joins → A polls for partner
const BASE = 'http://localhost:3000';

async function step(name, fn) {
  process.stdout.write(`${name}... `);
  try {
    const r = await fn();
    console.log('OK', JSON.stringify(r));
    return r;
  } catch (e) {
    console.log('FAIL', e.message);
    throw e;
  }
}

// 1. A creates
const a = await step('A creates pair', async () => {
  const r = await fetch(`${BASE}/api/partner/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice' }),
  });
  return r.json();
});

// 2. A polls (should see partnerName=null, partnerJoined=false)
await step('A polls after create', async () => {
  const r = await fetch(`${BASE}/api/partner/sync?code=${a.code}&user=A`);
  return r.json();
});

// 3. B joins
const b = await step('B joins with code', async () => {
  const r = await fetch(`${BASE}/api/partner/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: a.code, name: 'Bob' }),
  });
  return r.json();
});

// 4. B syncs data
await step('B syncs data', async () => {
  const r = await fetch(`${BASE}/api/partner/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: a.code,
      isUserB: true,
      data: { todaySec: 3600, streak: 5, lastSubject: 'Physics', lastTestScore: 85, weekSec: 18000 },
    }),
  });
  return r.json();
});

// 5. A polls again — THIS is the critical step. Should show partnerName='Bob'
await step('A polls after B joined', async () => {
  const r = await fetch(`${BASE}/api/partner/sync?code=${a.code}&user=A`);
  return r.json();
});

// Cleanup
await fetch(`${BASE}/api/partner/sync`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ code: a.code, isUserB: false, data: {} }) });
