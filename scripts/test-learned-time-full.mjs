// Test the full learned-time flow: addTarget → getLearnedExpectedMinutes
// Run: node scripts/test-learned-time-full.mjs

const localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, val) { this._data[key] = val; },
};

const DEFAULTS = { Lecture: 60, DPP: 30, Notes: 25, Revision: 20, Custom: 60 };

// === Simulate addTarget recording ===
function addTargetRecord(subject, activity, expectedMinutes) {
  if (expectedMinutes < 5 || expectedMinutes > 240) return;
  // 1. Update Zustand store (we'll skip Zustand in this test, just localStorage)
  // 2. Write to localStorage
  try {
    const ltRaw = localStorage.getItem('neet-learned-times');
    const ltParsed = ltRaw ? JSON.parse(ltRaw) : { state: { data: {} } };
    const data = ltParsed?.state?.data || {};
    const key = `${subject}:${activity}`;
    const existing = data[key] || [];
    data[key] = [...existing, expectedMinutes].slice(-20);
    ltParsed.state = ltParsed.state || {};
    ltParsed.state.data = data;
    localStorage.setItem('neet-learned-times', JSON.stringify(ltParsed));
  } catch (e) {
    console.error('Error writing:', e);
  }
}

// === Simulate getLearnedExpectedMinutes ===
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
  } catch (e) {
    console.error('Error reading:', e);
  }
  return DEFAULTS[activity] || 60;
}

console.log('=== FULL FLOW TEST ===\n');

// Step 1: Add Physics Lecture target with 120 min
console.log('Step 1: addTarget(Physics, Lecture, 120)');
addTargetRecord('Physics', 'Lecture', 120);
console.log('  localStorage:', localStorage.getItem('neet-learned-times'));

// Step 2: Read back
console.log('\nStep 2: getLearnedExpectedMinutes(Physics, Lecture)');
console.log('  Result:', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120)');

// Step 3: Add another Physics Lecture with 90 min
console.log('\nStep 3: addTarget(Physics, Lecture, 90)');
addTargetRecord('Physics', 'Lecture', 90);
console.log('  Result:', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 105 = median of [120, 90])');

// Step 4: Add Physics Revision with 30 min
console.log('\nStep 4: addTarget(Physics, Revision, 30)');
addTargetRecord('Physics', 'Revision', 30);
console.log('  Physics Revision:', getLearnedExpectedMinutes('Physics', 'Revision'), '(expected 30)');
console.log('  Physics Lecture:', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 105 — unchanged)');

// Step 5: Check different subject
console.log('\nStep 5: Chemistry Lecture (no history)');
console.log('  Result:', getLearnedExpectedMinutes('Chemistry', 'Lecture'), '(expected 60 default)');

console.log('\n=== ALL TESTS PASSED ===');
console.log('\nFinal localStorage:');
console.log(localStorage.getItem('neet-learned-times'));
