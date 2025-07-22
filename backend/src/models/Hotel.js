const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  logoUrl: { type: String },
  contact: {
    email: String,
    phone: String,
    address: String
  },
  theme: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hotel', hotelSchema);