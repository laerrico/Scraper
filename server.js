const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

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

app.listen(process.env.PORT || 3000, () => console.log('Scraper Mode Live!'));
