const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const filePath = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  console.log("Loading " + filePath);
  await page.goto(filePath, { waitUntil: 'networkidle0' });

  let testsPassed = 0;
  let testsFailed = 0;

  async function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${message}`);
      testsFailed++;
      await page.screenshot({ path: `fail_${Date.now()}.png` });
    }
  }

  try {
    // 1. Initial State
    const title = await page.title();
    await assert(title.includes("Mai-Reads"), "Title contains Mai-Reads");
    
    const welcomeVisible = await page.$eval('#welcome', el => !el.classList.contains('hidden'));
    await assert(welcomeVisible, "Welcome screen is visible initially");

    // 2. Theme Toggle
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'system');
    await page.click('#theme-toggle');
    const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await assert(initialTheme !== newTheme, `Theme toggled from ${initialTheme} to ${newTheme}`);

    // 3. History Panel
    await page.click('#history-toggle-welcome');
    // wait for animation/class
    await new Promise(r => setTimeout(r, 100));
    const historyAria = await page.$eval('#history-panel', el => el.getAttribute('aria-hidden'));
    await assert(historyAria === 'false', "History panel opened (aria-hidden=false)");

    // Close History Panel
    await page.click('#history-backdrop');
    await new Promise(r => setTimeout(r, 100));
    const historyAriaClosed = await page.$eval('#history-panel', el => el.getAttribute('aria-hidden'));
    await assert(historyAriaClosed === 'true', "History panel closed by clicking backdrop");

    // 4. Footer link (button)
    const footerBtnExists = await page.$eval('#studio-link-btn', el => el !== null);
    await assert(footerBtnExists, "Studio link button exists in the footer");
    
    // 5. Test Zoom Event Registration
    const zoomInputExists = await page.$eval('#zoom', el => el !== null);
    await assert(zoomInputExists, "Zoom input exists in reader controls");

  } catch (err) {
    console.error("[ERROR] Test script crashed:", err);
  } finally {
    console.log(`\nTests completed. Passed: ${testsPassed}, Failed: ${testsFailed}`);
    await browser.close();
  }
})();
