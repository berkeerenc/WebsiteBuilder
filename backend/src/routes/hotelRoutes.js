const express = require('express');
const Hotel = require('../models/Hotel');
const router = express.Router();

// Create a new hotel
router.post('/', async (req, res) => {
  try {
    const hotel = new Hotel(req.body);
    await hotel.save();
    res.status(201).json(hotel);
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