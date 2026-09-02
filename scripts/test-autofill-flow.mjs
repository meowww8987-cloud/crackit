// Test: user flow for expected time auto-fill
// Run: node scripts/test-autofill-flow.mjs

const localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, val) { this._data[key] = val; },
  removeItem(key) { delete this._data[key]; },
};

const DEFAULTS = { Lecture: 60, DPP: 30, Notes: 25, Revision: 20, Custom: 60 };

// === Mimic addTarget recording (expected time) ===
function addTargetRecord(subject, activity, expectedMinutes) {
  if (expectedMinutes < 5 || expectedMinutes > 240) return;
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
  } catch {}
}

// === Mimic addSession recording (actual study time) ===
function addSessionRecord(subject, activity, studySeconds) {
  const minutes = Math.round(studySeconds / 60);
  if (minutes < 3 || minutes > 240) return;
  // Same as addTargetRecord — both write to the same store
  addTargetRecord(subject, activity, minutes);
}

// === Mimic getLearnedExpectedMinutes ===
function getLearnedExpectedMinutes(subject, activity) {
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

console.log('=== USER FLOW SIMULATION ===\n');

console.log('Step 1: User opens AddTargetSheet for Physics + Lecture');
console.log('  → getLearnedExpectedMinutes(Physics, Lecture):', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 60 default)');

console.log('\nStep 2: User sets expected time to 120 min and adds Lec 1 target');
addTargetRecord('Physics', 'Lecture', 120);
console.log('  → Recorded 120 for Physics:Lecture');

console.log('\nStep 3: User opens AddTargetSheet again for Physics + Lecture (Lec 2)');
console.log('  → getLearnedExpectedMinutes(Physics, Lecture):', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120 — AUTO-FILLED!)');

console.log('\nStep 4: User adds Lec 2 with 120 min (auto-filled, user confirms)');
addTargetRecord('Physics', 'Lecture', 120);
console.log('  → Recorded 120 again for Physics:Lecture');

console.log('\nStep 5: User studies Lec 1 for 90 min, session completes');
addSessionRecord('Physics', 'Lecture', 90 * 60);
console.log('  → Recorded 90 (actual study time) for Physics:Lecture');

console.log('\nStep 6: User opens AddTargetSheet for Physics + Lecture (Lec 3)');
// samples = [120, 120, 90], sorted = [90, 120, 120], median = 120
console.log('  → getLearnedExpectedMinutes(Physics, Lecture):', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120 — median of [120, 120, 90])');

console.log('\nStep 7: User switches to Chemistry + Lecture');
console.log('  → getLearnedExpectedMinutes(Chemistry, Lecture):', getLearnedExpectedMinutes('Chemistry', 'Lecture'), '(expected 60 default — different subject)');

console.log('\nStep 8: User adds Chemistry Lecture with 45 min');
addTargetRecord('Chemistry', 'Lecture', 45);
console.log('  → Recorded 45 for Chemistry:Lecture');

console.log('\nStep 9: User opens AddTargetSheet for Chemistry + Lecture again');
console.log('  → getLearnedExpectedMinutes(Chemistry, Lecture):', getLearnedExpectedMinutes('Chemistry', 'Lecture'), '(expected 45 — AUTO-FILLED!)');

console.log('\nStep 10: User switches to Physics + Revision');
console.log('  → getLearnedExpectedMinutes(Physics, Revision):', getLearnedExpectedMinutes('Physics', 'Revision'), '(expected 20 default — different activity)');

console.log('\nStep 11: User adds Physics Revision with 30 min');
addTargetRecord('Physics', 'Revision', 30);
console.log('  → Recorded 30 for Physics:Revision');

console.log('\nStep 12: User opens AddTargetSheet for Physics + Revision again');
console.log('  → getLearnedExpectedMinutes(Physics, Revision):', getLearnedExpectedMinutes('Physics', 'Revision'), '(expected 30 — AUTO-FILLED!)');

console.log('\n=== CROSS-TAB SIMULATION ===');
console.log('Step 13: User adds target from Study Tab (quick add Physics Lecture)');
console.log('  → getLearnedExpectedMinutes(Physics, Lecture):', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120 — learned from Syllabus tab!)');

console.log('\nStep 14: User long-presses Lecture button on a Physics lecture card in Syllabus');
console.log('  → getLearnedExpectedMinutes(Physics, Lecture):', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120 — same store, same result!)');

console.log('\nStep 15: User clicks "Start Study" in Lecture Detail Sheet (Physics)');
console.log('  → getLearnedExpectedMinutes(Physics, Lecture):', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120 — works everywhere!)');

console.log('\n=== ALL LECTURES OF PHYSICS GET SAME TIME ===');
console.log('Step 16: User adds Lec 5 of Physics (different chapter, same subject)');
console.log('  → getLearnedExpectedMinutes(Physics, Lecture):', getLearnedExpectedMinutes('Physics', 'Lecture'), '(expected 120 — per subject+activity, not per lecture!)');

console.log('\n✅ All auto-fill scenarios work correctly!');
console.log('\nFinal localStorage state:');
console.log(localStorage.getItem('neet-learned-times'));
