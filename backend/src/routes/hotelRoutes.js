const express = require('express');
const Hotel = require('../models/Hotel');
const { generateHotelSite } = require('../services/siteGenerator');
const WebsiteCloner = require('../services/websiteCloner');
const multer = require('multer');
const path = require('path');
const uploadConfig = require('../config/upload');
const router = express.Router();

// Set up multer for file uploads with validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});

// File filter for image validation - only check file type, let multer handle size
const fileFilter = (req, file, cb) => {
  console.log('🔍 File validation:', {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    maxSize: uploadConfig.MAX_FILE_SIZE,
    allowedTypes: uploadConfig.ALLOWED_MIME_TYPES
  });
  
  // Only check file type in fileFilter, let multer limits handle size
  if (uploadConfig.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    console.log('✅ File type validation passed');
    cb(null, true);
  } else {
    console.log('❌ Invalid file type:', file.mimetype);
    cb(new Error(uploadConfig.ERROR_MESSAGES.INVALID_FILE_TYPE), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: uploadConfig.MAX_FILE_SIZE
  }
});

// Get all hotels (for selection)
router.get('/', async (req, res) => {
  try {
    const hotels = await Hotel.find({}, 'name logoUrl description contact.phone contact.address');
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get hotel details by ID
router.get('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new hotel (with file upload)
router.post('/', upload.single('logo'), async (req, res) => {
  try {
    console.log('🏨 Creating new hotel with data:', {
      body: req.body,
      file: req.file ? {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      } : null
    });

    const hotelData = {
      ...req.body,
      logoUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      contact: {
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        website: req.body.website
      },
      amenities: req.body.amenities ? req.body.amenities.split(',') : [],
      images: req.body.images ? req.body.images.split(',') : [],
      roomCount: parseInt(req.body.roomCount) || 0,
      rating: parseFloat(req.body.rating) || 0,
      priceRange: {
        min: parseInt(req.body.priceMin) || 0,
        max: parseInt(req.body.priceMax) || 0
      }
    };

    console.log('📝 Processed hotel data:', hotelData);

    const hotel = new Hotel(hotelData);
    await hotel.save();

    console.log('💾 Hotel saved to database:', hotel._id);

    // Generate the static site
    console.log('🌐 Generating static site...');
    await generateHotelSite(hotel.toObject(), hotel.theme);
    console.log('✅ Static site generated successfully');

    // Return the URL to the generated site
    const siteUrl = `/sites/${hotel.name.replace(/\s+/g, '-').toLowerCase()}/`;
    res.status(201).json({ 
      hotel, 
      siteUrl,
      message: 'Hotel created successfully' + (req.file ? ' with logo' : '')
    });
  } catch (err) {
    console.error('❌ Error creating hotel:', err);
    
    // Clean up uploaded file if hotel creation fails
    if (req.file) {
      const fs = require('fs-extra');
      try {
        await fs.remove(req.file.path);
        console.log('🗑️ Cleaned up uploaded file');
      } catch (cleanupErr) {
        console.error('Failed to cleanup uploaded file:', cleanupErr);
      }
    }
    res.status(400).json({ error: err.message });
  }
});

// Update hotel logo
router.put('/:id/logo', upload.single('logo'), async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    // Delete old logo if exists
    if (hotel.logoUrl && req.file) {
      const fs = require('fs-extra');
      const oldLogoPath = path.join(__dirname, '..', hotel.logoUrl);
      try {
        await fs.remove(oldLogoPath);
      } catch (err) {
        console.error('Failed to delete old logo:', err);
      }
    }

    // Update hotel with new logo
    hotel.logoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    await hotel.save();

    res.json({ 
      hotel, 
      message: 'Logo updated successfully',
      logoUrl: hotel.logoUrl
    });
  } catch (err) {
    // Clean up uploaded file if update fails
    if (req.file) {
      const fs = require('fs-extra');
      try {
        await fs.remove(req.file.path);
      } catch (cleanupErr) {
        console.error('Failed to cleanup uploaded file:', cleanupErr);
      }
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete hotel logo
router.delete('/:id/logo', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    // Delete logo file if exists
    if (hotel.logoUrl) {
      const fs = require('fs-extra');
      const logoPath = path.join(__dirname, '..', hotel.logoUrl);
      try {
        await fs.remove(logoPath);
      } catch (err) {
        console.error('Failed to delete logo file:', err);
      }
    }

    // Remove logo URL from database
    hotel.logoUrl = undefined;
    await hotel.save();

    res.json({ 
      hotel, 
      message: 'Logo deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create site from template
router.post('/:id/create-from-template', async (req, res) => {
  try {
    const { theme } = req.body;
    const hotel = await Hotel.findById(req.params.id);
    
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }
    
    if (!theme) {
      return res.status(400).json({ error: 'Theme is required' });
    }
    
    const outputDir = await generateHotelSite(hotel.toObject(), theme);
    const folderName = path.basename(outputDir);
    
    hotel.theme = theme;
    await hotel.save();
    const siteUrl = `/sites/${folderName}/`;
    res.json({ message: 'Site created successfully', siteUrl, hotel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone website from URL
router.post('/:id/create-from-url', async (req, res) => {
  try {
    const { url } = req.body;
    const hotel = await Hotel.findById(req.params.id);
    
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // Create output directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const hotelNameSlug = hotel.name.replace(/\s+/g, '-').toLowerCase();
    const outputDir = path.join(__dirname, '../../sites', `${hotelNameSlug}-cloned-${timestamp}`);
    
    // Prepare hotel data for injection
    console.log('Fetched hotel from DB:', hotel);
    const hotelData = {
      name: hotel.name,
      address: hotel.contact?.address || '',
      description: hotel.description || '',
      phone: hotel.contact?.phone || '',
      email: hotel.contact?.email || hotel.email || '',
      logo: hotel.logoUrl || ''
    };
    console.log('Prepared hotelData for cloner:', hotelData);
    
    // Clone the website
    const cloner = new WebsiteCloner();
    await cloner.cloneSite(url, outputDir, hotelData);
    
    const folderName = path.basename(outputDir);
    const siteUrl = `/sites/${folderName}/`;
    
    res.json({
      message: 'Website cloned successfully',
      siteUrl,
      hotel,
      originalUrl: url,
      note: 'Note: Some websites may block cloning and show a fallback template instead.'
    });
    
  } catch (err) {
    console.error('Error cloning website:', err);
    res.status(500).json({ 
      error: 'Failed to clone website: ' + err.message 
    });
  }
});

module.exports = router;