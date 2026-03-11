const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
    const browser = await chromium.launch({ headless: false }); // Open visually!
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    console.log("Navigating to local dev server...");
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000); // Wait for load

    const outputDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // 1. Check Chapter 1 (OOP & LLD)
    console.log("Checking Chapter 1...");
    // Just click the title in the nav-item
    await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.nav-item-label'));
        const target = items.find(el => el.textContent.includes('Object-Oriented Programming'));
        if(target) target.click();
    });
    
    await page.waitForTimeout(1500);
    // Scroll down to see the code examples (at the bottom of ch1)
    await page.evaluate(() => window.scrollBy(0, 3500));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'ch1_examples.png') });
    await page.waitForTimeout(1000);

    // 2. Check Chapter 4 (Load Balancing) to see limitations
    console.log("Checking Chapter 4...");
    await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.nav-item-label'));
        const target = items.find(el => el.textContent.includes('Load Balancing'));
        if(target) target.click();
    });
    await page.waitForTimeout(1500);
    // Scroll to see limitations
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.screenshot({ path: path.join(outputDir, 'ch4_limitations.png') });
    await page.waitForTimeout(1000);

    console.log(`Success! Screenshots saved to ${outputDir}`);
    // Keep browser open for 10 seconds so you can see it
    await page.waitForTimeout(10000);
    
    await browser.close();
}

run().catch(console.error);
