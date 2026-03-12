const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());

const SPOOF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://strmd.top/',
    'Origin': 'https://strmd.top',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
};

app.get('/ping', (req, res) => res.json({ ok: true }));

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent(SPOOF_HEADERS['User-Agent']);

        let rawVideoLink = null;

        page.on('request', request => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                if (!rawVideoLink) {
                    rawVideoLink = url;
                    res.json({ success: true, url: rawVideoLink });
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:1px; height:1px;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 8000));
        await page.mouse.click(0, 0);

        setTimeout(async () => { if (browser) await browser.close(); }, 12000);

    } catch (e) {
        if (browser) await browser.close();
        if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/proxy-manifest', async (req, res) => {
    const manifestUrl = req.query.url;
    if (!manifestUrl) return res.status(400).send('No URL');

    try {
        const response = await axios.get(manifestUrl, {
            headers: SPOOF_HEADERS,
            timeout: 10000,
        });

        const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
        let manifest = response.data;

        // Rewrite relative .ts segments to absolute URLs (browser fetches these directly)
        manifest = manifest.replace(/^(?!#)(.+\.ts.*)$/gm, m => m.startsWith('http') ? m : baseUrl + m);
        manifest = manifest.replace(/^(?!#)(.+\.aac.*)$/gm, m => m.startsWith('http') ? m : baseUrl + m);

        // Proxy any sub-playlists (e.g. quality variants) through this server
        manifest = manifest.replace(/^(https?:\/\/.+\.m3u8.*)$/gm, m =>
            `/proxy-manifest?url=${encodeURIComponent(m)}`
        );
        // Also handle relative .m3u8 references
        manifest = manifest.replace(/^(?!#)(.+\.m3u8.*)$/gm, m => {
            if (m.startsWith('/proxy-manifest')) return m;
            const abs = m.startsWith('http') ? m : baseUrl + m;
            return `/proxy-manifest?url=${encodeURIComponent(abs)}`;
        });

        res.set({
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
        });
        res.send(manifest);

    } catch (e) {
        console.error('Manifest proxy error:', e.message);
        res.status(502).send('Upstream error');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Scraper Live'));
