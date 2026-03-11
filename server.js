const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

// --- SCRAPER ROUTE ---
app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    console.log("1. Scraping:", embedUrl);
    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        let rawVideoLink = null;

        page.on('request', request => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                if (!rawVideoLink) {
                    rawVideoLink = url;
                    console.log("4. FOUND LINK:", rawVideoLink);
                    res.json({ success: true, url: rawVideoLink });
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px;"></iframe>`;
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

// --- THE SMART RECURSIVE PROXY ---
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send('No URL');

    try {
        const response = await axios.get(streamUrl, {
            responseType: streamUrl.includes('.m3u8') ? 'text' : 'stream',
            headers: { 
                'Referer': 'https://embed.streamapi.cc/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        res.set('Access-Control-Allow-Origin', '*');

        // If it's a playlist (.m3u8), we need to REWRITE it
        if (streamUrl.includes('.m3u8')) {
            let manifest = response.data;
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);

            // This regex finds every link in the manifest and wraps it in our proxy
            const rewrittenManifest = manifest.replace(/^(?!#)(.*)$/gm, (match) => {
                if (!match.trim()) return match;
                let absoluteUrl = match.startsWith('http') ? match : new URL(match, baseUrl).href;
                return `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
            });

            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenManifest);
        }

        // If it's a video segment (.ts), just pipe the data
        res.set('Content-Type', 'video/MP2T');
        response.data.pipe(res);

    } catch (e) {
        console.error("Proxy Error:", e.message);
        res.status(500).send('Proxy Error');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
