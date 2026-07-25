// Test with verbose error reporting
const BASE = 'http://localhost:3000';
const r = await fetch(`${BASE}/api/partner/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'tf' }),
});
console.log('Status:', r.status);
console.log('Headers:', Object.fromEntries(r.headers.entries()));
const text = await r.text();
console.log('Body:', text);
