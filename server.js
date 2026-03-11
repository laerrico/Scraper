const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL provided' });

    try {
        const browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        let rawVideoLink = null;

        page.on('request', request => {
            if (request.url().includes('.m3u8')) rawVideoLink = request.url();
        });

        await page.goto(embedUrl, { waitUntil: 'networkidle2' });
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Scraper failed' });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server is Live!'));
