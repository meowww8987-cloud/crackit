#!/bin/bash
# Verify Syllabus lecture ordering: build a chapter, expand, check L1/L2/L3 appear top-down.
set -e
cd /home/z/my-project

pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

nohup bash -c 'exec node node_modules/next/dist/bin/next dev -p 3000 > /tmp/next-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
echo "[1/6] dev started"
sleep 4
for i in 1 2 3 4 5; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 http://localhost:3000/)
  if [ "$HTTP" = "200" ]; then echo "[2/6] warmup 200 (attempt $i)"; break; fi
  sleep 2
done

agent-browser open http://localhost:3000/ 2>&1 | head -2
sleep 4
agent-browser set viewport 390 844 2>&1 | head -1
echo "[3/6] browser opened"

# Inject a syllabus with a chapter where lectures are stored OUT OF ORDER
# in the raw array, to confirm sortLectures fixes the display.
agent-browser eval "(() => {
  // Build a syllabus state where chapter has lectures with lecNo 3, 1, 5, 2, 4
  // stored in that array order. Without sortLectures, they'd display in
  // 3,1,5,2,4 (raw order). With sortLectures, they should display 1,2,3,4,5.
  const subjId = 'subj-physics';
  const chapId = 'chap-mechanics';
  const baseTs = Date.now();
  const subjects = [{ id: subjId, name: 'Physics', order: 0, createdAt: baseTs }];
  const chapters = [{ id: chapId, subjectId: subjId, name: 'Mechanics', pyqCount: 0, createdAt: baseTs, order: 0 }];
  // Lectures stored in deliberately shuffled order: lecNo 3, 1, 5, 2, 4
  const lectures = [
    { id: 'lec-3', chapterId: chapId, lecNo: 3, isCustom: false, topic: 'Newton Third Law', done: false, dppDone: false, notesDone: false, revisionDone: false, hardness: 3, pyqCount: 0, revisionStage: -1, createdAt: baseTs + 3000 },
    { id: 'lec-1', chapterId: chapId, lecNo: 1, isCustom: false, topic: 'Newton First Law', done: false, dppDone: false, notesDone: false, revisionDone: false, hardness: 3, pyqCount: 0, revisionStage: -1, createdAt: baseTs + 1000 },
    { id: 'lec-5', chapterId: chapId, lecNo: 5, isCustom: false, topic: 'Friction', done: false, dppDone: false, notesDone: false, revisionDone: false, hardness: 3, pyqCount: 0, revisionStage: -1, createdAt: baseTs + 5000 },
    { id: 'lec-2', chapterId: chapId, lecNo: 2, isCustom: false, topic: 'Newton Second Law', done: false, dppDone: false, notesDone: false, revisionDone: false, hardness: 3, pyqCount: 0, revisionStage: -1, createdAt: baseTs + 2000 },
    { id: 'lec-4', chapterId: chapId, lecNo: 4, isCustom: false, topic: 'Pseudo Forces', done: false, dppDone: false, notesDone: false, revisionDone: false, hardness: 3, pyqCount: 0, revisionStage: -1, createdAt: baseTs + 4000 },
    // A custom lecture to confirm it sorts AFTER normal lectures
    { id: 'lec-c1', chapterId: chapId, lecNo: 1, isCustom: true, topic: 'Bonus: Banking', done: false, dppDone: false, notesDone: false, revisionDone: false, hardness: 3, pyqCount: 0, revisionStage: -1, createdAt: baseTs + 6000 },
  ];
  localStorage.setItem('neet-syllabus', JSON.stringify({ state: { subjects, chapters, lectures, version: 3 }, version: 3 }));
  return 'injected ' + lectures.length + ' lectures (shuffled order in storage)';
})()" 2>&1 | head -3
agent-browser reload 2>&1 | head -1
sleep 5
echo "[4/6] syllabus injected"

# Click Syllabus tab
agent-browser eval "(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent.trim() === '') b.click(); }
  const sylBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Syllabus'));
  if (sylBtn) sylBtn.click();
  return 'syllabus tab';
})()" 2>&1 | head -3
sleep 3

# Find the chapter and expand it
agent-browser eval "(() => {
  // Find the chapter card and click to expand
  const cards = Array.from(document.querySelectorAll('div'));
  const mech = cards.find(d => d.textContent.includes('Mechanics') && d.textContent.length < 200 && !d.textContent.includes('Newton'));
  if (mech) { mech.click(); return 'expanded Mechanics'; }
  return 'Mechanics chapter not found';
})()" 2>&1 | head -3
sleep 2

# Screenshot
agent-browser screenshot /tmp/syllabus-order.png 2>&1 | head -3
echo "[5/6] screenshot saved"
ls -la /tmp/syllabus-order.png

# Verify the displayed order via DOM
agent-browser eval "(() => {
  // Find all lecture labels in the chapter
  const cards = Array.from(document.querySelectorAll('div.glass, div.rounded-2xl'));
  const mechCard = cards.find(c => c.textContent.includes('Mechanics') && c.textContent.includes('Newton'));
  if (!mecCard) return 'Mechanics card not found';
  // Get all lecture labels (L1, L2, etc.) in DOM order
  const labels = Array.from(mechCard.querySelectorAll('div, span'))
    .filter(el => el.children.length === 0 && /^L[0-9]+\$|^C[0-9]+\$/.test(el.textContent.trim()))
    .map(el => el.textContent.trim());
  return JSON.stringify({ labelOrder: labels });
})()" 2>&1 | head -3

echo "[6/6] done"
ps -ef | grep -E "next-server" | grep -v grep | head -3
