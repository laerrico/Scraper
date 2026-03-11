const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL provided' });

    console.log("1. Request received for:", embedUrl);

    try {
        console.log("2. Launching browser...");
        const browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 600 });
        let rawVideoLink = null;

        page.on('request', request => {
            if (request.url().includes('.m3u8')) {
                rawVideoLink = request.url();
                console.log("4. FOUND LINK:", rawVideoLink);
            }
        });

        console.log("5. Navigating to embed URL...");
        await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait 3 seconds for the player UI to actually render
        await new Promise(r => setTimeout(r, 3000)); 
        console.log("Page Title is:", await page.title());

        console.log("6. Spamming clicks to bypass invisible ads...");
        for (let i = 0; i < 3; i++) {
            await page.mouse.click(400, 300); // Click center
            await new Promise(r => setTimeout(r, 1500)); // Wait for ad to trigger
        }
        
        // Wait 6 seconds for the actual video stream to fire up
        await new Promise(r => setTimeout(r, 6000)); 
        
        console.log("7. Closing browser...");
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("CRITICAL ERROR:", error); 
        res.status(500).json({ success: false, error: 'Scraper failed' });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server is Live!'));
