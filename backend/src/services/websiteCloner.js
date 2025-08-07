const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs-extra');
const path = require('path');
const URL = require('url-parse');
const { URL: NodeURL } = require('url');

puppeteer.use(StealthPlugin());

class WebsiteCloner {
    constructor(options = {}) {
        this.downloadedAssets = new Set();
        this.assetMap = new Map();
        this.failedAssets = [];
        this.debugReport = {
            totalAssets: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            errors: []
        };
        this.options = {
            waitForNetworkIdle: true,
            scrollCycles: 3,
            scrollDelay: 500,
            maxWaitTime: 30000,
            downloadTimeout: 15000,
            preserveOriginalStructure: true,
            injectGoogleFontsLocally: false,
            ...options
        };
    }

    /**
     * Main function to clone a website with enhanced features
     * @param {string} url - The URL to clone
     * @param {string} outputDir - Output directory
     * @param {Object} hotelData - Hotel data to inject
     * @returns {Promise<Object>} - Path to cloned site and debug report
     */
    async cloneSite(url, outputDir, hotelData = {}) {
        // Set a timeout for the entire clone process
        const cloneTimeout = setTimeout(() => {
            console.error(' Clone process timed out after 5 minutes');
            throw new Error('Clone process timed out');
        }, 300000); // 5 minutes
        
        try {
            console.log(` Starting enhanced clone: ${url}`);
            
            // Reset debug report
            this.debugReport = {
                totalAssets: 0,
                successfulDownloads: 0,
                failedDownloads: 0,
                errors: [],
                startTime: Date.now()
            };
            
            // Ensure output directory exists
            await fs.ensureDir(outputDir);
            
            // Create comprehensive asset directories
            const assetDirs = ['css', 'js', 'images', 'fonts', 'media', 'assets'];
            for (const dir of assetDirs) {
                await fs.ensureDir(path.join(outputDir, dir));
            }

            // Get HTML content with enhanced dynamic capture
            let html = await this.getEnhancedHTML(url);
            let isFallback = false;
            
            if (!html) {
                console.log(' Failed to fetch HTML content, creating fallback website...');
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
                // Inject hotel data FIRST (before asset processing)
                this.injectHotelData($, hotelData);
                
                // Enhanced asset processing
                await this.processAllAssets($, url, outputDir, hotelData);
                
                // Post-processing: fix any broken references
                this.fixBrokenReferences($, url);
            }
            
            // Save the final HTML - preserve original structure
            let finalHTML = $.html();
            
            // Enhanced HTML cleanup
            finalHTML = this.cleanupHTML(finalHTML);
            
            console.log('📄 Saving enhanced HTML file...');
            await fs.writeFile(path.join(outputDir, 'index.html'), finalHTML, 'utf8');
            
            // Generate comprehensive debug reports
            await this.generateDebugReports(outputDir, hotelData, finalHTML);
            
            // Calculate final statistics
            this.debugReport.endTime = Date.now();
            this.debugReport.duration = this.debugReport.endTime - this.debugReport.startTime;
            this.debugReport.successRate = this.debugReport.totalAssets > 0 
                ? (this.debugReport.successfulDownloads / this.debugReport.totalAssets * 100).toFixed(2)
                : 0;
            
            console.log(` Clone Statistics:`);
            console.log(`   Total Assets: ${this.debugReport.totalAssets}`);
            console.log(`   Successful: ${this.debugReport.successfulDownloads}`);
            console.log(`   Failed: ${this.debugReport.failedDownloads}`);
            console.log(`   Success Rate: ${this.debugReport.successRate}%`);
            console.log(`   Duration: ${this.debugReport.duration}ms`);
            
            // Clear the timeout since we completed successfully
            clearTimeout(cloneTimeout);
            
            if (isFallback) {
                console.log(` Created fallback website to: ${outputDir}`);
            } else {
                console.log(` Website cloned successfully to: ${outputDir}`);
            }
            
            return {
                outputDir,
                debugReport: this.debugReport,
                isFallback
            };
            
        } catch (error) {
            // Clear the timeout since we encountered an error
            clearTimeout(cloneTimeout);
            
            console.error(' Error cloning website:', error.message);
            this.debugReport.errors.push({
                type: 'clone_error',
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Enhanced HTML capture with comprehensive dynamic content handling
     */
    async getEnhancedHTML(url) {
        try {
            // First try static capture
            console.log(' Attempting static HTML capture...');
            let html = await this.getStaticHTML(url);
            
            if (html) {
                console.log('Static HTML capture successful');
                return html;
            }
            
            // Fallback to enhanced dynamic capture
            console.log('📄 Static HTML failed, using enhanced dynamic capture...');
            return await this.getEnhancedDynamicHTML(url);
            
        } catch (error) {
            console.error(' Enhanced HTML capture failed:', error.message);
            return null;
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
     * Enhanced dynamic HTML capture with comprehensive lazy loading and AJAX handling
     */
    async getEnhancedDynamicHTML(url) {
        let browser;
        try {
            console.log(' Launching Puppeteer browser...');
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
                    '--single-process',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-field-trial-config',
                    '--disable-ipc-flooding-protection'
                ],
                timeout: 30000 // 30 second timeout for browser launch
            });
            
            const page = await browser.newPage();
            
            // Enhanced browser setup
            await this.setupEnhancedPage(page);
            
            console.log(' Navigating to:', url);
            
            // Navigate with enhanced waiting
            console.log(' Navigating to URL...');
            await page.goto(url, { 
                waitUntil: 'networkidle0', 
                timeout: this.options.maxWaitTime 
            });
            console.log(' Navigation completed');
            
            // Enhanced content capture with multiple strategies
            console.log(' Starting enhanced content capture...');
            await this.performEnhancedContentCapture(page);
            console.log(' Enhanced content capture completed');
            
            // Final wait for any remaining dynamic content
            console.log(' Waiting for final content...');
            await this.waitForFinalContent(page);
            console.log(' Final content wait completed');
            
            // Capture the final HTML
            const html = await page.content();
            
            // Save debug screenshot
            await page.screenshot({path: 'debug-enhanced.png', fullPage: true});
            console.log(' Enhanced debug screenshot saved');
            
            return html;
            
        } catch (error) {
            console.error(' Enhanced dynamic HTML capture failed:', error.message);
            console.error(' Stack trace:', error.stack);
            return null;
        } finally {
            if (browser) {
                try {
                    console.log(' Closing browser in finally block...');
                    await browser.close();
                    console.log(' Browser closed successfully');
                } catch (closeError) {
                    console.error(' Failed to close browser:', closeError.message);
                }
            }
        }
    }

    /**
     * Setup enhanced page configuration
     */
    async setupEnhancedPage(page) {
        // Enhanced user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Enhanced headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none'
        });
        
        // Enhanced viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Enhanced console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('PAGE ERROR:', msg.text());
            }
        });
        
        // Enhanced request interception for debugging
        page.on('request', request => {
            console.log(' Request:', request.url());
        });
        
        page.on('response', response => {
            if (response.status() >= 400) {
                console.log(' Response error:', response.url(), response.status());
            }
        });
    }

    /**
     * Perform enhanced content capture with multiple strategies
     */
    async performEnhancedContentCapture(page) {
        console.log(' Starting enhanced content capture...');
        
        // Strategy 1: Multiple scroll cycles with different patterns
        await this.performScrollCycles(page);
        
        // Strategy 2: Wait for specific content selectors
        await this.waitForSpecificContent(page);
        
        // Strategy 3: Simulate user interactions
        await this.simulateUserInteractions(page);
        
        // Strategy 4: Trigger lazy loading mechanisms
        await this.triggerLazyLoading(page);
        
        // Strategy 5: Wait for network idle
        await this.waitForNetworkIdle(page);
    }

    /**
     * Perform multiple scroll cycles with different patterns
     */
    async performScrollCycles(page) {
        console.log('Performing enhanced scroll cycles...');
        
        for (let cycle = 1; cycle <= this.options.scrollCycles; cycle++) {
            console.log(`Scroll cycle ${cycle}/${this.options.scrollCycles}`);
            
            // Scroll to bottom in steps
            await this.scrollToBottom(page, 500, 300);
            
            // Scroll back to top
            await page.evaluate('window.scrollTo(0, 0)');
            await page.waitForTimeout(1000);
            
            // Scroll to middle
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight / 2)');
            await page.waitForTimeout(1000);
            
            // Scroll to bottom again
            await this.scrollToBottom(page, 200, 200);
            
            // Wait between cycles
            await page.waitForTimeout(this.options.scrollDelay);
        }
    }

    /**
     * Scroll to bottom with step-by-step approach
     */
    async scrollToBottom(page, stepSize, delay) {
        let previousHeight = await page.evaluate('document.body.scrollHeight');
        let currentPosition = 0;
        
        while (currentPosition < previousHeight) {
            await page.evaluate(`window.scrollBy(0, ${stepSize})`);
            currentPosition += stepSize;
            await page.waitForTimeout(delay);
            
            // Check if height changed (new content loaded)
            const newHeight = await page.evaluate('document.body.scrollHeight');
            if (newHeight > previousHeight) {
                previousHeight = newHeight;
            }
        }
    }

    /**
     * Wait for specific content to appear
     */
    async waitForSpecificContent(page) {
        console.log('Waiting for specific content...');
        
        const contentSelectors = [
            '.footer', '.site-footer', '#footer', 'footer', '[class*="footer"]', '[id*="footer"]',
            '.contact', '.contact-info', '[class*="contact"]', '[id*="contact"]',
            '.social', '.social-media', '[class*="social"]', '[id*="social"]',
            '.gallery', '.slider', '.carousel', '[class*="gallery"]', '[class*="slider"]',
            '.menu', '.navigation', '[class*="menu"]', '[class*="nav"]',
            '.lazy', '[data-src]', '[data-lazy]', '[loading="lazy"]'
        ];
        
        for (const selector of contentSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                console.log(`Found content: ${selector}`);
            } catch (e) {
                // Ignore timeout errors
            }
        }
    }

    /**
     * Simulate user interactions to trigger dynamic content
     */
    async simulateUserInteractions(page) {
        console.log(' Simulating user interactions...');
        
        // Mouse movements and clicks
        await page.mouse.move(100, 100);
        await page.mouse.click(100, 100);
        await page.waitForTimeout(500);
        
        // Keyboard interactions
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(500);
        
        // Click on potential lazy load triggers
        const lazyTriggers = await page.$$('[data-src], [data-lazy], .lazy, [loading="lazy"]');
        for (const trigger of lazyTriggers.slice(0, 5)) { // Limit to first 5
            try {
                await trigger.click();
                await page.waitForTimeout(200);
            } catch (e) {
                // Ignore click errors
            }
        }
    }

    /**
     * Trigger lazy loading mechanisms
     */
    async triggerLazyLoading(page) {
        console.log(' Triggering lazy loading...');
        
        // Trigger Intersection Observer
        await page.evaluate(() => {
            // Simulate intersection observer triggers
            const lazyElements = document.querySelectorAll('[data-src], [data-lazy], .lazy, [loading="lazy"]');
            lazyElements.forEach(el => {
                // Trigger load event
                const event = new Event('load', { bubbles: true });
                el.dispatchEvent(event);
            });
        });
        
        await page.waitForTimeout(1000);
    }

    /**
     * Wait for network idle with enhanced timeout
     */
    async waitForNetworkIdle(page) {
        console.log('⏳ Waiting for network idle...');
        
        try {
            await page.waitForNetworkIdle({
                idleTime: 3000,
                timeout: 15000
            });
            console.log(' Network is idle');
        } catch (e) {
            console.log(' Network did not go idle, continuing...');
        }
    }

    /**
     * Wait for final content to load
     */
    async waitForFinalContent(page) {
        console.log(' Waiting for final content...');
        
        // Wait for any remaining AJAX calls
        await page.waitForTimeout(3000);
        
        // Check for any remaining loading indicators
        try {
            await page.waitForFunction(() => {
                const loadingSelectors = [
                    '.loading', '.spinner', '.loader', '[class*="loading"]',
                    '.ajax-loading', '.lazy-loading'
                ];
                return !loadingSelectors.some(selector => 
                    document.querySelector(selector)
                );
            }, { timeout: 10000 });
            console.log(' All loading indicators cleared');
        } catch (e) {
            console.log(' Some loading indicators may still be present');
        }
    }

    /**
     * Get HTML using Puppeteer (for dynamic sites) - Legacy method
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
            
            // Capture browser console errors for debugging
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    console.log('PAGE ERROR:', msg.text());
                }
            });
            
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
            
            console.log(' Navigating to:', url);
            
            // Use networkidle0 for navigation to wait for all network requests to finish
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
            
            // --- AGGRESSIVE CONTENT CAPTURE: Multiple scroll cycles ---
            console.log(' Starting aggressive content capture...');
            
            // First scroll cycle
            const scrollStep = 500;
            const scrollDelay = 300;
            let previousHeight = await page.evaluate('document.body.scrollHeight');
            for (let i = 0; i < 10; i++) {
                await page.evaluate(`window.scrollBy(0, ${scrollStep});`);
                await page.waitForTimeout(scrollDelay);
                let newHeight = await page.evaluate('document.body.scrollHeight');
                if (newHeight === previousHeight) break;
                previousHeight = newHeight;
            }
            
            // Scroll to very bottom and wait
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await page.waitForTimeout(3000);
            
            // Second scroll cycle - go back to top and scroll down again
            await page.evaluate('window.scrollTo(0, 0)');
            await page.waitForTimeout(1000);
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await page.waitForTimeout(3000);
            
            // Third scroll cycle - scroll in smaller steps to bottom
            for (let i = 0; i < 20; i++) {
                await page.evaluate('window.scrollBy(0, 200)');
                await page.waitForTimeout(200);
            }
            await page.waitForTimeout(3000);
            
            // --- NEW: Wait for specific content to appear ---
            console.log(' Waiting for specific content...');
            
            // Wait for footer or any content that should be at the bottom
            try {
                await page.waitForSelector('.footer, .site-footer, #footer, footer, [class*="footer"], [id*="footer"]', {timeout: 10000});
                console.log(' Footer selector found!');
            } catch (e) {
                console.log(' Footer selector not found after waiting.');
            }
            
            // Wait for contact information
            try {
                await page.waitForSelector('[class*="contact"], [id*="contact"], .contact, #contact', {timeout: 5000});
                console.log(' Contact information found!');
            } catch (e) {
                console.log(' Contact information not found.');
            }
            
            // Wait for social media icons
            try {
                await page.waitForSelector('[class*="social"], [id*="social"], .social, #social', {timeout: 5000});
                console.log(' Social media section found!');
            } catch (e) {
                console.log(' Social media section not found.');
            }
            
            // --- NEW: Wait for network idle again after all scrolling ---
            try {
                await page.waitForNetworkIdle({idleTime: 3000, timeout: 15000});
                console.log(' Network is idle.');
            } catch (e) {
                console.log(' Network did not go idle after scrolling.');
            }
            
            // --- NEW: Simulate more user interaction to trigger dynamic content ---
            console.log(' Simulating user interactions...');
            await page.mouse.move(100, 100);
            await page.mouse.click(100, 100);
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(1000);
            
            // Move mouse to bottom area and click
            await page.mouse.move(100, 800);
            await page.mouse.click(100, 800);
            await page.waitForTimeout(1000);
            
            // Press Page Down to trigger any lazy loading
            await page.keyboard.press('PageDown');
            await page.waitForTimeout(2000);
            
            // --- NEW: Check if content is actually present before screenshot ---
            const footerContent = await page.evaluate(() => {
                const footer = document.querySelector('.footer, .site-footer, #footer, footer, [class*="footer"], [id*="footer"]');
                return footer ? footer.innerHTML : 'No footer found';
            });
            console.log(' Footer content check:', footerContent.substring(0, 200) + '...');
            
            // --- NEW: Save a full-page screenshot for debugging ---
            await page.screenshot({path: 'debug.png', fullPage: true});
            console.log(' Screenshot saved as debug.png');
            
            // --- END AGGRESSIVE CONTENT CAPTURE ---
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
     * Enhanced asset processing with comprehensive coverage
     */
    async processAllAssets($, baseUrl, outputDir, hotelData = {}) {
        const baseURL = new URL(baseUrl);
        
        console.log(' Starting enhanced asset processing...');
        
        // Process all asset types with enhanced error handling
        await Promise.all([
            this.processEnhancedCSSAssets($, baseURL, outputDir),
            this.processEnhancedJSAssets($, baseURL, outputDir),
            this.processEnhancedImageAssets($, baseURL, outputDir, hotelData),
            this.processEnhancedOtherAssets($, baseURL, outputDir),
            this.processCSSBackgroundImages($, baseURL, outputDir),
            this.processPictureElements($, baseURL, outputDir),
            this.processInlineStyles($, baseURL, outputDir),
            this.processGoogleFonts($, baseURL, outputDir)
        ]);
        
        console.log(` Asset processing complete. Total: ${this.debugReport.totalAssets}, Success: ${this.debugReport.successfulDownloads}, Failed: ${this.debugReport.failedDownloads}`);
    }

    /**
     * Process and download all assets (legacy method)
     */
    async processAssets($, baseUrl, outputDir, hotelData = {}) {
        const baseURL = new URL(baseUrl);
        
        // Process CSS files
        await this.processCSSAssets($, baseURL, outputDir);
        
        // Process JS files
        await this.processJSAssets($, baseURL, outputDir);
        
        // Process images (pass hotelData for logo replacement)
        await this.processImageAssets($, baseURL, outputDir, hotelData);
        
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
                    
                    console.log(`Downloaded CSS: ${fileName}`);
                } catch (error) {
                    console.log(`Failed to download CSS: ${href}`, error.message);
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
                    
                    console.log(` Downloaded JS: ${fileName}`);
                } catch (error) {
                    console.log(` Failed to download JS: ${src}`, error.message);
                }
            }
        }
    }

    /**
     * Process image assets
     */
    async processImageAssets($, baseURL, outputDir, hotelData = {}) {
        const images = $('img[src]');
        
        for (let i = 0; i < images.length; i++) {
            const img = images.eq(i);
            const src = img.attr('src');
            const isLogo = img.attr('data-is-logo') === 'true';
            
            if (src) {
                if (isLogo) {
                    // For logo images, copy the hotel logo to the cloned site
                    console.log(' Processing logo image - copying hotel logo');
                    
                    // Copy the logo file to the cloned site
                    const logoFileName = path.basename(hotelData.logo);
                    const sourceLogoPath = path.join(__dirname, '..', hotelData.logo);
                    const destLogoPath = path.join(outputDir, 'images', logoFileName);
                    
                    try {
                        await fs.copy(sourceLogoPath, destLogoPath);
                        console.log(' Copied logo to:', destLogoPath);
                        
                        // Use relative path within the cloned site
                        img.attr('src', `images/${logoFileName}`);
                    } catch (error) {
                        console.log(' Failed to copy logo:', error.message);
                        // Fallback to absolute URL
                        img.attr('src', `http://localhost:5000${hotelData.logo}`);
                    }
                } else {
                    // For non-logo images, try to download but keep original as fallback
                    try {
                        const absoluteUrl = this.resolveUrl(src, baseURL.href);
                        const fileName = this.generateFileName(src, 'img');
                        const localPath = path.join('images', fileName);
                        
                        await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                        img.attr('src', localPath);
                        
                        console.log(` Downloaded image: ${fileName}`);
                    } catch (error) {
                        console.log(` Failed to download image: ${src}`, error.message);
                        // CRITICAL: Keep original URL as fallback - don't break the image
                        console.log(` Keeping original image URL as fallback: ${src}`);
                        // Add more robust error logging
                        img.attr('data-download-error', error.message || 'unknown error');
                    }
                }
            } else {
                // Log missing src attribute
                console.log(' Image tag missing src attribute:', img.html());
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
                    
                    console.log(` Downloaded font: ${fileName}`);
                } catch (error) {
                    console.log(` Failed to download font: ${href}`, error.message);
                }
            }
        }
    }

    /**
     * Enhanced CSS asset processing with background image extraction
     */
    async processEnhancedCSSAssets($, baseURL, outputDir) {
        const cssLinks = $('link[rel="stylesheet"]');
        
        for (let i = 0; i < cssLinks.length; i++) {
            const link = cssLinks.eq(i);
            const href = link.attr('href');
            
            if (href) {
                try {
                    this.debugReport.totalAssets++;
                    const absoluteUrl = this.resolveUrl(href, baseURL.href);
                    const fileName = this.generateFileName(href, 'css');
                    const localPath = path.join('css', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    link.attr('href', localPath);
                    
                    // Process background images in CSS
                    await this.processCSSBackgroundImages(path.join(outputDir, localPath), baseURL, outputDir);
                    
                    console.log(` Downloaded CSS: ${fileName}`);
                    this.debugReport.successfulDownloads++;
                } catch (error) {
                    console.log(` Failed to download CSS: ${href}`, error.message);
                    this.debugReport.failedDownloads++;
                    this.failedAssets.push({ type: 'css', url: href, error: error.message });
                }
            }
        }
    }

    /**
     * Enhanced JS asset processing
     */
    async processEnhancedJSAssets($, baseURL, outputDir) {
        const scriptTags = $('script[src]');
        
        for (let i = 0; i < scriptTags.length; i++) {
            const script = scriptTags.eq(i);
            const src = script.attr('src');
            
            if (src) {
                try {
                    this.debugReport.totalAssets++;
                    const absoluteUrl = this.resolveUrl(src, baseURL.href);
                    const fileName = this.generateFileName(src, 'js');
                    const localPath = path.join('js', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    script.attr('src', localPath);
                    
                    console.log(` Downloaded JS: ${fileName}`);
                    this.debugReport.successfulDownloads++;
                } catch (error) {
                    console.log(` Failed to download JS: ${src}`, error.message);
                    this.debugReport.failedDownloads++;
                    this.failedAssets.push({ type: 'js', url: src, error: error.message });
                }
            }
        }
    }

    /**
     * Enhanced image asset processing
     */
    async processEnhancedImageAssets($, baseURL, outputDir, hotelData = {}) {
        const images = $('img[src]');
        for (let i = 0; i < images.length; i++) {
            const img = images.eq(i);
            const src = img.attr('src');
            // Aggressive logo detection
            const alt = img.attr('alt') || '';
            const className = img.attr('class') || '';
            const id = img.attr('id') || '';
            const isLogo = img.attr('data-is-logo') === 'true' ||
                /logo/i.test(src) || /logo/i.test(alt) || /logo/i.test(className) || /logo/i.test(id) ||
                img.parents('header, nav, .logo, .brand, .navbar, [class*="logo"], [id*="logo"]').length > 0;

            if (src) {
                if (isLogo && hotelData.logo) {
                    // For logo images, copy the hotel logo to the cloned site
                    console.log(' Processing logo image - copying hotel logo');
                    try {
                        const logoFileName = path.basename(hotelData.logo);
                        const sourceLogoPath = path.join(__dirname, '..', hotelData.logo);
                        const destLogoPath = path.join(outputDir, 'images', logoFileName);
                        await fs.copy(sourceLogoPath, destLogoPath);
                        img.attr('src', `images/${logoFileName}`);
                        img.attr('alt', (hotelData.name || '') + ' logo');
                        console.log(`[LOGO] ${src} → images/${logoFileName}`);
                        this.debugReport.successfulDownloads++;
                    } catch (error) {
                        console.log(' Failed to copy logo:', error.message);
                        img.attr('src', `http://localhost:5000${hotelData.logo}`);
                        this.debugReport.failedDownloads++;
                        this.failedAssets.push({ type: 'logo', url: hotelData.logo, error: error.message });
                    }
                } else {
                    // For non-logo images, try to download but keep original as fallback
                    try {
                        this.debugReport.totalAssets++;
                        const absoluteUrl = this.resolveUrl(src, baseURL.href);
                        const fileName = this.generateFileName(src, 'img');
                        const localPath = path.join('images', fileName);
                        await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                        img.attr('src', localPath);
                        console.log(`[IMG] ${src} → ${localPath}`);
                        this.debugReport.successfulDownloads++;
                    } catch (error) {
                        console.log(` Failed to download image: ${src}`, error.message);
                        // Keep original URL as fallback
                        img.attr('data-download-error', error.message || 'unknown error');
                        this.debugReport.failedDownloads++;
                        this.failedAssets.push({ type: 'image', url: src, error: error.message });
                    }
                }
            }
        }
    }

    /**
     * Enhanced other assets processing
     */
    async processEnhancedOtherAssets($, baseURL, outputDir) {
        // Process font files and other special assets
        const fontLinks = $('link[rel="preload"], link[rel="prefetch"]');
        
        for (let i = 0; i < fontLinks.length; i++) {
            const link = fontLinks.eq(i);
            const href = link.attr('href');
            
            if (href && (href.includes('.woff') || href.includes('.ttf') || href.includes('.otf') || 
                        href.includes('.eot') || href.includes('.woff2'))) {
                try {
                    this.debugReport.totalAssets++;
                    const absoluteUrl = this.resolveUrl(href, baseURL.href);
                    const fileName = this.generateFileName(href, 'font');
                    const localPath = path.join('fonts', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    link.attr('href', localPath);
                    
                    console.log(` Downloaded font: ${fileName}`);
                    this.debugReport.successfulDownloads++;
                } catch (error) {
                    console.log(` Failed to download font: ${href}`, error.message);
                    // Keep original URL as fallback
                    this.debugReport.failedDownloads++;
                    this.failedAssets.push({ type: 'font', url: href, error: error.message });
                }
            }
        }
        
        // Process cursor files and other special assets
        const cursorElements = $('[style*="cursor"]');
        cursorElements.each((i, elem) => {
            const style = $(elem).attr('style');
            if (style && style.includes('url(')) {
                const cursorMatch = style.match(/cursor:\s*url\(['"]?([^'")\s]+)['"]?\)/);
                if (cursorMatch && cursorMatch[1].includes('.cur')) {
                    const cursorUrl = cursorMatch[1];
                    this.processSpecialAsset(cursorUrl, baseURL, outputDir, 'cursor', $(elem));
                }
            }
        });
    }
    
    /**
     * Process special assets like cursors, icons, etc.
     */
    async processSpecialAsset(url, baseURL, outputDir, type, element) {
        try {
            this.debugReport.totalAssets++;
            const absoluteUrl = this.resolveUrl(url, baseURL.href);
            const fileName = this.generateFileName(url, type);
            const localPath = path.join('assets', fileName);
            
            await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
            
            // Update the element's style attribute
            const currentStyle = element.attr('style') || '';
            const newStyle = currentStyle.replace(
                new RegExp(`url\\(['"]?${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\)`, 'g'),
                `url('${localPath}')`
            );
            element.attr('style', newStyle);
            
            console.log(` Downloaded ${type}: ${fileName}`);
            this.debugReport.successfulDownloads++;
        } catch (error) {
            console.log(` Failed to download ${type}: ${url}`, error.message);
            // Keep original URL as fallback
            this.debugReport.failedDownloads++;
            this.failedAssets.push({ type, url, error: error.message });
        }
    }

    /**
     * Process background images in CSS files
     */
    async processCSSBackgroundImages(cssFilePath, baseURL, outputDir) {
        try {
            const cssContent = await fs.readFile(cssFilePath, 'utf8');
            const backgroundImageRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
            let match;
            const backgroundImages = [];
            
            while ((match = backgroundImageRegex.exec(cssContent)) !== null) {
                backgroundImages.push(match[1]);
            }
            
            for (const imageUrl of backgroundImages) {
                try {
                    this.debugReport.totalAssets++;
                    const absoluteUrl = this.resolveUrl(imageUrl, baseURL.href);
                    const fileName = this.generateFileName(imageUrl, 'img');
                    const localPath = path.join('images', fileName);
                    
                    await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                    
                    // Replace in CSS content
                    const newCssContent = cssContent.replace(
                        new RegExp(`url\\(['"]?${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\)`, 'g'),
                        `url('${localPath}')`
                    );
                    
                    await fs.writeFile(cssFilePath, newCssContent, 'utf8');
                    console.log(` Downloaded background image: ${fileName}`);
                    this.debugReport.successfulDownloads++;
                } catch (error) {
                    console.log(` Failed to download background image: ${imageUrl}`, error.message);
                    // Keep original URL in CSS as fallback - don't modify the CSS file
                    this.debugReport.failedDownloads++;
                    this.failedAssets.push({ type: 'background-image', url: imageUrl, error: error.message });
                }
            }
        } catch (error) {
            console.log(` Failed to process CSS background images: ${cssFilePath}`, error.message);
        }
    }

    /**
     * Process picture elements and source tags
     */
    async processPictureElements($, baseURL, outputDir) {
        const pictures = $('picture');
        
        for (let i = 0; i < pictures.length; i++) {
            const picture = pictures.eq(i);
            const sources = picture.find('source');
            const img = picture.find('img');
            
            // Process source elements
            for (let j = 0; j < sources.length; j++) {
                const source = sources.eq(j);
                const srcset = source.attr('srcset');
                
                if (srcset) {
                    try {
                        // Handle srcset with multiple images
                        const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
                        
                        for (const srcsetUrl of srcsetUrls) {
                            const absoluteUrl = this.resolveUrl(srcsetUrl, baseURL.href);
                            const fileName = this.generateFileName(srcsetUrl, 'img');
                            const localPath = path.join('images', fileName);
                            
                            await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                            console.log(`📦 Downloaded picture source: ${fileName}`);
                            this.debugReport.successfulDownloads++;
                        }
                        
                        // Update srcset with local paths
                        const newSrcset = srcsetUrls.map(url => {
                            const fileName = this.generateFileName(url, 'img');
                            return `${path.join('images', fileName)} ${url.split(' ')[1] || ''}`.trim();
                        }).join(', ');
                        
                        source.attr('srcset', newSrcset);
                    } catch (error) {
                        console.log(` Failed to process picture source: ${srcset}`, error.message);
                        this.debugReport.failedDownloads++;
                        this.failedAssets.push({ type: 'picture-source', url: srcset, error: error.message });
                    }
                }
            }
            
            // Process img element in picture
            if (img.length > 0) {
                const src = img.attr('src');
                if (src) {
                    try {
                        this.debugReport.totalAssets++;
                        const absoluteUrl = this.resolveUrl(src, baseURL.href);
                        const fileName = this.generateFileName(src, 'img');
                        const localPath = path.join('images', fileName);
                        
                        await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                        img.attr('src', localPath);
                        
                        console.log(` Downloaded picture img: ${fileName}`);
                        this.debugReport.successfulDownloads++;
                    } catch (error) {
                        console.log(` Failed to download picture img: ${src}`, error.message);
                        this.debugReport.failedDownloads++;
                        this.failedAssets.push({ type: 'picture-img', url: src, error: error.message });
                    }
                }
            }
        }
    }

    /**
     * Process inline styles for background images
     */
    async processInlineStyles($, baseURL, outputDir) {
        const elementsWithInlineStyles = $('[style*="background"]');
        
        for (let i = 0; i < elementsWithInlineStyles.length; i++) {
            const element = elementsWithInlineStyles.eq(i);
            const style = element.attr('style');
            
            if (style) {
                const backgroundImageRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
                let match;
                
                while ((match = backgroundImageRegex.exec(style)) !== null) {
                    const imageUrl = match[1];
                    try {
                        const absoluteUrl = this.resolveUrl(imageUrl, baseURL.href);
                        const fileName = this.generateFileName(imageUrl, 'img');
                        const localPath = path.join('images', fileName);
                        
                        await this.downloadAsset(absoluteUrl, path.join(outputDir, localPath));
                        
                        // Replace in inline style
                        const newStyle = style.replace(
                            new RegExp(`url\\(['"]?${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\)`, 'g'),
                            `url('${localPath}')`
                        );
                        
                        element.attr('style', newStyle);
                        console.log(` Downloaded inline background image: ${fileName}`);
                        this.debugReport.successfulDownloads++;
                    } catch (error) {
                        console.log(` Failed to download inline background image: ${imageUrl}`, error.message);
                        this.debugReport.failedDownloads++;
                        this.failedAssets.push({ type: 'inline-background', url: imageUrl, error: error.message });
                    }
                }
            }
        }
    }

    /**
     * Process Google Fonts and inject locally if enabled
     */
    async processGoogleFonts($, baseURL, outputDir) {
        if (!this.options.injectGoogleFontsLocally) {
            return;
        }
        
        const googleFontLinks = $('link[href*="fonts.googleapis.com"]');
        
        for (let i = 0; i < googleFontLinks.length; i++) {
            const link = googleFontLinks.eq(i);
            const href = link.attr('href');
            
            if (href) {
                try {
                    console.log(' Processing Google Fonts for local injection...');
                    
                    // Download the Google Fonts CSS
                    const response = await axios.get(href, {
                        timeout: this.options.downloadTimeout,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    const googleFontsCSS = response.data;
                    
                    // Extract font URLs from the CSS
                    const fontUrlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
                    let match;
                    const fontUrls = [];
                    
                    while ((match = fontUrlRegex.exec(googleFontsCSS)) !== null) {
                        fontUrls.push(match[1]);
                    }
                    
                    // Download all font files
                    for (const fontUrl of fontUrls) {
                        try {
                            const fileName = this.generateFileName(fontUrl, 'font');
                            const localPath = path.join('fonts', fileName);
                            
                            await this.downloadAsset(fontUrl, path.join(outputDir, localPath));
                            console.log(` Downloaded Google Font: ${fileName}`);
                            this.debugReport.successfulDownloads++;
                        } catch (error) {
                            console.log(` Failed to download Google Font: ${fontUrl}`, error.message);
                            this.debugReport.failedDownloads++;
                            this.failedAssets.push({ type: 'google-font', url: fontUrl, error: error.message });
                        }
                    }
                    
                    // Replace Google Fonts link with local CSS
                    const localCSSPath = path.join('css', 'google-fonts-local.css');
                    await fs.writeFile(path.join(outputDir, localCSSPath), googleFontsCSS, 'utf8');
                    link.attr('href', localCSSPath);
                    
                    console.log(' Google Fonts converted to local files');
                } catch (error) {
                    console.log(`Failed to process Google Fonts: ${href}`, error.message);
                    this.debugReport.failedDownloads++;
                    this.failedAssets.push({ type: 'google-fonts', url: href, error: error.message });
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
                timeout: this.options.downloadTimeout || 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Accept 2xx and 3xx status codes
                }
            });

            // Check if response is actually an HTML error page instead of the expected asset
            const contentType = response.headers['content-type'] || '';
            const isHtmlResponse = contentType.includes('text/html') || contentType.includes('application/xhtml');
            
            if (isHtmlResponse) {
                // Convert buffer to string to check for HTML error indicators
                const responseText = response.data.toString('utf8');
                const isErrorPage = responseText.includes('<html') || 
                                   responseText.includes('<!DOCTYPE') || 
                                   responseText.includes('404') || 
                                   responseText.includes('Not Found') ||
                                   responseText.includes('Error');
                
                if (isErrorPage) {
                    throw new Error(`Server returned HTML error page instead of asset. Content-Type: ${contentType}`);
                }
            }

            await fs.writeFile(localPath, response.data);
            this.downloadedAssets.add(url);
            
        } catch (error) {
            console.log(` Failed to download: ${url}`, error.message);
            
            // Enhanced error logging
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Content-Type: ${error.response.headers['content-type'] || 'unknown'}`);
                console.log(`   Content-Length: ${error.response.headers['content-length'] || 'unknown'}`);
                
                // Log first 200 characters of response if it's text
                const contentType = error.response.headers['content-type'] || '';
                if (contentType.includes('text/')) {
                    const responseText = error.response.data.toString('utf8').substring(0, 200);
                    console.log(`   Response preview: ${responseText}...`);
                }
            }
            
            throw error;
        }
    }

    /**
     * Resolve relative URLs to absolute URLs with proper handling of ../ paths
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
        
        // Handle relative paths including ../ paths
        const url = new URL(baseUrl);
        const basePath = url.pathname;
        
        // Split the path into segments
        const pathSegments = basePath.split('/').filter(segment => segment !== '');
        const hrefSegments = href.split('/');
        
        // Handle ../ segments
        let relativeIndex = 0;
        for (let i = 0; i < hrefSegments.length; i++) {
            if (hrefSegments[i] === '..') {
                relativeIndex++;
            } else if (hrefSegments[i] !== '.') {
                break;
            }
        }
        
        // Remove the appropriate number of segments from the base path
        const finalPathSegments = pathSegments.slice(0, -relativeIndex);
        const finalHrefSegments = hrefSegments.slice(relativeIndex).filter(segment => segment !== '.');
        
        // Construct the final path
        const finalPath = '/' + [...finalPathSegments, ...finalHrefSegments].join('/');
        
        return `${url.protocol}//${url.host}${finalPath}`;
    }

    /**
     * Generate a filename for downloaded assets
     */
    generateFileName(url, type) {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // Try to preserve original extension
        let ext = path.extname(pathname);
        if (!ext) {
            ext = this.getDefaultExtension(type);
        }
        
        // Handle special file types
        if (url.includes('.cur')) ext = '.cur';
        if (url.includes('.ico')) ext = '.ico';
        if (url.includes('.woff')) ext = '.woff';
        if (url.includes('.woff2')) ext = '.woff2';
        if (url.includes('.ttf')) ext = '.ttf';
        if (url.includes('.otf')) ext = '.otf';
        if (url.includes('.eot')) ext = '.eot';
        
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
            'font': '.woff',
            'image': '.jpg',
            'background-image': '.jpg',
            'picture': '.jpg',
            'icon': '.ico',
            'cursor': '.cur',
            'audio': '.mp3',
            'video': '.mp4'
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
            phoneNumbers: [],
            emails: []
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
                            console.log(' Found hotel name:', text);
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
                        console.log(' Found address:', text);
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
                        console.log(' Found phone:', text);
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
                console.log(' Found phone from href:', phone);
            }
        });

        // 4. Detect email addresses
        const emailSelectors = [
            '.email', '.mail', '.contact',
            '[class*="email"]', '[class*="mail"]', '[class*="contact"]',
            'a[href^="mailto:"]'
        ];

        emailSelectors.forEach(selector => {
            $(selector).each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.includes('@') && text.length < 100) {
                    // Avoid duplicates
                    if (!detectedInfo.emails.includes(text)) {
                        detectedInfo.emails.push(text);
                        console.log(' Found email:', text);
                    }
                }
            });
        });

        // Also check href attributes for emails
        $('a[href^="mailto:"]').each((i, elem) => {
            const href = $(elem).attr('href');
            const email = href.replace(/^mailto:/, '');
            if (email.includes('@') && !detectedInfo.emails.includes(email)) {
                detectedInfo.emails.push(email);
                console.log(' Found email from href:', email);
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
     * Inject hotel data everywhere in the DOM (text, attributes, meta, JSON-LD, logos, icons)
     * with smart, context-aware, and logged replacements.
     */
    injectHotelData($, hotelData) {
        console.log(' Injecting hotel data (aggressive version)...');
        const log = { replaced: [], warnings: [] };

        // Helper: log replacements
        function logReplace(type, oldVal, newVal) {
            if (oldVal && oldVal !== newVal) {
                log.replaced.push({ type, from: oldVal, to: newVal });
                console.log(`[REPLACE][${type}] "${oldVal}" → "${newVal}"`);
            }
        }
        function logWarn(type, value) {
            log.warnings.push({ type, value });
            console.warn(`[WARN][${type}] Could not find/replace: ${value}`);
        }

        // Build aggressive regexes for partial/variant matches
        function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
        function smartRegex(str, type) {
            if (!str) return null;
            if (type === 'name') {
                // Match with or without "Hotel", allow whitespace/abbreviation, ignore case
                const base = escapeRegExp(str.replace(/Hotel|Otel/i, '').trim());
                return new RegExp(`\\b${base}\\s*(Hotel|Otel)?\\b`, 'gi');
            }
            if (type === 'address') {
                // For addresses, we need to be more careful to avoid partial matches
                // First try to match the entire address as a whole, but handle whitespace flexibly
                // First normalize whitespace to spaces, then escape special regex characters
                const normalizedStr = str.replace(/\s+/g, ' ').trim(); // Normalize all whitespace to single spaces
                const escapedStr = escapeRegExp(normalizedStr);
                const flexiblePattern = escapedStr.replace(/\\s/g, '\\s+'); // Make spaces flexible
                const fullAddressRegex = new RegExp(flexiblePattern, 'gi');
                
                console.log(` Creating address regex for: "${str}"`);
                console.log(` Escaped string: "${escapedStr}"`);
                console.log(` Normalized string: "${normalizedStr}"`);
                console.log(` Flexible pattern: "${flexiblePattern}"`);
                console.log(` Full regex: ${fullAddressRegex.source}`);
                
                // Create a more comprehensive partial regex that can match address segments
                // Split the address into meaningful parts and create patterns for each
                const addressParts = str.split(/[,\s]+/).filter(part => part.length > 2);
                let partialRegex = null;
                
                if (addressParts.length >= 3) {
                    // Create patterns for different combinations of address parts
                    const patterns = [];
                    
                    // Pattern 1: First 3 parts
                    if (addressParts.length >= 3) {
                        patterns.push(addressParts.slice(0, 3).map(escapeRegExp).join('\\s*[,\\s]*'));
                    }
                    
                    // Pattern 2: Last 3 parts
                    if (addressParts.length >= 3) {
                        patterns.push(addressParts.slice(-3).map(escapeRegExp).join('\\s*[,\\s]*'));
                    }
                    
                    // Pattern 3: Middle parts (if we have 4+ parts)
                    if (addressParts.length >= 4) {
                        const middleStart = Math.floor(addressParts.length / 2) - 1;
                        patterns.push(addressParts.slice(middleStart, middleStart + 3).map(escapeRegExp).join('\\s*[,\\s]*'));
                    }
                    
                    // Pattern 4: Any 3 consecutive parts
                    for (let i = 0; i <= addressParts.length - 3; i++) {
                        patterns.push(addressParts.slice(i, i + 3).map(escapeRegExp).join('\\s*[,\\s]*'));
                    }
                    
                    if (patterns.length > 0) {
                        // Remove duplicates and create regex
                        const uniquePatterns = [...new Set(patterns)];
                        partialRegex = new RegExp(`\\b(${uniquePatterns.join('|')})\\b`, 'gi');
                    }
                } else if (addressParts.length >= 2) {
                    // If we have 2 parts, match them together
                    const pattern = addressParts.map(escapeRegExp).join('\\s*[,\\s]*');
                    partialRegex = new RegExp(`\\b(${pattern})\\b`, 'gi');
                }
                
                return {
                    full: fullAddressRegex,
                    partial: partialRegex
                };
            }
            if (type === 'phone') {
                // Match any phone-like pattern (7+ digits)
                return /((\+\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{2,4})/g;
            }
            if (type === 'email') {
                return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            }
            return new RegExp(escapeRegExp(str), 'gi');
        }

        // Try to auto-detect old hotel info if not provided
        function autoDetect(selector, regex) {
            let found = '';
            $(selector).each((i, el) => {
                const text = $(el).text();
                // Reset regex state for each text element
                regex.lastIndex = 0;
                const match = regex.exec(text);
                if (match && match[0]) found = match[0];
            });
            return found;
        }

        // Improved address detection function
            function detectAddress() {
            // First try to get from hotelData
            if (hotelData.oldAddress) return hotelData.oldAddress;
            
            // Try to detect from various selectors with better regex patterns
            const addressSelectors = [
                'footer', '.footer', '.contact', '[class*=address]', '[id*=address]',
                '.address', '[class*=contact]', '[id*=contact]', '.info', '.details'
            ];
            
            const addressPatterns = [
                // Turkish address patterns
                /(Mah\.|Sok\.|Cad\.|No:|Adres|Adresi)[^<\n\r]{10,200}/gi,
                // English address patterns  
                /(Street|Ave|Avenue|Blvd|Boulevard|Road|Lane|Drive|Way)[^<\n\r]{10,200}/gi,
                // Postal code patterns
                /\d{5,}[^<\n\r]{10,200}/g,
                // General address-like text
                /[A-Za-zÇĞİÖŞÜçğıöşü\s,\.]{10,100}(Mah\.|Sok\.|Cad\.|Street|Ave|Road)/gi
            ];
            
            let detectedAddress = '';
            
            for (const selector of addressSelectors) {
                $(selector).each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.length < 10) return; // Skip very short text
                    
                    for (const pattern of addressPatterns) {
                        pattern.lastIndex = 0; // Reset regex state
                        const match = pattern.exec(text);
                        if (match && match[0] && match[0].length > 15) {
                            console.log(` Address detected in ${selector}: "${match[0]}"`);
                            detectedAddress = match[0].trim();
                            return false; // Break out of .each() loop
                        }
                    }
                });
                
                // If we found an address, return it immediately
                if (detectedAddress) {
                    return detectedAddress;
                }
            }
            
            return '';
        }

        const oldName = hotelData.oldName ||
            $('meta[property="og:site_name"]').attr('content') ||
            $('meta[property="og:title"]').attr('content') ||
            $('title').text() ||
            autoDetect('header, .header, .navbar, .brand, h1, h2', /[A-Za-z0-9\s\-]{4,}(Hotel|Otel)/i);
        const oldAddress = detectAddress();
        const oldPhone = hotelData.oldPhone ||
            autoDetect('footer, .footer, .contact, [class*=phone], [id*=phone]', /(\+?\d[\d\s\-()]{7,})/);
        const oldEmail = hotelData.oldEmail ||
            autoDetect('footer, .footer, .contact, [class*=mail], [id*=mail]', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        
        console.log(`🏨 Hotel data injection:`);
        console.log(`   Old name: "${oldName}"`);
        console.log(`   Old address: "${oldAddress}"`);
        console.log(`   Old phone: "${oldPhone}"`);
        console.log(`   Old email: "${oldEmail}"`);
        console.log(`   New name: "${hotelData.name}"`);
        console.log(`   New address: "${hotelData.address}"`);
        console.log(`   New phone: "${hotelData.phone}"`);
        console.log(`   New email: "${hotelData.email}"`);

        const nameRegex = smartRegex(oldName, 'name');
        const addressRegex = smartRegex(oldAddress, 'address');
        const phoneRegex = smartRegex(oldPhone, 'phone');
        const emailRegex = smartRegex(oldEmail, 'email');

        // Debug function to find address-like content
        function debugAddressContent() {
            console.log(`🔍 Scanning for address-like content in the document...`);
            let addressNodes = [];
            
            $('*').each((i, elem) => {
                $(elem).contents().each((j, node) => {
                    if (node.type === 'text' && node.data) {
                        const text = node.data.trim();
                        if (text.length > 10 && (
                            text.includes('Mah.') || text.includes('Sok.') || text.includes('Cad.') ||
                            text.includes('Street') || text.includes('Ave') || text.includes('Road') ||
                            text.includes('Adres') || text.includes('Address')
                        )) {
                            addressNodes.push({
                                text: text,
                                parent: $(elem).prop('tagName') + (elem.attribs?.class ? '.' + elem.attribs.class : ''),
                                length: text.length
                            });
                        }
                    }
                });
            });
            
            if (addressNodes.length > 0) {
                console.log(` Found ${addressNodes.length} text nodes with address-like content:`);
                addressNodes.forEach((node, index) => {
                    console.log(`   ${index + 1}. [${node.parent}] (${node.length} chars): "${node.text}"`);
                });
            } else {
                console.log(` No address-like content found in the document`);
            }
            
            return addressNodes;
        }

        // Log the generated regexes for debugging
        if (addressRegex) {
            console.log(` Address regex created:`);
            console.log(` Full regex: ${addressRegex.full}`);
            console.log(` Partial regex: ${addressRegex.partial}`);
            console.log(` Old address length: ${oldAddress ? oldAddress.length : 0} chars`);
            console.log(` New address length: ${hotelData.address ? hotelData.address.length : 0} chars`);
            console.log(` Old address: "${oldAddress}"`);
            console.log(` New address: "${hotelData.address}"`);
        } else {
            console.log(` No address regex created - oldAddress is empty or invalid`);
            // Run debug scan if oldAddress is empty
            debugAddressContent();
        }

        // Helper function for address replacement
        function replaceAddress(text, newAddress) {
            if (!addressRegex || !newAddress) return text;
            
            console.log(` Address replacement attempt: "${text}" → "${newAddress}"`);
            console.log(` Text length: ${text.length}, contains newlines: ${text.includes('\n')}, contains \r: ${text.includes('\r')}`);
            console.log(` Text JSON: ${JSON.stringify(text)}`);
            
            // First try to replace the full address
            if (addressRegex.full) {
                console.log(` Full regex pattern: ${addressRegex.full.source}`);
                console.log(` Full regex test result: ${addressRegex.full.test(text)}`);
                const fullMatch = addressRegex.full.exec(text);
                if (fullMatch) {
                    console.log(` Full regex match: "${fullMatch[0]}"`);
                }
                
                const fullReplaced = text.replace(addressRegex.full, newAddress);
                if (fullReplaced !== text) {
                    console.log(` Full address replacement: "${text}" → "${fullReplaced}"`);
                    return fullReplaced;
                } else {
                    console.log(` Full regex did not match, trying alternative approaches`);
                }
            }
            
            // If no full match, try to find address-like patterns in the text
            // Look for common address indicators and replace larger chunks
            const addressIndicators = [
                /(Mah\.|Sok\.|Cad\.|No:|Adres|Adresi)[^<\n\r]{5,100}/gi,
                /(Street|Ave|Avenue|Blvd|Boulevard|Road|Lane|Drive|Way)[^<\n\r]{5,100}/gi,
                /\d{5,}[^<\n\r]{5,100}/g
            ];
            
            for (const indicator of addressIndicators) {
                const matches = text.match(indicator);
                if (matches && matches.length > 0) {
                    console.log(`🔍 Address indicator found: ${matches.join(', ')}`);
                    
                    // Replace the largest match
                    const largestMatch = matches.reduce((a, b) => a.length > b.length ? a : b);
                    const replaced = text.replace(largestMatch, newAddress);
                    console.log(`✅ Address indicator replacement: "${text}" → "${replaced}"`);
                    return replaced;
                }
            }
            
            // If no address indicators found, try partial matches but be very careful
            if (addressRegex.partial) {
                const matches = text.match(addressRegex.partial);
                if (matches && matches.length > 0) {
                    console.log(` Partial matches found: ${matches.join(', ')}`);
                    
                    // Calculate the total length of all matches
                    const totalMatchLength = matches.join(' ').length;
                    const textLength = text.length;
                    const matchPercentage = (totalMatchLength / textLength) * 100;
                    
                    console.log(` Match analysis: ${totalMatchLength} chars matched out of ${textLength} total (${matchPercentage.toFixed(1)}%)`);
                    
                    // Only replace if we're matching a substantial portion (at least 30% of the text)
                    if (matchPercentage >= 30 && totalMatchLength >= 10) {
                        const partialReplaced = text.replace(addressRegex.partial, newAddress);
                        console.log(` Partial address replacement: "${text}" → "${partialReplaced}"`);
                        return partialReplaced;
                    } else {
                        console.log(` Partial matches too small (${matchPercentage.toFixed(1)}% of text), skipping replacement`);
                    }
                }
            }
            
            // Last resort: try to find any text that looks like an address and replace it
            if (text.length > 20 && (text.includes('Mah.') || text.includes('Sok.') || text.includes('Cad.') || 
                text.includes('Street') || text.includes('Ave') || text.includes('Road'))) {
                console.log(` Text contains address keywords, attempting manual replacement`);
                
                // Split text into sentences and look for address-like sentences
                const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
                for (const sentence of sentences) {
                    if (sentence.match(/(Mah\.|Sok\.|Cad\.|Street|Ave|Road|No:)/i)) {
                        const replaced = text.replace(sentence, newAddress);
                        console.log(` Manual address replacement: "${text}" → "${replaced}"`);
                        return replaced;
                    }
                }
            }
            
            console.log(` No address replacement made for: "${text}"`);
            return text;
        }

        // Aggressively replace in all text nodes and attributes
        const ATTRS = ['alt', 'title', 'placeholder', 'aria-label'];
        $('*').each((i, elem) => {
            // Text nodes
            $(elem).contents().each((j, node) => {
                if (node.type === 'text' && node.data) {
                    let text = node.data;
                    let orig = text;
                    if (hotelData.name && nameRegex) text = text.replace(nameRegex, hotelData.name);
                    if (hotelData.address) text = replaceAddress(text, hotelData.address);
                    if (hotelData.phone && phoneRegex) text = text.replace(phoneRegex, hotelData.phone);
                    if (hotelData.email && emailRegex) text = text.replace(emailRegex, hotelData.email);
                    if (text !== orig) logReplace('text', orig, text);
                    node.data = text;
                }
            });
            // Standard attributes
            ATTRS.forEach(attr => {
                const val = $(elem).attr(attr);
                if (val) {
                    let newVal = val;
                    if (hotelData.name && nameRegex) newVal = newVal.replace(nameRegex, hotelData.name);
                    if (hotelData.address) newVal = replaceAddress(newVal, hotelData.address);
                    if (hotelData.phone && phoneRegex) newVal = newVal.replace(phoneRegex, hotelData.phone);
                    if (hotelData.email && emailRegex) newVal = newVal.replace(emailRegex, hotelData.email);
                    if (newVal !== val) {
                        $(elem).attr(attr, newVal);
                        logReplace('attr:' + attr, val, newVal);
                    }
                }
            });
            // data-* attributes
            Object.keys(elem.attribs || {}).forEach(attr => {
                if (/^data-/.test(attr)) {
                    const val = $(elem).attr(attr);
                    if (val) {
                        let newVal = val;
                        if (hotelData.name && nameRegex) newVal = newVal.replace(nameRegex, hotelData.name);
                        if (hotelData.address) newVal = replaceAddress(newVal, hotelData.address);
                        if (hotelData.phone && phoneRegex) newVal = newVal.replace(phoneRegex, hotelData.phone);
                        if (hotelData.email && emailRegex) newVal = newVal.replace(emailRegex, hotelData.email);
                        if (newVal !== val) {
                            $(elem).attr(attr, newVal);
                            logReplace('attr:' + attr, val, newVal);
                        }
                    }
                }
            });
            // tel: and mailto: hrefs
            if (hotelData.phone && phoneRegex && $(elem).attr('href') && $(elem).attr('href').startsWith('tel:')) {
                const orig = $(elem).attr('href');
                const newVal = 'tel:' + hotelData.phone.replace(/\D/g, '');
                if (orig !== newVal) {
                    $(elem).attr('href', newVal);
                    logReplace('attr:href', orig, newVal);
                }
            }
            if (hotelData.email && emailRegex && $(elem).attr('href') && $(elem).attr('href').startsWith('mailto:')) {
                const orig = $(elem).attr('href');
                const newVal = 'mailto:' + hotelData.email;
                if (orig !== newVal) {
                    $(elem).attr('href', newVal);
                    logReplace('attr:href', orig, newVal);
                }
            }
        });

        // Meta tags and title
        const metaSelectors = [
            'title',
            'meta[name="description"]',
            'meta[property^="og:"]',
            'meta[name^="twitter:"]'
        ];
        metaSelectors.forEach(sel => {
            $(sel).each((i, el) => {
                let val = $(el).attr('content') || $(el).text();
                let orig = val;
                if (hotelData.name && nameRegex) val = val.replace(nameRegex, hotelData.name);
                if (hotelData.address) val = replaceAddress(val, hotelData.address);
                if (hotelData.phone && phoneRegex) val = val.replace(phoneRegex, hotelData.phone);
                if (hotelData.email && emailRegex) val = val.replace(emailRegex, hotelData.email);
                if ($(el).attr('content')) $(el).attr('content', val);
                else $(el).text(val);
                if (val !== orig) logReplace('meta:' + sel, orig, val);
            });
        });

        // JSON-LD and inline scripts
        $('script[type="application/ld+json"], script[type="application/json"], script:not([src])').each((i, el) => {
            let json = $(el).html();
            let orig = json;
            if (hotelData.name && nameRegex) json = json.replace(nameRegex, hotelData.name);
            if (hotelData.address) json = replaceAddress(json, hotelData.address);
            if (hotelData.phone && phoneRegex) json = json.replace(phoneRegex, hotelData.phone);
            if (hotelData.email && emailRegex) json = json.replace(emailRegex, hotelData.email);
            if (json !== orig) {
                $(el).html(json);
                logReplace('json-ld', orig, json);
            }
        });

        // --- LOGO DETECTION & REPLACEMENT ---
        let logoFound = false;
        $('img, svg, picture, source').each((i, el) => {
            const $el = $(el);
            const src = $el.attr('src') || '';
            const alt = $el.attr('alt') || '';
            const className = $el.attr('class') || '';
            const id = $el.attr('id') || '';
            // Detect logo by src, alt, class, id, or container
            const isLogo = /logo/i.test(src) || /logo/i.test(alt) || /logo/i.test(className) || /logo/i.test(id) ||
                $el.parents('header, nav, .logo, .brand, .navbar, [class*="logo"], [id*="logo"]').length > 0;
            if (isLogo && hotelData.logo) {
                const origSrc = $el.attr('src');
                $el.attr('src', hotelData.logo);
                $el.attr('alt', (hotelData.name || '') + ' logo');
                logReplace('logo', origSrc, hotelData.logo);
                logoFound = true;
            }
        });
        // Favicon & Apple-touch-icon
        $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && hotelData.logo) {
                $(el).attr('href', hotelData.logo);
                logReplace('icon', href, hotelData.logo);
            }
        });
        // Inject logo if missing
        if (!logoFound && hotelData.logo) {
            const $container = $('.logo, .brand, header, nav, .header, .navbar').first();
            if ($container.length) {
                $container.prepend(`<img src="${hotelData.logo}" alt="${hotelData.name || ''} logo" />`);
                logReplace('logo-injected', '', hotelData.logo);
            } else {
                logWarn('logo', 'No logo container found to inject logo');
            }
        }

        // Log summary
        if (log.replaced.length) {
            console.log(' Data injection replacements:');
            log.replaced.forEach(r => console.log(`  [${r.type}] ${r.from} → ${r.to}`));
        }
        if (log.warnings.length) {
            console.warn(' Data injection warnings:');
            log.warnings.forEach(w => console.warn(`  [${w.type}] Could not find/replace: ${w.value}`));
        }
        console.log(' Hotel data injected (aggressive version)');
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

    /**
     * Enhanced HTML cleanup with better encoding handling
     */
    cleanupHTML(html) {
        console.log('🔧 Performing enhanced HTML cleanup...');
        
        // Clean up encoding issues that might break the HTML
        html = html.replace(/\\u0027/g, "'");
        html = html.replace(/\\u002b/g, "+");
        html = html.replace(/\\u0026/g, "&");
        html = html.replace(/\\"/g, '"');
        html = html.replace(/\\n/g, '\n');
        html = html.replace(/\\t/g, '\t');
        
        // Ensure we have a proper DOCTYPE
        if (!html.includes('<!DOCTYPE html>')) {
            html = `<!DOCTYPE html>\n${html}`;
        }
        
        // Fix common HTML issues
        html = html.replace(/<script\s+src="([^"]+)"\s*>/gi, '<script src="$1"></script>');
        html = html.replace(/<link\s+href="([^"]+)"\s+rel="([^"]+)"\s*>/gi, '<link href="$1" rel="$2">');
        
        console.log('✅ HTML cleanup completed');
        return html;
    }

    /**
     * Fix broken references in the HTML
     */
    fixBrokenReferences($, baseUrl) {
        console.log('🔧 Fixing broken references...');
        
        // Fix relative URLs that might be broken
        $('a[href]').each((i, elem) => {
            const $elem = $(elem);
            const href = $elem.attr('href');
            
            if (href && href.startsWith('/') && !href.startsWith('//')) {
                // Convert absolute paths to relative if needed
                const relativePath = href.substring(1);
                $elem.attr('href', relativePath);
            }
        });
        
        // Fix form actions
        $('form[action]').each((i, elem) => {
            const $elem = $(elem);
            const action = $elem.attr('action');
            
            if (action && action.startsWith('/') && !action.startsWith('//')) {
                const relativePath = action.substring(1);
                $elem.attr('action', relativePath);
            }
        });
        
        console.log('✅ Broken references fixed');
    }

    /**
     * Generate comprehensive debug reports
     */
    async generateDebugReports(outputDir, hotelData, finalHTML) {
        console.log('📊 Generating debug reports...');
        
        // Generate detailed debug report
        const debugReport = {
            timestamp: new Date().toISOString(),
            hotelData,
            statistics: this.debugReport,
            failedAssets: this.failedAssets,
            htmlInfo: {
                length: finalHTML.length,
                hasDoctype: finalHTML.includes('<!DOCTYPE html>'),
                hasHtmlTag: finalHTML.includes('<html'),
                hasHead: finalHTML.includes('<head'),
                hasBody: finalHTML.includes('<body')
            }
        };
        
        await fs.writeFile(
            path.join(outputDir, 'debug-report.json'), 
            JSON.stringify(debugReport, null, 2), 
            'utf8'
        );
        
        // Generate HTML debug page
        const debugHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug Report - ${hotelData.name || 'Hotel'}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        h1 { color: green; }
        .debug { background: white; padding: 20px; border-radius: 5px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>🔍 Enhanced Debug Report</h1>
    
    <div class="debug">
        <h2>Hotel Data:</h2>
        <p><strong>Name:</strong> ${hotelData.name || 'N/A'}</p>
        <p><strong>Address:</strong> ${hotelData.address || 'N/A'}</p>
        <p><strong>Phone:</strong> ${hotelData.phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${hotelData.email || 'N/A'}</p>
    </div>
    
    <div class="debug">
        <h2>Asset Statistics:</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Assets</td><td>${this.debugReport.totalAssets}</td></tr>
            <tr><td>Successful Downloads</td><td class="success">${this.debugReport.successfulDownloads}</td></tr>
            <tr><td>Failed Downloads</td><td class="error">${this.debugReport.failedDownloads}</td></tr>
            <tr><td>Success Rate</td><td>${this.debugReport.successRate}%</td></tr>
            <tr><td>Duration</td><td>${this.debugReport.duration}ms</td></tr>
        </table>
    </div>
    
    <div class="debug">
        <h2>HTML File Info:</h2>
        <p><strong>File Size:</strong> ${finalHTML.length} characters</p>
        <p><strong>Has DOCTYPE:</strong> ${finalHTML.includes('<!DOCTYPE html>') ? 'Yes' : 'No'}</p>
        <p><strong>Has HTML tag:</strong> ${finalHTML.includes('<html') ? 'Yes' : 'No'}</p>
        <p><strong>Has Head:</strong> ${finalHTML.includes('<head') ? 'Yes' : 'No'}</p>
        <p><strong>Has Body:</strong> ${finalHTML.includes('<body') ? 'Yes' : 'No'}</p>
    </div>
    
    ${this.failedAssets.length > 0 ? `
    <div class="debug">
        <h2>Failed Assets (${this.failedAssets.length}):</h2>
        <table>
            <tr><th>Type</th><th>URL</th><th>Error</th></tr>
            ${this.failedAssets.map(asset => `
                <tr>
                    <td>${asset.type}</td>
                    <td>${asset.url}</td>
                    <td class="error">${asset.error}</td>
                </tr>
            `).join('')}
        </table>
    </div>
    ` : ''}
    
    <div class="debug">
        <h2>First 1000 characters of main HTML:</h2>
        <pre>${finalHTML.substring(0, 1000)}</pre>
    </div>
</body>
</html>`;
        
        await fs.writeFile(path.join(outputDir, 'debug-report.html'), debugHTML, 'utf8');
        
        // Generate simple test page
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
    <h1>✅ Enhanced Clone Test Page</h1>
    <div class="test">
        <p><strong>Hotel Name:</strong> ${hotelData.name || 'N/A'}</p>
        <p><strong>Address:</strong> ${hotelData.address || 'N/A'}</p>
        <p><strong>Phone:</strong> ${hotelData.phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${hotelData.email || 'N/A'}</p>
        <p>If you can see this styled page, the enhanced clone is working correctly!</p>
        <p><strong>Asset Success Rate:</strong> ${this.debugReport.successRate}%</p>
        <p><strong>Total Assets Processed:</strong> ${this.debugReport.totalAssets}</p>
    </div>
</body>
</html>`;
        
        await fs.writeFile(path.join(outputDir, 'simple-test.html'), simpleTestHTML, 'utf8');
        
        console.log('📊 Debug reports generated successfully');
    }
}

module.exports = WebsiteCloner; 