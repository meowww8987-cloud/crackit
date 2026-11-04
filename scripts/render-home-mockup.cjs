// Render the Home Daily Vitals mockup HTML to a PNG using Playwright
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const fileUrl = 'file://' + path.resolve('/home/z/my-project/scripts/home-vitals-mockup.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const dims = await page.evaluate(() => {
    const b = document.body;
    return { w: b.scrollWidth, h: b.scrollHeight };
  });
  await page.setViewportSize({ width: dims.w, height: dims.h });
  await page.waitForTimeout(200);

  await page.screenshot({
    path: '/home/z/my-project/download/home-vitals-plan.png',
    fullPage: true,
    type: 'png',
  });

  console.log('Saved: /home/z/my-project/download/home-vitals-plan.png');
  console.log('Dimensions:', dims);
  await browser.close();
})();
