const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
        });
        const page = await browser.newPage();
        
        // Disguise as a real browser to prevent "Direct Access" blocks
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        let found = false;
        
        // INTERCEPT REQUESTS IMMEDIATELY
        page.on('request', request => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                if (!found) {
                    found = true;
                    console.log("!!! TARGET FOUND:", url);
                    res.json({ success: true, url: url });
                    browser.close(); // Close immediately to save time
                }
            }
        });

        await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Simulate a click just in case it's needed to trigger the network
        await page.mouse.click(400, 300);
        
        // Fallback timer if nothing is found
        setTimeout(async () => {
            if (!found) {
                await browser.close();
                res.json({ success: false });
            }
        }, 15000);

    } catch (error) {
        if (browser) await browser.close();
        res.status(500).json({ success: false });
    }
});

app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    try {
        const response = await axios.get(streamUrl, {
            responseType: 'stream',
            headers: { 'Referer': 'https://embed.streamapi.cc/', 'User-Agent': 'Mozilla/5.0' }
        });
        res.set('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send('Proxy Error');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
