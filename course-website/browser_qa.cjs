const puppeteer = require('puppeteer');

(async () => {
    console.log("🚀 Starting Deep Interaction Headless Browser QA Loop...");
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        let errorCount = 0;
        let warningCount = 0;
        let errorMessages = new Set();
        
        page.on('pageerror', error => {
            console.error(`❌ [BROWSER EXCEPTION] ${error.message}`);
            errorMessages.add(error.message);
            errorCount++;
        });

        page.on('console', msg => {
            if (msg.type() === 'error') {
                if (!msg.text().includes('favicon') && !msg.text().includes('ERR_CONNECTION_REFUSED')) {
                    console.error(`❌ [CONSOLE ERROR] ${msg.text()}`);
                    errorMessages.add(msg.text());
                    errorCount++;
                }
            } else if (msg.type() === 'warning') {
                warningCount++;
            }
        });

        console.log("🌐 Navigating to local curriculum server at http://localhost:5175/");
        await page.goto('http://localhost:5175/', { waitUntil: 'networkidle0', timeout: 30000 });
        
        await page.waitForSelector('.nav-item', { timeout: 10000 });

        // Get all clickable chapter elements
        const chapterElements = await page.$$('.nav-item');
        console.log(`✅ Found ${chapterElements.length} chapters. Initiating click stress test...`);
        
        for (let i = 0; i < chapterElements.length; i++) {
            try {
                // Have to re-query the elements each time in case the DOM re-rendered or unmounted
                const elements = await page.$$('.nav-item');
                if (elements[i]) {
                    await elements[i].click();
                    // Wait a moment for React to render the new active document content
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (e) {
                console.warn(`⚠️ Could not click chapter index ${i}: ${e.message}`);
            }
        }
        
        // Wait an extra 2 seconds to ensure final renderings complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (errorCount > 0) {
            console.error(`❌ [QA FAILURE] The Interaction QA detected ${errorCount} JavaScript exceptions during navigation.`);
            console.log("\\n--- UNIQUE ERROR LOG SUMMARY ---");
            errorMessages.forEach(msg => console.log(msg));
            process.exit(1);
        } else {
            console.log(`✅ [QA SUCCESS] Zero JavaScript exceptions detected after clicking all chapters. Frontend is solid.`);
            process.exit(0);
        }
        
    } catch (err) {
        console.error("❌ [FATAL QA ERROR]", err);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
