const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    console.log("1. Scraping:", embedUrl);
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
                    console.log("4. FOUND LINK:", rawVideoLink);
                    if (!res.headersSent) res.json({ success: true, url: rawVideoLink });
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:100%; height:600px; border:none;"></iframe>`;
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

app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send('No URL');

    try {
        const response = await axios.get(streamUrl, {
            responseType: streamUrl.includes('.m3u8') ? 'text' : 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://embed.streamapi.cc/',
                'Origin': 'https://embed.streamapi.cc',
                'X-Requested-With': 'XMLHttpRequest' // Many providers look for this to allow the request
            },
            timeout: 10000
        });

        res.set('Access-Control-Allow-Origin', '*');

        if (streamUrl.includes('.m3u8')) {
            let manifest = response.data;
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
            const rewrittenManifest = manifest.replace(/^(?!#)(.*)$/gm, (match) => {
                if (!match.trim()) return match;
                let absoluteUrl = match.startsWith('http') ? match : new URL(match, baseUrl).href;
                return `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
            });
            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenManifest);
        }

        response.data.pipe(res);
    } catch (e) {
        console.error("403 Final Block:", streamUrl);
        res.status(403).send('Blocked');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
