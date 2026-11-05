#!/bin/bash
# One-shot: start dev, warmup, open browser, inject mock sessions, screenshot
set -e

cd /home/z/my-project

# Kill any existing dev servers
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

# Start dev server
nohup bash -c 'exec node node_modules/next/dist/bin/next dev -p 3000 > /tmp/next-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
echo "[1/6] dev server started"

# Wait + warmup (forces compile)
sleep 4
for i in 1 2 3 4 5; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 http://localhost:3000/)
  if [ "$HTTP" = "200" ]; then
    echo "[2/6] warmup HTTP 200 (attempt $i)"
    break
  fi
  sleep 2
done

# Open browser
agent-browser open http://localhost:3000/ 2>&1 | head -2
sleep 4
echo "[3/6] browser opened"

# Set tall viewport
agent-browser set viewport 390 2400 2>&1 | head -1

# Inject mock sessions
agent-browser eval "(() => {
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  const sessions = [
    { id: 's1', date: daysAgo(6), studySeconds: 5400, startedAt: Date.now()-6*86400000, endedAt: Date.now()-6*86400000+5400000, subject: 'Physics', mode: 'focus' },
    { id: 's3', date: daysAgo(4), studySeconds: 10800, startedAt: Date.now()-4*86400000, endedAt: Date.now()-4*86400000+10800000, subject: 'Botany', mode: 'focus' },
    { id: 's4', date: daysAgo(3), studySeconds: 23400, startedAt: Date.now()-3*86400000, endedAt: Date.now()-3*86400000+23400000, subject: 'Zoology', mode: 'focus' },
    { id: 's5', date: daysAgo(2), studySeconds: 7200, startedAt: Date.now()-2*86400000, endedAt: Date.now()-2*86400000+7200000, subject: 'Chemistry', mode: 'focus' },
    { id: 's6', date: daysAgo(1), studySeconds: 1800, startedAt: Date.now()-86400000, endedAt: Date.now()-86400000+1800000, subject: 'Physics', mode: 'focus' },
    { id: 's7', date: daysAgo(0), studySeconds: 2700, startedAt: Date.now()-2700000, endedAt: Date.now(), subject: 'Botany', mode: 'focus' },
  ];
  localStorage.setItem('neet-history', JSON.stringify({ state: { sessions: sessions, version: 0 }, version: 0 }));
  return 'injected ' + sessions.length + ', sample date: ' + daysAgo(0);
})()" 2>&1 | head -3
echo "[4/6] sessions injected"

# Reload to apply injected data
agent-browser reload 2>&1 | head -1
sleep 6

# Click Home tab + close dev banner
agent-browser eval "(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent.trim() === '') b.click(); }
  const homeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Home'));
  if (homeBtn) homeBtn.click();
  return 'home clicked';
})()" 2>&1 | head -3
echo "[5/6] home tab activated"

# Stepwise scroll to trigger whileInView animations
agent-browser eval "(() => {
  let y = 0;
  const interval = setInterval(() => {
    y += 300;
    window.scrollTo(0, y);
    if (y > 5000) clearInterval(interval);
  }, 80);
  return 'scrolling';
})()" 2>&1 | head -3
sleep 6

# Take full page screenshot
agent-browser screenshot /tmp/home-journey-verify.png --full 2>&1 | head -3
echo "[6/6] screenshot saved"
ls -la /tmp/home-journey-verify.png
echo "---"
ps -ef | grep -E "next-server" | grep -v grep | head -3
