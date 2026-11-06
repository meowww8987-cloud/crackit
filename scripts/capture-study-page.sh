#!/bin/bash
# Capture Study page screenshots in one shot (dev server dies between calls).
set -e
cd /home/z/my-project

pkill -f "next" 2>/dev/null || true
sleep 2

nohup bash -c 'exec node node_modules/next/dist/bin/next dev -p 3000 > /tmp/next-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
echo "[1/4] dev started"
sleep 4
for i in 1 2 3 4 5; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 http://localhost:3000/)
  if [ "$HTTP" = "200" ]; then echo "[2/4] warmup 200"; break; fi
  sleep 2
done

agent-browser open http://localhost:3000/ 2>&1 | head -2
sleep 4
agent-browser set viewport 390 844 2>&1 | head -1
echo "[3/4] browser opened"

# Inject targets with valid schema
agent-browser eval "(() => {
  const today = new Date();
  const todayKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  const targets = [
    { id: 't1', date: todayKey, subject: 'Physics', activity: 'Lecture', chapter: 'Mechanics', lecture: 'L1', topic: 'Newton First Law', expectedMinutes: 60, order: 0, done: false, createdAt: Date.now() },
    { id: 't2', date: todayKey, subject: 'Physics', activity: 'DPP', chapter: 'Mechanics', lecture: 'L1', topic: 'Newton First Law DPP', expectedMinutes: 30, order: 1, done: true, createdAt: Date.now()+1 },
    { id: 't3', date: todayKey, subject: 'Physics', activity: 'Lecture', chapter: 'Mechanics', lecture: 'L2', topic: 'Newton Second Law', expectedMinutes: 60, order: 2, done: false, createdAt: Date.now()+2 },
    { id: 't4', date: todayKey, subject: 'Botany', activity: 'Lecture', chapter: 'Plant Physiology', lecture: 'L1', topic: 'Photosynthesis', expectedMinutes: 60, order: 3, done: false, createdAt: Date.now()+3 },
    { id: 't5', date: todayKey, subject: 'Botany', activity: 'Notes', chapter: 'Plant Physiology', lecture: 'L1', topic: 'Photosynthesis Notes', expectedMinutes: 30, order: 4, done: false, createdAt: Date.now()+4 },
    { id: 't6', date: todayKey, subject: 'Chemistry', activity: 'Lecture', chapter: 'Organic Chemistry', lecture: 'L1', topic: 'GOC Basics', expectedMinutes: 75, order: 5, done: true, createdAt: Date.now()+5 },
  ];
  localStorage.setItem('neet-targets', JSON.stringify({ state: { byDate: { [todayKey]: targets }, version: 0 }, version: 0 }));
  return 'injected';
})()" 2>&1 | head -3
agent-browser reload 2>&1 | head -1
sleep 6

# Click Study tab
agent-browser eval "(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent.trim() === '') b.click(); }
  const studyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Study'));
  if (studyBtn) studyBtn.click();
  return 'study';
})()" 2>&1 | head -3
sleep 4

# Check page state
agent-browser eval "(() => {
  return JSON.stringify({
    title: document.title,
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.slice(0, 80)).slice(0, 8),
    bodyLen: document.body.textContent.length,
  });
})()" 2>&1 | head -3

# Take screenshots at different positions
agent-browser screenshot /tmp/study-top.png 2>&1 | head -1
sleep 1
agent-browser eval "window.scrollTo(0, 350)" > /dev/null 2>&1
sleep 2
agent-browser screenshot /tmp/study-mid1.png 2>&1 | head -1
agent-browser eval "window.scrollTo(0, 700)" > /dev/null 2>&1
sleep 2
agent-browser screenshot /tmp/study-mid2.png 2>&1 | head -1
agent-browser eval "window.scrollTo(0, 1100)" > /dev/null 2>&1
sleep 2
agent-browser screenshot /tmp/study-bottom.png 2>&1 | head -1
echo "[4/4] screenshots saved"
ls -la /tmp/study-*.png
