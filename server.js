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

        await new Promise(r => setTimeout(r, 5000)); 
        await page.mouse.click(400, 300); // Trigger clicks
        
        setTimeout(async () => { 
            if (browser) await browser.close(); 
            if (!rawVideoLink) res.json({ success: false });
        }, 15000);
    } catch (e) {
        if (browser) await browser.close();
        res.status(500).json({ success: false });
    }
});

// --- SMART PROXY ROUTE ---
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send('No URL');

    try {
        const response = await axios.get(streamUrl, {
            headers: { 
                'Referer': 'https://embed.streamapi.cc/',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        let data = response.data;

        // If it's a playlist file, rewrite URLs to route through this proxy
        if (typeof data === 'string' && data.includes('#EXTM3U')) {
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
            
            // Rewrite relative links to absolute links through our proxy
            data = data.replace(/^(?!http|#)(.*)$/gm, (match) => {
                const absoluteUrl = match.startsWith('/') ? new URL(match, streamUrl).href : baseUrl + match;
                return `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
            });
        }

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', streamUrl.includes('m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T');
        res.send(data);
    } catch (e) {
        res.status(500).send('Proxy Error');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
