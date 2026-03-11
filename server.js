const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios'); // Add this to your package.json dependencies

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL' });
    try {
        const browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        let rawVideoLink = null;

        page.on('request', request => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                rawVideoLink = url;
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 6000)); 
        await page.mouse.click(400, 300);
        await new Promise(r => setTimeout(r, 10000)); 
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// THE NEW PROXY ROUTE
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    try {
        const response = await axios.get(streamUrl, {
            responseType: 'stream',
            headers: { 'Referer': 'https://embed.streamapi.cc/' }
        });
        res.set('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send('Proxy Error');
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
