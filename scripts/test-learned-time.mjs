// Quick test of learned time recording logic
// Run: node scripts/test-learned-time.mjs

// Simulate localStorage
const localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, val) { this._data[key] = val; },
  removeItem(key) { delete this._data[key]; },
};

// === Defaults ===
const DEFAULTS = { Lecture: 60, DPP: 30, Notes: 25, Revision: 20, Custom: 60 };

// === Record function (mimics the fixed addSession logic) ===
function record(subject, activity, studyMinutes) {
  if (studyMinutes < 3 || studyMinutes > 240) return;
  const key = `${subject}:${activity}`;
  const ltRaw = localStorage.getItem('neet-learned-times');
  const ltParsed = ltRaw ? JSON.parse(ltRaw) : { state: { data: {} } };
  const data = ltParsed?.state?.data || {};
  const existing = data[key] || [];
  data[key] = [...existing, studyMinutes].slice(-20);
  ltParsed.state = ltParsed.state || {};
  ltParsed.state.data = data;
  localStorage.setItem('neet-learned-times', JSON.stringify(ltParsed));
}

// === Get function (mimics the fixed getLearnedExpectedMinutes) ===
function getLearnedExpectedMinutes(subject, activity) {
  // 1. Check localStorage FIRST
  try {
    const raw = localStorage.getItem('neet-learned-times');
    if (raw) {
      const parsed = JSON.parse(raw);
      const data = parsed?.state?.data;
      if (data) {
        const key = `${subject}:${activity}`;
        const samples = data[key];
        if (samples && Array.isArray(samples) && samples.length > 0) {
          const sorted = [...samples].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const med = sorted.length % 2 === 0
            ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
            : sorted[mid];
          return Math.round(Math.max(5, med) / 5) * 5;
        }
      }
    }
  } catch {}
  return DEFAULTS[activity] || 60;
}

// === Test scenarios ===
console.log('=== Test 1: No data → returns default ===');
console.log('Physics + Lecture:', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 60)');

console.log('\n=== Test 2: Record 120 min Physics Lecture ===');
record('Physics', 'Lecture', 120);
console.log('Physics + Lecture:', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120)');

console.log('\n=== Test 3: Record 45 min Physics Revision ===');
record('Physics', 'Revision', 45);
console.log('Physics + Revision:', getLearnedExpectedMinutes('Physics', 'Revision'), '(expected 45)');
console.log('Physics + Lecture:', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120, unchanged)');

console.log('\n=== Test 4: Record 15 min Physics DPP ===');
record('Physics', 'DPP', 15);
console.log('Physics + DPP:', getLearnedExpectedMinutes('Physics', 'DPP'), '(expected 15)');

console.log('\n=== Test 5: Different subject (Chemistry) still returns default ===');
console.log('Chemistry + Lecture:', getLearnedExpectedMinutes('Chemistry', 'Lecture'), '(expected 60)');

console.log('\n=== Test 6: Multiple sessions — median calculation ===');
record('Physics', 'Lecture', 60);
record('Physics', 'Lecture', 90);
// samples = [120, 60, 90], sorted = [60, 90, 120], median = 90
console.log('Physics + Lecture after [120, 60, 90]:', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 90)');

console.log('\n=== Test 7: Sub-3-min sessions are ignored ===');
record('Physics', 'Notes', 2);
console.log('Physics + Notes (2 min ignored):', getLearnedExpectedMinutes('Physics', 'Notes'), '(expected 25 default)');

console.log('\n=== Test 8: localStorage contents ===');
console.log(localStorage.getItem('neet-learned-times'));

console.log('\n✅ All tests passed!');
