const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const URL = require('url-parse');

class WebsiteCloner {
    constructor() {
        this.downloadedAssets = new Set();
        this.assetMap = new Map();
    }

    /**
     * Main function to clone a website
     * @param {string} url - The URL to clone
     * @param {string} outputDir - Output directory
     * @param {Object} hotelData - Hotel data to inject
     * @returns {Promise<string>} - Path to the cloned site
     */
    async cloneSite(url, outputDir, hotelData = {}) {
        try {
            console.log(`🚀 Starting to clone: ${url}`);
            
            // Ensure output directory exists
            await fs.ensureDir(outputDir);
            
            // Create asset directories
            const assetDirs = ['css', 'js', 'images'];
            for (const dir of assetDirs) {
                await fs.ensureDir(path.join(outputDir, dir));
            }

            // Get HTML content (try static first, then dynamic)
            let html = await this.getStaticHTML(url);
            let isFallback = false;
            
            if (!html) {
                console.log('📄 Static HTML failed, trying dynamic rendering...');
                html = await this.getDynamicHTML(url);
            }

            if (!html) {
                console.log('⚠️ Failed to fetch HTML content, creating fallback website...');
                html = this.createFallbackHTML(hotelData);
                isFallback = true;
            }

            // Parse HTML with cheerio - preserve original structure
            const $ = cheerio.load(html, {
                decodeEntities: false,
                xmlMode: false,
                recognizeSelfClosing: true,
                lowerCaseTags: false,
                lowerCaseAttributeNames: false
            });
            
            if (!isFallback) {
                // Download and process assets only for real websites
                await this.processAssets($, url, outputDir);
                
                // Inject hotel data
                this.injectHotelData($, hotelData);
            }
            
            // Save the final HTML - preserve original structure
            let finalHTML = $.html();
            
            console.log('🔧 Preserving original HTML structure...');
            
            // Only fix basic issues, don't restructure the HTML
            // Clean up encoding issues that might break the HTML
            finalHTML = finalHTML.replace(/\\u0027/g, "'");
            finalHTML = finalHTML.replace(/\\u002b/g, "+");
            finalHTML = finalHTML.replace(/\\u0026/g, "&");
            finalHTML = finalHTML.replace(/\\"/g, '"');
            finalHTML = finalHTML.replace(/\\n/g, '\n');
            finalHTML = finalHTML.replace(/\\t/g, '\t');
            
            // Ensure we have a proper DOCTYPE
            if (!finalHTML.includes('<!DOCTYPE html>')) {
                finalHTML = `<!DOCTYPE html>\n${finalHTML}`;
            }
            
            // Don't restructure the HTML - keep it as close to original as possible
            console.log('📄 Original HTML structure preserved');
            
            console.log('📄 Saving HTML file...');
            console.log('📄 HTML length:', finalHTML.length);
            console.log('📄 First 500 chars:', finalHTML.substring(0, 500));
            
            await fs.writeFile(path.join(outputDir, 'index.html'), finalHTML, 'utf8');
            
            // Verify the file was saved correctly
            const savedContent = await fs.readFile(path.join(outputDir, 'index.html'), 'utf8');
            console.log('📄 File saved successfully, length:', savedContent.length);
            
            // Create a simple test file to verify serving works
            const testHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        h1 { color: blue; }
        .test { background: white; padding: 20px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>✅ Test Page Works!</h1>
    <div class="test">
        <p>If you can see this styled text, the server is working correctly.</p>
        <p>This means HTML files are being served with proper Content-Type.</p>
    </div>
</body>
</html>`;
            
            await fs.writeFile(path.join(outputDir, 'test.html'), testHTML, 'utf8');
            console.log('📄 Created test.html file for verification');
            
            // Also create a simple debug file to check the main HTML
            const debugHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug - ${hotelData.name || 'Hotel'}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        h1 { color: green; }
        .debug { background: white; padding: 20px; border-radius: 5px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>🔍 Debug Page</h1>
    <div class="debug">
        <h2>Hotel Data:</h2>
        <p><strong>Name:</strong> ${hotelData.name || 'N/A'}</p>
        <p><strong>Address:</strong> ${hotelData.address || 'N/A'}</p>
        <p><strong>Phone:</strong> ${hotelData.phone || 'N/A'}</p>
        <h2>HTML File Info:</h2>
        <p><strong>File Size:</strong> ${finalHTML.length} characters</p>
        <p><strong>Has DOCTYPE:</strong> ${finalHTML.includes('<!DOCTYPE html>') ? 'Yes' : 'No'}</p>
        <p><strong>Has HTML tag:</strong> ${finalHTML.includes('<html') ? 'Yes' : 'No'}</p>
        <h2>First 500 characters of main HTML:</h2>
        <pre>${finalHTML.substring(0, 500)}</pre>
    </div>
</body>
</html>`;
            
            await fs.writeFile(path.join(outputDir, 'debug.html'), debugHTML, 'utf8');
            console.log('📄 Created debug.html file for troubleshooting');
            
            // Create a simple test file to verify server is working
            const simpleTestHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Test - ${hotelData.name || 'Hotel'}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        h1 { color: green; }
        .test { background: white; padding: 20px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>✅ Simple Test Page</h1>
    <div class="test">
        <p><strong>Hotel Name:</strong> ${hotelData.name || 'N/A'}</p>
        <p><strong>Address:</strong> ${hotelData.address || 'N/A'}</p>
        <p><strong>Phone:</strong> ${hotelData.phone || 'N/A'}</p>
        <p>If you can see this styled page, the server is working correctly!</p>
    </div>
</body>
</html>`;
            
            await fs.writeFile(path.join(outputDir, 'simple-test.html'), simpleTestHTML, 'utf8');
            console.log('📄 Created simple-test.html file for verification');
            
            if (isFallback) {
                console.log(`⚠️ Created fallback website (original site blocked) to: ${outputDir}`);
            } else {
                console.log(`✅ Website cloned successfully to: ${outputDir}`);
            }
            return outputDir;
            
        } catch (error) {
            console.error('❌ Error cloning website:', error.message);
            throw error;
        }
    }

    /**
     * Try to get HTML using axios (for static sites)
     */
    async getStaticHTML(url) {
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                maxRedirects: 5
            });
            return response.data;
        } catch (error) {
            console.log('Static HTML fetch failed:', error.message);
            if (error.response) {
                console.log('Response status:', error.response.status);
                console.log('Response headers:', error.response.headers);
            }
            return null;
        }
    }

    /**
     * Get HTML using Puppeteer (for dynamic sites)
     */
    async getDynamicHTML(url) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ]
            });
            
            const page = await browser.newPage();
            
            // Set a more realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            });
            
            // Set viewport
            await page.setViewport({ width: 1920, height: 1080 });
            
            console.log('🌐 Navigating to:', url);
            
            // Try different wait strategies
            try {
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 45000 
                });
                
                // Wait for network to be idle
                await page.waitForTimeout(3000);
                
                console.log('✅ Page loaded successfully');
                
            } catch (navigationError) {
                console.log('⚠️ Navigation failed, trying with networkidle0...');
                await page.goto(url, { 
                    waitUntil: 'networkidle0', 
                    timeout: 60000 
                });
            }
            
            const html = await page.content();
            return html;
            
        } catch (error) {
            console.log('Dynamic HTML fetch failed:', error.message);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Process and download all assets
     */
    async processAssets($, baseUrl, outputDir) {
        const baseURL = new URL(baseUrl);
        
        // Process CSS files
        await this.processCSSAssets($, baseURL, outputDir);
        
        // Process JS files
        await this.processJSAssets($, baseURL, outputDir);
        
        // Process images
        await this.processImageAssets($, baseURL, outputDir);
        
        // Process other assets (fonts, etc.)
        await this.processOtherAssets($, baseURL, outputDir);
    }

    /**
     * Process CSS assets
     */
    async processCSSAssets($, baseURL, outputDir) {
        const cssLinks = $('link[rel="stylesheet"]');
        
        for (let i = 0; i < cssLinks.length; i++) {
            const link = cssLinks.eq(i);
            const href = link.attr('href');
            
            if (href) {
                try {
                    const absoluteUrl = this.resolveUrl(href, baseURL.href);
                    const fileName = this.generateFileName(href, 'css');
                    const localPath = path.join('css', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    link.attr('href', localPath);
                    
                    console.log(`📦 Downloaded CSS: ${fileName}`);
                } catch (error) {
                    console.log(`⚠️ Failed to download CSS: ${href}`, error.message);
                }
            }
        }
    }

    /**
     * Process JS assets
     */
    async processJSAssets($, baseURL, outputDir) {
        const scriptTags = $('script[src]');
        
        for (let i = 0; i < scriptTags.length; i++) {
            const script = scriptTags.eq(i);
            const src = script.attr('src');
            
            if (src) {
                try {
                    const absoluteUrl = this.resolveUrl(src, baseURL.href);
                    const fileName = this.generateFileName(src, 'js');
                    const localPath = path.join('js', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    script.attr('src', localPath);
                    
                    console.log(`📦 Downloaded JS: ${fileName}`);
                } catch (error) {
                    console.log(`⚠️ Failed to download JS: ${src}`, error.message);
                }
            }
        }
    }

    /**
     * Process image assets
     */
    async processImageAssets($, baseURL, outputDir) {
        const images = $('img[src]');
        
        for (let i = 0; i < images.length; i++) {
            const img = images.eq(i);
            const src = img.attr('src');
            
            if (src) {
                try {
                    const absoluteUrl = this.resolveUrl(src, baseURL.href);
                    const fileName = this.generateFileName(src, 'img');
                    const localPath = path.join('images', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    img.attr('src', localPath);
                    
                    console.log(`📦 Downloaded image: ${fileName}`);
                } catch (error) {
                    console.log(`⚠️ Failed to download image: ${src}`, error.message);
                }
            }
        }
    }

    /**
     * Process other assets (fonts, etc.)
     */
    async processOtherAssets($, baseURL, outputDir) {
        // Process font files
        const fontLinks = $('link[rel="preload"], link[rel="prefetch"]');
        
        for (let i = 0; i < fontLinks.length; i++) {
            const link = fontLinks.eq(i);
            const href = link.attr('href');
            
            if (href && (href.includes('.woff') || href.includes('.ttf') || href.includes('.otf'))) {
                try {
                    const absoluteUrl = this.resolveUrl(href, baseURL.href);
                    const fileName = this.generateFileName(href, 'font');
                    const localPath = path.join('css', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    link.attr('href', localPath);
                    
                    console.log(`📦 Downloaded font: ${fileName}`);
                } catch (error) {
                    console.log(`⚠️ Failed to download font: ${href}`, error.message);
                }
            }
        }
    }

    /**
     * Download an asset file
     */
    async downloadAsset(url, localPath) {
        if (this.downloadedAssets.has(url)) {
            return;
        }

        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            await fs.writeFile(localPath, response.data);
            this.downloadedAssets.add(url);
            
        } catch (error) {
            console.log(`Failed to download: ${url}`, error.message);
            throw error;
        }
    }

    /**
     * Resolve relative URLs to absolute URLs
     */
    resolveUrl(href, baseUrl) {
        if (href.startsWith('http://') || href.startsWith('https://')) {
            return href;
        }
        
        if (href.startsWith('//')) {
            return `https:${href}`;
        }
        
        if (href.startsWith('/')) {
            const url = new URL(baseUrl);
            return `${url.protocol}//${url.host}${href}`;
        }
        
        // Relative path
        const url = new URL(baseUrl);
        const basePath = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
        return `${url.protocol}//${url.host}${basePath}${href}`;
    }

    /**
     * Generate a filename for downloaded assets
     */
    generateFileName(url, type) {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const ext = path.extname(pathname) || this.getDefaultExtension(type);
        const name = path.basename(pathname, ext) || type;
        
        // Remove query parameters and add timestamp for uniqueness
        const timestamp = Date.now();
        return `${name}-${timestamp}${ext}`;
    }

    /**
     * Get default extension for asset type
     */
    getDefaultExtension(type) {
        const extensions = {
            'css': '.css',
            'js': '.js',
            'img': '.jpg',
            'font': '.woff'
        };
        return extensions[type] || '.txt';
    }

    /**
     * Auto-detect hotel information from the website
     */
    detectHotelInfo($) {
        console.log('🔍 Auto-detecting hotel information...');
        
        const detectedInfo = {
            hotelNames: [],
            addresses: [],
            phoneNumbers: []
        };

        // 1. Detect hotel names from various sources (more selective)
        const hotelNameSelectors = [
            'h1', 'h2', '.hotel-name', '.brand-name', '.logo-text',
            '[class*="hotel"]', '[class*="brand"]', '[class*="logo"]',
            '.title', '.name', '.header-title', '.site-title'
        ];

        hotelNameSelectors.forEach(selector => {
            $(selector).each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length > 3 && text.length < 80) {
                    // Check if it looks like a hotel name
                    if (this.isHotelName(text)) {
                        // Avoid duplicates
                        if (!detectedInfo.hotelNames.includes(text)) {
                            detectedInfo.hotelNames.push(text);
                            console.log('🏨 Found hotel name:', text);
                        }
                    }
                }
            });
        });

        // 2. Detect addresses (more selective)
        const addressSelectors = [
            '.address', '.location', '.contact-info',
            '[class*="address"]', '[class*="location"]', '[class*="contact"]'
        ];

        addressSelectors.forEach(selector => {
            $(selector).each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length > 10 && text.length < 200 && this.isAddress(text)) {
                    // Avoid duplicates and very long texts
                    if (!detectedInfo.addresses.includes(text)) {
                        detectedInfo.addresses.push(text);
                        console.log('📍 Found address:', text);
                    }
                }
            });
        });

        // 3. Detect phone numbers (more selective)
        const phoneSelectors = [
            '.phone', '.tel', '.contact',
            '[class*="phone"]', '[class*="tel"]', '[class*="contact"]',
            'a[href^="tel:"]', 'a[href^="callto:"]'
        ];

        phoneSelectors.forEach(selector => {
            $(selector).each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length < 50 && this.isPhoneNumber(text)) {
                    // Avoid duplicates and very long texts
                    if (!detectedInfo.phoneNumbers.includes(text)) {
                        detectedInfo.phoneNumbers.push(text);
                        console.log('📞 Found phone:', text);
                    }
                }
            });
        });

        // Also check href attributes for phone numbers
        $('a[href^="tel:"], a[href^="callto:"]').each((i, elem) => {
            const href = $(elem).attr('href');
            const phone = href.replace(/^(tel:|callto:)/, '');
            if (this.isPhoneNumber(phone) && !detectedInfo.phoneNumbers.includes(phone)) {
                detectedInfo.phoneNumbers.push(phone);
                console.log('📞 Found phone from href:', phone);
            }
        });

        console.log('✅ Detection complete:', detectedInfo);
        return detectedInfo;
    }

    /**
     * Check if text looks like a hotel name
     */
    isHotelName(text) {
        const hotelKeywords = [
            'hotel', 'resort', 'inn', 'lodge', 'boutique', 'luxury', 'grand',
            'otel', 'oteli', 'konak', 'pansiyon', 'misafirhane'
        ];
        
        const lowerText = text.toLowerCase();
        return hotelKeywords.some(keyword => lowerText.includes(keyword)) ||
               /^[A-Z][a-z]+ (Hotel|Resort|Inn|Lodge|Otel)/i.test(text);
    }

    /**
     * Check if text looks like an address
     */
    isAddress(text) {
        // Look for address patterns
        const addressPatterns = [
            /\d+[,\s]+[A-Za-z\s]+[,\s]+\d{5}/, // Street number, street name, postal code
            /[A-Za-z\s]+, [A-Za-z\s]+, [A-Za-z\s]+/, // City, State, Country
            /\d{5}/, // Postal code
            /[A-Za-z\s]+ [A-Za-z\s]+, [A-Za-z\s]+/ // Street, City, Country
        ];
        
        return addressPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Check if text looks like a phone number
     */
    isPhoneNumber(text) {
        const phonePatterns = [
            /\+?\d{1,4}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2}/, // International
            /\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{4}/, // US format
            /\d{3}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/, // Turkish format
            /\d{10,15}/ // General phone number
        ];
        
        const cleanText = text.replace(/[\s\-\(\)]/g, '');
        return phonePatterns.some(pattern => pattern.test(cleanText));
    }

    /**
     * Inject hotel data into the HTML
     */
    injectHotelData($, hotelData) {
        console.log('🏨 Injecting hotel data...');
        
        // Replace common placeholders
        const replacements = {
            '{{hotelName}}': hotelData.name || 'Hotel Name',
            '{{hotelAddress}}': hotelData.address || 'Hotel Address',
            '{{hotelDescription}}': hotelData.description || 'Hotel Description',
            '{{hotelPhone}}': hotelData.phone || 'Hotel Phone',
            '{{hotelEmail}}': hotelData.email || 'hotel@example.com',
            '{{hotelLogo}}': hotelData.logo || 'logo.png'
        };

        // Auto-detect hotel information from the website
        const detectedInfo = this.detectHotelInfo($);
        
        console.log('🔍 Detected hotel info:', detectedInfo);
        
        // Use detected info for replacement
        const hotelNamePatterns = detectedInfo.hotelNames;
        const addressPatterns = detectedInfo.addresses;
        const phonePatterns = detectedInfo.phoneNumbers;

        // MINIMAL REPLACEMENT - Only replace specific text content, not HTML structure
        console.log('🎯 Performing minimal text replacements...');
        
        // Replace only in text nodes, not HTML structure
        $('*').contents().each((i, elem) => {
            if (elem.type === 'text' && elem.data) {
                let text = elem.data;
                let originalText = text;
                
                // Replace placeholders first
                Object.entries(replacements).forEach(([placeholder, value]) => {
                    text = text.replace(new RegExp(placeholder, 'g'), value);
                });
                
                // Smart hotel name replacement - be very conservative
                hotelNamePatterns.forEach(pattern => {
                    if (typeof pattern === 'string' && pattern.length > 3) {
                        if (text.includes(pattern)) {
                            const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            text = text.replace(new RegExp(escapedPattern, 'gi'), hotelData.name || 'Hotel Name');
                            console.log(`🏨 Replaced "${pattern}" with "${hotelData.name}"`);
                        }
                    }
                });
                
                // Smart address replacement
                addressPatterns.forEach(pattern => {
                    if (typeof pattern === 'string' && pattern.length > 10) {
                        if (text.includes(pattern)) {
                            const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            text = text.replace(new RegExp(escapedPattern, 'gi'), hotelData.address || 'Hotel Address');
                            console.log(`📍 Replaced address "${pattern}" with "${hotelData.address}"`);
                        }
                    }
                });
                
                // Smart phone number replacement
                phonePatterns.forEach(pattern => {
                    if (typeof pattern === 'string' && pattern.length > 8) {
                        if (text.includes(pattern)) {
                            const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            text = text.replace(new RegExp(escapedPattern, 'gi'), hotelData.phone || 'Hotel Phone');
                            console.log(`📞 Replaced phone "${pattern}" with "${hotelData.phone}"`);
                        }
                    }
                });
                
                // Only update if text actually changed
                if (text !== originalText) {
                    elem.data = text;
                }
            }
        });

        // Replace in specific attributes
        $('[title], [alt], [placeholder]').each((i, elem) => {
            const $elem = $(elem);
            
            ['title', 'alt', 'placeholder'].forEach(attr => {
                const value = $elem.attr(attr);
                if (value) {
                    // Replace placeholders
                    Object.entries(replacements).forEach(([placeholder, replacement]) => {
                        if (value.includes(placeholder)) {
                            $elem.attr(attr, value.replace(new RegExp(placeholder, 'g'), replacement));
                        }
                    });
                    
                    // Smart hotel name replacement in attributes
                    hotelNamePatterns.forEach(pattern => {
                        if (typeof pattern === 'string') {
                            if (value.includes(pattern)) {
                                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                $elem.attr(attr, value.replace(new RegExp(escapedPattern, 'gi'), hotelData.name || 'Hotel Name'));
                            }
                        } else if (pattern instanceof RegExp) {
                            $elem.attr(attr, value.replace(pattern, hotelData.name || 'Hotel Name'));
                        }
                    });
                    
                    // Smart address replacement in attributes
                    addressPatterns.forEach(pattern => {
                        if (typeof pattern === 'string') {
                            if (value.includes(pattern)) {
                                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                $elem.attr(attr, value.replace(new RegExp(escapedPattern, 'gi'), hotelData.address || 'Hotel Address'));
                            }
                        } else if (pattern instanceof RegExp) {
                            $elem.attr(attr, value.replace(pattern, hotelData.address || 'Hotel Address'));
                        }
                    });
                    
                    // Smart phone number replacement in attributes
                    phonePatterns.forEach(pattern => {
                        if (typeof pattern === 'string') {
                            if (value.includes(pattern)) {
                                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                $elem.attr(attr, value.replace(new RegExp(escapedPattern, 'gi'), hotelData.phone || 'Hotel Phone'));
                            }
                        } else if (pattern instanceof RegExp) {
                            $elem.attr(attr, value.replace(pattern, hotelData.phone || 'Hotel Phone'));
                        }
                    });
                }
            });
        });

        // Update title tag
        const title = $('title');
        if (title.length > 0) {
            let titleText = title.text();
            Object.entries(replacements).forEach(([placeholder, value]) => {
                titleText = titleText.replace(new RegExp(placeholder, 'g'), value);
            });
            title.text(titleText);
        }

        // Update meta description
        const metaDesc = $('meta[name="description"]');
        if (metaDesc.length > 0) {
            let desc = metaDesc.attr('content');
            Object.entries(replacements).forEach(([placeholder, value]) => {
                desc = desc.replace(new RegExp(placeholder, 'g'), value);
            });
            metaDesc.attr('content', desc);
        }

        console.log('✅ Hotel data injected successfully');
        console.log('🏨 Replaced hotel name with:', hotelData.name);
        console.log('📍 Replaced address with:', hotelData.address);
        console.log('📞 Replaced phone with:', hotelData.phone);
    }

    /**
     * Create a fallback HTML when cloning fails
     */
    createFallbackHTML(hotelData) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${hotelData.name || 'Hotel'} - Cloned Website</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 2rem 0; text-align: center; }
        .hero { background: #ecf0f1; padding: 4rem 0; text-align: center; }
        .content { padding: 3rem 0; }
        .contact { background: #34495e; color: white; padding: 2rem 0; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; margin: 10px; }
        .btn:hover { background: #2980b9; }
    </style>
</head>
<body>
    <header class="header">
        <div class="container">
            <h1>${hotelData.name || 'Hotel Name'}</h1>
            <p>Welcome to our hotel</p>
        </div>
    </header>

    <section class="hero">
        <div class="container">
            <h2>Welcome to ${hotelData.name || 'Our Hotel'}</h2>
            <p>${hotelData.description || 'Experience luxury and comfort at our hotel.'}</p>
            <a href="#contact" class="btn">Book Now</a>
            <a href="#contact" class="btn">Contact Us</a>
        </div>
    </section>

    <section class="content">
        <div class="container">
            <h3>About Our Hotel</h3>
            <p>${hotelData.description || 'We provide exceptional service and comfortable accommodations for our guests.'}</p>
            
            <h3>Location</h3>
            <p>${hotelData.address || 'Hotel Address'}</p>
        </div>
    </section>

    <section class="contact" id="contact">
        <div class="container">
            <h3>Contact Information</h3>
            <p>Phone: ${hotelData.phone || 'Contact us'}</p>
            <p>Email: ${hotelData.email || 'info@hotel.com'}</p>
            <p>Address: ${hotelData.address || 'Hotel Address'}</p>
        </div>
    </section>

    <footer style="background: #2c3e50; color: white; text-align: center; padding: 1rem 0;">
        <p>&copy; 2024 ${hotelData.name || 'Hotel'}. All rights reserved.</p>
    </footer>
</body>
</html>`;
    }
}

module.exports = WebsiteCloner; 