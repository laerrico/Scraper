const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

// --- SCRAPER ---
app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    console.log("Scraping for:", embedUrl);
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        let rawVideoLink = null;
        page.on('request', request => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                if (!rawVideoLink) {
                    rawVideoLink = url;
                    console.log("FOUND RAW LINK:", rawVideoLink);
                    if (!res.headersSent) res.json({ success: true, url: rawVideoLink });
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:1px; height:1px;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 8000)); 
        await page.mouse.click(0, 0); 
        
        setTimeout(async () => { 
            if (browser) await browser.close(); 
            if (!rawVideoLink && !res.headersSent) res.json({ success: false });
        }, 12000);
    } catch (e) {
        if (browser) await browser.close();
        if (!res.headersSent) res.status(500).json({ success: false });
    }
});

// --- DEEP PROXY ---
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send('No URL');

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://embed.streamapi.cc/',
        'Origin': 'https://embed.streamapi.cc'
    };

    try {
        const isManifest = streamUrl.includes('.m3u8');
        const response = await axios.get(streamUrl, {
            responseType: isManifest ? 'text' : 'stream',
            headers: headers,
            timeout: 10000
        });

        res.set('Access-Control-Allow-Origin', '*');

        if (isManifest) {
            let manifest = response.data;
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
            
            // This is the magic: Rewrite all internal links to go back through this proxy
            const rewritten = manifest.replace(/^(?!#)(.*)$/gm, (match) => {
                if (!match.trim()) return match;
                let absoluteUrl = match.startsWith('http') ? match : new URL(match, baseUrl).href;
                return `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
            });

            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewritten);
        }

        // For video segments (.ts)
        res.set('Content-Type', 'video/MP2T');
        response.data.pipe(res);

    } catch (e) {
        res.status(403).send('Proxy Error');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Deep Proxy Live!'));
