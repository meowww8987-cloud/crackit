// Query the server to see what B's latest data looks like
const BASE = 'http://localhost:3000';
const r = await fetch(`${BASE}/api/partner/sync?code=YHQJSH&user=A&_t=${Date.now()}`, {
  cache: 'no-store'
});
const data = await r.json();
console.log('B data as seen by A:');
console.log(JSON.stringify(data, null, 2));
console.log('B lastSeen (server):', data.lastSeen);
console.log('B age:', data.lastSeen ? Math.floor((Date.now() - new Date(data.lastSeen).getTime())/1000) + 's' : 'null');
