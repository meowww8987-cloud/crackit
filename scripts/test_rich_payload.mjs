// Test that the sync payload now includes all the new fields
const BASE = 'http://localhost:3000';

// Create pair
const a = await (await fetch(`${BASE}/api/partner/create`, {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({name: 'Alice'}),
})).json();
console.log('Created:', a.code);

// B joins
await (await fetch(`${BASE}/api/partner/join`, {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({code: a.code, name: 'Bob'}),
})).json();

// B syncs with RICH payload (simulating what the new syncData sends)
const richPayload = {
  todaySec: 5040,  // 1h 24m
  weekSec: 18000,
  streak: 5,
  lastSubject: 'Physics',
  lastTopic: 'Kinematics',
  isStudying: true,
  isPaused: false,
  currentSessionSec: 5040,
  targetsDone: 3,
  targetsTotal: 5,
  lastTestScore: 620,
  weekTestCount: 2,
  updatedAt: Date.now(),
};
await fetch(`${BASE}/api/partner/sync`, {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ code: a.code, isUserB: true, data: richPayload }),
});

// A polls — should see all the rich data
const aView = await (await fetch(`${BASE}/api/partner/sync?code=${a.code}&user=A`)).json();
console.log('A sees partner data:');
console.log('  name:', aView.partnerName);
console.log('  todaySec:', aView.data.todaySec, '(= 1h 24m =', Math.floor(aView.data.todaySec/3600)+'h', Math.floor((aView.data.todaySec%3600)/60)+'m)');
console.log('  isStudying:', aView.data.isStudying);
console.log('  lastSubject:', aView.data.lastSubject);
console.log('  lastTopic:', aView.data.lastTopic);
console.log('  targetsDone:', aView.data.targetsDone, '/', aView.data.targetsTotal);
console.log('  lastTestScore:', aView.data.lastTestScore);
console.log('  streak:', aView.data.streak);

// Cleanup
await fetch(`${BASE}/api/partner/sync`, {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ code: a.code, isUserB: false, data: {} }),
});
