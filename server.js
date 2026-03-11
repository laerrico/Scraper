const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });

    console.log("Scraping for link...");
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        let rawVideoLink = null;

        page.on('request', request => {
            const url = request.url();
            // We search for the real m3u8 link
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
            document.body.innerHTML = `<iframe src="${url}" style="width:1px; height:1px; visibility:hidden;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 8000)); 
        await page.mouse.click(0, 0); // Trigger network activity
        
        setTimeout(async () => { 
            if (browser) await browser.close(); 
            if (!rawVideoLink && !res.headersSent) res.json({ success: false });
        }, 12000);
    } catch (e) {
        if (browser) await browser.close();
        if (!res.headersSent) res.status(500).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Scraper Only Mode Live!'));
