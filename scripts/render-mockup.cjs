// Render the subject-section mockup HTML to a PNG using Playwright
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const fileUrl = 'file://' + path.resolve('/home/z/my-project/scripts/subject-section-mockup.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  // Wait a tick for any animations to settle (pulse etc.)
  await page.waitForTimeout(500);

  // Measure body height and set viewport to fit
  const dims = await page.evaluate(() => {
    const b = document.body;
    return { w: b.scrollWidth, h: b.scrollHeight };
  });
  await page.setViewportSize({ width: dims.w, height: dims.h });
  await page.waitForTimeout(200);

  await page.screenshot({
    path: '/home/z/my-project/download/subject-section-plan.png',
    fullPage: true,
    type: 'png',
  });

  console.log('Saved: /home/z/my-project/download/subject-section-plan.png');
  console.log('Dimensions:', dims);
  await browser.close();
})();
