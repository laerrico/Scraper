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
            // IGNORE the embed page itself, look for the actual video files
            if ((url.includes('.m3u8') || url.includes('sanwalyaarpya.com')) && !url.includes('streamapi.cc')) {
                rawVideoLink = url;
                console.log("4. REAL VIDEO LINK FOUND:", rawVideoLink);
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        
        console.log("3. Injecting Iframe...");
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px;"></iframe>`;
        }, embedUrl);

        // Give the spinner time to load the player
        await new Promise(r => setTimeout(r, 6000)); 

        console.log("5. Clicking Play...");
        // Click multiple spots to clear ads
        await page.mouse.click(400, 300);
        await new Promise(r => setTimeout(r, 2000));
        await page.mouse.click(400, 300);
        
        // Wait for the stream to actually start
        await new Promise(r => setTimeout(r, 8000)); 
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
