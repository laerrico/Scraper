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
            // Listen for the m3u8 or the specific provider domain
            if (url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) {
                if (!url.includes('streamapi.cc')) { // Ignore the wrapper
                    rawVideoLink = url;
                    console.log("4. REAL VIDEO LINK FOUND:", rawVideoLink);
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        
        console.log("3. Injecting Iframe...");
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe id="stream-frame" src="${url}" style="width:800px; height:600px;"></iframe>`;
        }, embedUrl);

        // Wait for the iframe to appear
        await page.waitForSelector('#stream-frame');
        const frameElement = await page.$('#stream-frame');
        const frame = await frameElement.contentFrame();

        console.log("5. Waiting for player and clicking INSIDE iframe...");
        await new Promise(r => setTimeout(r, 5000)); 

        // We click the frame's coordinates, not the page's
        await frame.mouse.click(400, 300); 
        await new Promise(r => setTimeout(r, 2000));
        await frame.mouse.click(400, 300);
        
        // Give it 10 seconds to fire off the network request
        await new Promise(r => setTimeout(r, 10000)); 
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
