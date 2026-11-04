// Render the CurrentBlockCard mockup HTML to a PNG using Playwright
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1320, height: 1800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const fileUrl = 'file://' + path.resolve('/home/z/my-project/scripts/block-card-mockup.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const dims = await page.evaluate(() => {
    const b = document.body;
    return { w: b.scrollWidth, h: b.scrollHeight };
  });
  await page.setViewportSize({ width: dims.w, height: dims.h });
  await page.waitForTimeout(200);

  await page.screenshot({
    path: '/home/z/my-project/download/block-card-plan.png',
    fullPage: true,
    type: 'png',
  });

  console.log('Saved: /home/z/my-project/download/block-card-plan.png');
  console.log('Dimensions:', dims);
  await browser.close();
})();
