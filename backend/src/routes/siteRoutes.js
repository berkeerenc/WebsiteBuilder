const express = require('express');
const WebsiteCloner = require('../services/websiteCloner');
const path = require('path');
const fs = require('fs-extra');
const router = express.Router();
const Hotel = require('../models/Hotel');

/**
 * POST /api/sites/clone
 * Clone a website from URL and replace hotel information
 * 
 * Request body:
 * {
 *   "url": "https://www.example-hotel.com",
 *   "hotelData": {
 *     "name": "Grand Hotel",
 *     "phone": "+90 555 123 45 67", 
 *     "address": "Paris, France",
 *     "email": "info@grandhotel.com",
 *     "description": "Luxury hotel in the heart of Paris",
 *     "logo": "https://example.com/logo.png"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "siteUrl": "/sites/grand-hotel-cloned-2024-01-15-10-30/",
 *   "outputPath": "sites/grand-hotel-cloned-2024-01-15-10-30",
 *   "message": "Website cloned successfully"
 * }
 */
router.post('/clone', async (req, res) => {
  try {
    console.log('📥 Received clone request');
    const { url, hotelId } = req.body;

    // Validate required fields
    if (!url) {
      console.log('❌ Missing URL in request');
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }
    if (!hotelId) {
      console.log('❌ Missing hotelId in request');
      return res.status(400).json({ 
        success: false, 
        error: 'hotelId is required' 
      });
    }

    // Fetch hotel from DB
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      console.log('❌ Hotel not found for id:', hotelId);
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }
    console.log('Fetched hotel from DB:', hotel);

    // Prepare hotelData from DB
    const hotelData = {
      name: hotel.name,
      address: hotel.contact?.address || '',
      description: hotel.description || '',
      phone: hotel.contact?.phone || '',
      email: hotel.contact?.email || hotel.email || '',
      logo: hotel.logoUrl || ''
    };
    console.log('Prepared hotelData for cloner:', hotelData);

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      console.log('❌ Invalid URL format:', url);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid URL format' 
      });
    }

    console.log(`🚀 Starting website clone for: ${url}`);
    console.log(`🏨 Hotel data:`, hotelData);

    // Create output directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const hotelNameSlug = hotelData.name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const outputDir = path.join(__dirname, '../../sites', `${hotelNameSlug}-cloned-${timestamp}`);

    console.log(`📁 Output directory: ${outputDir}`);

    // Ensure the sites directory exists
    await fs.ensureDir(path.join(__dirname, '../../sites'));
    console.log('✅ Sites directory ensured');

    // Clone the website using the existing WebsiteCloner service
    console.log('🔧 Creating WebsiteCloner instance...');
    const cloner = new WebsiteCloner();
    console.log('✅ WebsiteCloner instance created');

    console.log('🚀 Starting clone process...');
    await cloner.cloneSite(url, outputDir, hotelData);
    console.log('✅ Clone process completed');

    // Get the folder name for the URL
    const folderName = path.basename(outputDir);
    const siteUrl = `/sites/${folderName}/`;

    console.log(`✅ Website cloned successfully to: ${outputDir}`);
    console.log(`🌐 Site accessible at: ${siteUrl}`);

    res.json({
      success: true,
      siteUrl,
      outputPath: outputDir,
      folderName,
      message: 'Website cloned successfully',
      originalUrl: url,
      hotelData,
      note: 'The cloned website maintains the original design while replacing hotel information with your provided data.'
    });

  } catch (err) {
    console.error('❌ Error cloning website:', err);
    console.error('📋 Stack trace:', err.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clone website: ' + err.message 
    });
  }
});

/**
 * GET /api/sites/list
 * List all cloned sites
 */
router.get('/list', async (req, res) => {
  try {
    const sitesDir = path.join(__dirname, '../../sites');
    const sites = [];

    if (await fs.pathExists(sitesDir)) {
      const folders = await fs.readdir(sitesDir);
      
      for (const folder of folders) {
        const folderPath = path.join(sitesDir, folder);
        const stats = await fs.stat(folderPath);
        
        if (stats.isDirectory()) {
          const indexPath = path.join(folderPath, 'index.html');
          const hasIndex = await fs.pathExists(indexPath);
          
          sites.push({
            folderName: folder,
            siteUrl: `/sites/${folder}/`,
            createdAt: stats.birthtime,
            hasIndex: hasIndex,
            size: stats.size
          });
        }
      }
    }

    res.json({
      success: true,
      sites: sites.sort((a, b) => b.createdAt - a.createdAt)
    });

  } catch (err) {
    console.error('❌ Error listing sites:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list sites: ' + err.message 
    });
  }
});

/**
 * DELETE /api/sites/:folderName
 * Delete a cloned site
 */
router.delete('/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const sitePath = path.join(__dirname, '../../sites', folderName);

    if (!await fs.pathExists(sitePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Site not found' 
      });
    }

    await fs.remove(sitePath);
    
    res.json({
      success: true,
      message: `Site ${folderName} deleted successfully`
    });

  } catch (err) {
    console.error('❌ Error deleting site:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete site: ' + err.message 
    });
  }
});

module.exports = router; 