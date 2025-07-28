const express = require('express');
const WebsiteCloner = require('../services/websiteCloner');
const path = require('path');
const fs = require('fs-extra');
const router = express.Router();

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
    const { url, hotelData } = req.body;

    // Validate required fields
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }

    if (!hotelData || !hotelData.name) {
      return res.status(400).json({ 
        success: false, 
        error: 'hotelData with name is required' 
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
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

    // Ensure the sites directory exists
    await fs.ensureDir(path.join(__dirname, '../../sites'));

    // Clone the website using the existing WebsiteCloner service
    const cloner = new WebsiteCloner();
    await cloner.cloneSite(url, outputDir, hotelData);

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
      hotelData: {
        name: hotelData.name,
        phone: hotelData.phone,
        address: hotelData.address,
        email: hotelData.email
      },
      note: 'The cloned website maintains the original design while replacing hotel information with your provided data.'
    });

  } catch (err) {
    console.error('❌ Error cloning website:', err);
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