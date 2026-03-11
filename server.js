const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    console.log("1. Request received for:", embedUrl);
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 600 });
        
        let rawVideoLink = null;

        page.on('request', request => {
            const url = request.url();
            // SMART FILTER: Catch the real stream, ignore the ads/wrapper
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                if (!rawVideoLink) {
                    rawVideoLink = url;
                    console.log("4. FOUND REAL LINK:", rawVideoLink);
                }
            }
        });

        console.log("2. Injecting Iframe into neutral page...");
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px; border:none;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 5000)); 

        console.log("3. Clearing ads with multi-clicks...");
        const clicks = [[400, 300], [410, 310], [390, 290]];
        for (const [x, y] of clicks) {
            await page.mouse.click(x, y);
            await new Promise(r => setTimeout(r, 1500));
        }
        
        // Final wait for the network to catch the .m3u8
        await new Promise(r => setTimeout(r, 8000)); 
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("ERROR:", error);
        if (browser) await browser.close();
        res.status(500).json({ success: false });
    }
});

// PROXY ROUTE: This stops the "spinning" on your HTML
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    try {
        const response = await axios.get(streamUrl, {
            responseType: 'stream',
            headers: { 
                'Referer': 'https://embed.streamapi.cc/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        res.set('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send('Proxy Error');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
