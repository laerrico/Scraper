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
        
        console.log("3. Browser launched! Opening page...");
        const page = await browser.newPage();
        
        // Lock the screen size so we know exactly where the center is
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
        
        console.log("6. Clicking Play and waiting for video to load...");
        await page.mouse.click(400, 300); // Clicks dead center of the player
        await new Promise(r => setTimeout(r, 6000)); // Waits 6 seconds for the stream to pop up
        
        console.log("7. Closing browser...");
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("CRITICAL SCRAPER ERROR:", error); 
        res.status(500).json({ success: false, error: 'Scraper failed' });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server is Live!'));
