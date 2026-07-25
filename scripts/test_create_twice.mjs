// Simulate: B already has a code (stale), tries to create another
const BASE = 'http://localhost:3000';
const r1 = await fetch(`${BASE}/api/partner/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test1' }),
});
const d1 = await r1.json();
console.log('First create:', d1);

const r2 = await fetch(`${BASE}/api/partner/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test2' }),
});
const d2 = await r2.json();
console.log('Second create:', d2);
