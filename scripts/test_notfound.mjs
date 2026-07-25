// Test that polling with a non-existent code returns 404
const BASE = 'http://localhost:3000';
const r = await fetch(`${BASE}/api/partner/sync?code=FAKE00&user=A`);
console.log('Status:', r.status);
console.log('Body:', JSON.stringify(await r.json()));
