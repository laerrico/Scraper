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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 800, height: 600 });
        
        // THE MAGIC FIX: Fake the website we "came from"
        await page.setExtraHTTPHeaders({ 
            'Referer': 'https://google.com/',
            'Origin': 'https://google.com/'
        });

        let rawVideoLink = null;

        page.on('request', request => {
            if (request.url().includes('.m3u8')) {
                rawVideoLink = request.url();
                console.log("4. FOUND LINK:", rawVideoLink);
            }
        });

        console.log("5. Navigating to embed URL...");
        await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await new Promise(r => setTimeout(r, 3000)); 
        console.log("Page Title is:", await page.title());
        
        console.log("6. Spamming clicks...");
        for (let i = 0; i < 3; i++) {
            await page.mouse.click(400, 300);
            await new Promise(r => setTimeout(r, 1500));
        }
        
        await new Promise(r => setTimeout(r, 6000)); 
        
        console.log("7. Closing browser...");
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("CRITICAL ERROR:", error); 
        res.status(500).json({ success: false, error: 'Scraper failed' });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
