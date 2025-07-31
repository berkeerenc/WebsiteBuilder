const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  logoUrl: { type: String },
  description: { type: String },
  contact: {
    email: String,
    phone: String,
    address: String,
    website: String
  },
  images: [String], // Array of image URLs
  roomCount: { type: Number, default: 0 },
  amenities: [String], // Array of amenities
  rating: { type: Number, min: 0, max: 5, default: 0 },
  priceRange: {
    min: Number,
    max: Number
  },
  theme: { type: String, default: 'modern' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field on save
hotelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Hotel', hotelSchema);