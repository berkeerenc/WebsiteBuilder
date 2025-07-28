const express = require('express');
const Hotel = require('../models/Hotel');
const { generateHotelSite } = require('../services/siteGenerator');
const WebsiteCloner = require('../services/websiteCloner');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

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
    const hotel = new Hotel(hotelData);
    await hotel.save();

    // Generate the static site
    await generateHotelSite(hotel.toObject(), hotel.theme);

    // Return the URL to the generated site
    const siteUrl = `/sites/${hotel.name.replace(/\s+/g, '-').toLowerCase()}/`;
    res.status(201).json({ hotel, siteUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    const hotelData = {
      name: hotel.name,
      address: hotel.contact?.address || '',
      description: hotel.description || '',
      phone: hotel.contact?.phone || '',
      email: hotel.contact?.email || '',
      logo: hotel.logoUrl || ''
    };
    
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