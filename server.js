const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    console.log("1. Request received");
    try {
        const browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        let rawVideoLink = null;

        page.on('request', request => {
            const url = request.url();
            
            // SMART FILTER: Only grab links that look like real video data
            // We ignore ads, streamapi.cc, and typical tracking domains
            if (url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) {
                if (!url.includes('ads') && !url.includes('analytics') && !url.includes('streamapi.cc')) {
                    rawVideoLink = url;
                    console.log("!!! FOUND REAL VIDEO LINK:", rawVideoLink);
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        
        console.log("3. Injecting Iframe...");
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 5000)); 

        console.log("5. Clearing Ad Layers...");
        // Triple-click pattern to punch through invisible ad overlays
        const clicks = [[400, 300], [405, 305], [395, 295]];
        for (const [x, y] of clicks) {
            await page.mouse.click(x, y);
            await new Promise(r => setTimeout(r, 1500));
        }
        
        // IMPORTANT: Wait up to 10 seconds for the actual stream to manifest
        console.log("Waiting for video data...");
        await new Promise(r => setTimeout(r, 10000)); 
        
        await browser.close();
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
