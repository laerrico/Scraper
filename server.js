const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

// --- SCRAPER: Finds the hidden link ---
app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    console.log("1. Scraping:", embedUrl);
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        let rawVideoLink = null;

        page.on('request', request => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                if (!rawVideoLink) {
                    rawVideoLink = url;
                    console.log("4. FOUND LINK:", rawVideoLink);
                    if (!res.headersSent) res.json({ success: true, url: rawVideoLink });
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px; border:none;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 6000)); 
        await page.mouse.click(400, 300); 
        
        setTimeout(async () => { 
            if (browser) await browser.close(); 
            if (!rawVideoLink && !res.headersSent) res.json({ success: false });
        }, 15000);
    } catch (e) {
        if (browser) await browser.close();
        if (!res.headersSent) res.status(500).json({ success: false });
    }
});

// --- PROXY: Bypasses 403 blocks ---
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send('No URL');

    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://embed.streamapi.cc/',
        'Origin': 'https://embed.streamapi.cc',
        'Accept': '*/*',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Dest': 'empty'
    };

    try {
        const isManifest = streamUrl.includes('.m3u8');
        const response = await axios.get(streamUrl, {
            responseType: isManifest ? 'text' : 'stream',
            headers: browserHeaders,
            timeout: 15000
        });

        res.set('Access-Control-Allow-Origin', '*');

        if (isManifest) {
            let manifest = response.data;
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);

            // REWRITE LOGIC: Forces every sub-link through this proxy
            const rewrittenManifest = manifest.replace(/^(?!#)(.*)$/gm, (match) => {
                if (!match.trim()) return match;
                let absoluteUrl = match.startsWith('http') ? match : new URL(match, baseUrl).href;
                return `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
            });

            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenManifest);
        }

        // Handle video segments (.ts)
        res.set('Content-Type', 'video/MP2T');
        response.data.pipe(res);

    } catch (e) {
        console.error("403 Blocked by Provider:", streamUrl);
        res.status(403).send('Access Denied by Stream Provider');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
