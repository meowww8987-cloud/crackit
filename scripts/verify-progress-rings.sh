#!/bin/bash
# Verify Progress Rings redesign with mock data (empty-state AND with-data).
set -e
cd /home/z/my-project

# Kill existing dev servers
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

# Start dev
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
echo "[3/6] browser opened"

agent-browser set viewport 390 2400 2>&1 | head -1

# Don't inject sessions for first screenshot — empty state
agent-browser eval "(() => {
  // Clear any prior data so we get true empty state
  localStorage.removeItem('neet-history');
  return 'cleared';
})()" 2>&1 | head -3
agent-browser reload 2>&1 | head -1
sleep 5
agent-browser eval "(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent.trim() === '') b.click(); }
  const homeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Home'));
  if (homeBtn) homeBtn.click();
  return 'home';
})()" 2>&1 | head -3
sleep 3
# Scroll down to bring Progress Rings into view
agent-browser eval "(() => {
  let y = 0;
  const interval = setInterval(() => {
    y += 300;
    window.scrollTo(0, y);
    if (y > 2000) clearInterval(interval);
  }, 80);
  return 'scrolling';
})()" 2>&1 | head -3
sleep 4
# Scroll back up so Progress Rings is in upper half of viewport
agent-browser eval "window.scrollTo(0, 350)" 2>&1 | head -3
sleep 2
agent-browser screenshot /tmp/progress-empty.png 2>&1 | head -3
echo "[4/6] empty-state screenshot saved"
ls -la /tmp/progress-empty.png

# Now inject mock sessions and screenshot again — with-data state
agent-browser eval "(() => {
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  // Yesterday: 4h (so trend is meaningful: today 3h 12m vs yesterday 4h = -20%)
  // Last week: 33h 36m (this week 42h = +25%)
  const sessions = [
    // yesterday 4h
    { id: 'y1', date: daysAgo(1), studySeconds: 14400, startedAt: Date.now()-86400000, endedAt: Date.now()-86400000+14400000, subject: 'Physics', mode: 'focus' },
    // today 3h 12m (40% of 8h goal)
    { id: 't1', date: daysAgo(0), studySeconds: 11520, startedAt: Date.now()-11520000, endedAt: Date.now(), subject: 'Botany', mode: 'focus' },
    // spread this week to total ~42h
    { id: 'w1', date: daysAgo(2), studySeconds: 18000, startedAt: Date.now()-2*86400000, endedAt: Date.now()-2*86400000+18000000, subject: 'Chemistry', mode: 'focus' }, // 5h
    { id: 'w2', date: daysAgo(3), studySeconds: 21600, startedAt: Date.now()-3*86400000, endedAt: Date.now()-3*86400000+21600000, subject: 'Zoology', mode: 'focus' }, // 6h
    { id: 'w3', date: daysAgo(4), studySeconds: 14400, startedAt: Date.now()-4*86400000, endedAt: Date.now()-4*86400000+14400000, subject: 'Physics', mode: 'focus' }, // 4h
    { id: 'w4', date: daysAgo(5), studySeconds: 10800, startedAt: Date.now()-5*86400000, endedAt: Date.now()-5*86400000+10800000, subject: 'Botany', mode: 'focus' }, // 3h
    { id: 'w5', date: daysAgo(6), studySeconds: 25200, startedAt: Date.now()-6*86400000, endedAt: Date.now()-6*86400000+25200000, subject: 'Zoology', mode: 'focus' }, // 7h
  ];
  // Also seed last-week sessions (8-13 days ago, totaling 33h 36m = 120960 sec)
  const lastWeekSessions = [
    { id: 'lw1', date: daysAgo(8), studySeconds: 14400, startedAt: Date.now()-8*86400000, endedAt: Date.now()-8*86400000+14400000, subject: 'Physics', mode: 'focus' }, // 4h
    { id: 'lw2', date: daysAgo(9), studySeconds: 18000, startedAt: Date.now()-9*86400000, endedAt: Date.now()-9*86400000+18000000, subject: 'Botany', mode: 'focus' }, // 5h
    { id: 'lw3', date: daysAgo(10), studySeconds: 10800, startedAt: Date.now()-10*86400000, endedAt: Date.now()-10*86400000+10800000, subject: 'Chemistry', mode: 'focus' }, // 3h
    { id: 'lw4', date: daysAgo(11), studySeconds: 21600, startedAt: Date.now()-11*86400000, endedAt: Date.now()-11*86400000+21600000, subject: 'Zoology', mode: 'focus' }, // 6h
    { id: 'lw5', date: daysAgo(12), studySeconds: 28800, startedAt: Date.now()-12*86400000, endedAt: Date.now()-12*86400000+28800000, subject: 'Botany', mode: 'focus' }, // 8h
    { id: 'lw6', date: daysAgo(13), studySeconds: 27360, startedAt: Date.now()-13*86400000, endedAt: Date.now()-13*86400000+27360000, subject: 'Physics', mode: 'focus' }, // 7h 36m
  ];
  localStorage.setItem('neet-history', JSON.stringify({ state: { sessions: [...sessions, ...lastWeekSessions], version: 0 }, version: 0 }));
  return 'injected ' + (sessions.length + lastWeekSessions.length) + ' sessions';
})()" 2>&1 | head -3
agent-browser reload 2>&1 | head -1
sleep 5
echo "[5/6] sessions injected"

agent-browser eval "(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent.trim() === '') b.click(); }
  const homeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Home'));
  if (homeBtn) homeBtn.click();
  return 'home';
})()" 2>&1 | head -3
sleep 3
agent-browser eval "(() => {
  let y = 0;
  const interval = setInterval(() => {
    y += 300;
    window.scrollTo(0, y);
    if (y > 2000) clearInterval(interval);
  }, 80);
  return 'scrolling';
})()" 2>&1 | head -3
sleep 4
agent-browser eval "window.scrollTo(0, 350)" 2>&1 | head -3
sleep 2
agent-browser screenshot /tmp/progress-with-data.png 2>&1 | head -3
echo "[6/6] with-data screenshot saved"
ls -la /tmp/progress-with-data.png
echo "---"
ps -ef | grep -E "next-server" | grep -v grep | head -3
