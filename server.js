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

        // Catch broader stream patterns
        page.on('request', request => {
            const url = request.url();
            // Look for m3u8, fragments, or the specific provider domain you saw
            if (url.includes('.m3u8') || url.includes('sanwalyaarpya.com') || url.includes('stream')) {
                if (!rawVideoLink) {
                    rawVideoLink = url;
                    console.log("4. FOUND POTENTIAL LINK:", rawVideoLink);
                }
            }
        });

        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        
        console.log("3. Injecting Iframe...");
        await page.evaluate((url) => {
            document.body.innerHTML = `<iframe src="${url}" style="width:800px; height:600px;"></iframe>`;
        }, embedUrl);

        await new Promise(r => setTimeout(r, 4000)); 

        console.log("5. Clicking Play...");
        // Click center, then slightly off-center to clear multiple ad layers
        const clicks = [[400, 300], [410, 310], [390, 290]];
        for (const [x, y] of clicks) {
            await page.mouse.click(x, y);
            await new Promise(r => setTimeout(r, 2000));
        }
        
        // Final wait to ensure the stream starts
        await new Promise(r => setTimeout(r, 4000)); 
        await browser.close();
        
        res.json({ success: !!rawVideoLink, url: rawVideoLink });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server Live!'));
