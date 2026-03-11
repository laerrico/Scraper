const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    console.log("--- New Scraping Request ---");
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        let foundLink = null;

        // Listen to all network requests
        page.on('request', request => {
            const url = request.url();
            // Look for m3u8 or the specific provider domain
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                if (!foundLink) {
                    foundLink = url;
                    console.log("!!! TARGET DETECTED:", foundLink);
                }
            }
        });

        console.log("Navigating to target...");
        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait an extra 10 seconds for the video to actually fire up
        await new Promise(r => setTimeout(r, 10000));

        await browser.close();

        if (foundLink) {
            res.json({ success: true, url: foundLink });
        } else {
            console.log("--- Failed: No link captured ---");
            res.json({ success: false });
        }

    } catch (error) {
        console.error("Scraper Crash:", error.message);
        if (browser) await browser.close();
        res.status(500).json({ success: false });
    }
});

// Proxy route stays the same
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
