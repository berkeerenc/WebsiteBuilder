const express = require('express');
const Hotel = require('../models/Hotel');
const { generateHotelSite } = require('../services/siteGenerator');
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

// Create a new hotel (with file upload)
router.post('/', upload.single('logo'), async (req, res) => {
  try {
    const hotelData = {
      ...req.body,
      logoUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      contact: {
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address
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

// Get all hotels (for testing)
router.get('/', async (req, res) => {
  const hotels = await Hotel.find();
  res.json(hotels);
});

module.exports = router;