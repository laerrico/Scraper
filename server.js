const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

app.get('/get-stream', async (req, res) => {
    const embedUrl = req.query.url;
    if (!embedUrl) return res.status(400).json({ error: 'No URL provided' });

    console.log("1. Request received for:", embedUrl);

    try {
        const browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 600 });
        
        let rawVideoLink = null;

        page.on('request', request => {
            if (request.url().includes('.m3u8')) {
                rawVideoLink = request.url();
                console.log("4. FOUND LINK:", rawVideoLink);
            }
        });

        console.log("2. Loading neutral parent page...");
        // Go to a blank dummy site first
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        
        console.log("3. Injecting embed as an iframe...");
        // Force the embed into an iframe to bypass "Direct Access" blocks
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px; border:none; position:absolute; top:0; left:0;"></iframe>`;
        }, embedUrl);

        // Wait for the iframe and video player to load
        await new Promise(r => setTimeout(r, 5000)); 

        console.log("5. Spamming clicks inside the iframe...");
        for (let i = 0; i < 3; i++) {
            await page.mouse.click(400, 300); // Clicks the play button
            await new Promise(r => setTimeout(r, 1500));
        }
        
        await new Promise(r => setTimeout(r, 5000)); 
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("ERROR:", error); 
        res.status(500).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
