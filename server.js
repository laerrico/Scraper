const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const app = express();
app.use(cors());

// Health check so Render doesn't spin down & frontend can ping it
app.get('/ping', (req, res) => res.json({ ok: true }));

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL provided' });

    console.log("🔍 Scraping for:", embedUrl);
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--autoplay-policy=no-user-gesture-required'
            ]
        });

        const page = await browser.newPage();

        // Pretend to be a real Chrome browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        // Allow all resource types so the video player JS runs
        await page.setRequestInterception(false);

        let rawVideoLink = null;

        // Listen to ALL network requests - cast a wide net for m3u8
        const client = await page.createCDPSession();
        await client.send('Network.enable');

        client.on('Network.requestWillBeSent', ({ request }) => {
            const url = request.url;
            if (
                !rawVideoLink &&
                (url.includes('.m3u8') || url.includes('index.m3u8') || url.includes('/hls/') || url.includes('/live/'))
                && !url.startsWith('data:')
            ) {
                rawVideoLink = url;
                console.log("✅ FOUND M3U8:", rawVideoLink);
                if (!res.headersSent) {
                    res.json({ success: true, url: rawVideoLink });
                }
            }
        });

        // Navigate DIRECTLY to the embed URL (not example.com first!)
        await page.goto(embedUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        // Simulate user interaction - some players require a click to start
        await new Promise(r => setTimeout(r, 3000));
        try {
            // Click the center of the page (play button area)
            const viewport = page.viewport();
            await page.mouse.click(viewport.width / 2, viewport.height / 2);
        } catch (_) {}

        // Wait up to 12 seconds total for an m3u8 to appear
        await new Promise(r => setTimeout(r, 9000));

        if (!rawVideoLink && !res.headersSent) {
            console.log("❌ No m3u8 found after timeout");
            res.json({ success: false, error: 'No stream URL found' });
        }

    } catch (e) {
        console.error("Scraper error:", e.message);
        if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Scraper live on port ${PORT}`));
