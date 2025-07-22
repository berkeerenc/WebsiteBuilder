const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));


app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Hotel Website Builder Backend');
});

const hotelRoutes = require('./routes/hotelRoutes')
app.use('/api/hotels', hotelRoutes)


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});