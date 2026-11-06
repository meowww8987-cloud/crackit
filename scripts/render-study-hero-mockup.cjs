// Render the Study hero mockup HTML to a PNG with Playwright.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const url = 'file://' + path.resolve(__dirname, 'study-hero-mockup.html');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.resolve(__dirname, '..', 'download', 'study-hero-plan.png'),
    fullPage: true,
  });
  await browser.close();
  console.log('Saved: download/study-hero-plan.png');
})();
