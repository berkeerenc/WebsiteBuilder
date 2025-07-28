const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

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

       // Specific routes for HTML files to force correct Content-Type (MUST come before static middleware)
       app.get('/sites/:folder/index.html', (req, res) => {
         const filePath = path.join(__dirname, '../sites', req.params.folder, 'index.html');
         console.log('📄 Serving HTML file:', filePath);
         
         // Force HTML content type
         res.setHeader('Content-Type', 'text/html; charset=utf-8');
         res.setHeader('X-Content-Type-Options', 'nosniff');
         
         // Read file and send with explicit HTML content type
         fs.readFile(filePath, 'utf8', (err, data) => {
           if (err) {
             console.error('❌ Error reading HTML file:', err);
             res.status(500).send('Error loading HTML file');
           } else {
             res.send(data);
           }
         });
       });

app.get('/sites/:folder/test.html', (req, res) => {
  const filePath = path.join(__dirname, '../sites', req.params.folder, 'test.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(filePath);
});

app.get('/sites/:folder/debug.html', (req, res) => {
  const filePath = path.join(__dirname, '../sites', req.params.folder, 'debug.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(filePath);
});

app.get('/sites/:folder/simple-test.html', (req, res) => {
  const filePath = path.join(__dirname, '../sites', req.params.folder, 'simple-test.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(filePath);
});

// Route for folder root (redirects to index.html)
app.get('/sites/:folder/', (req, res) => {
  const filePath = path.join(__dirname, '../sites', req.params.folder, 'index.html');
  console.log('📄 Serving folder root, redirecting to:', filePath);
  
  // Force HTML content type
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Read file and send with explicit HTML content type
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ Error reading HTML file:', err);
      res.status(500).send('Error loading HTML file');
    } else {
      res.send(data);
    }
  });
});

// Serve static files (CSS, JS, images) - MUST come after specific routes
app.use('/sites', express.static(path.join(__dirname, '../sites')));

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Hotel Website Builder Backend');
});

// Test route to verify HTML serving works
app.get('/test-html', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test HTML</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
            h1 { color: blue; }
            .test { background: white; padding: 20px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1>✅ HTML Test Page</h1>
        <div class="test">
            <p>If you can see this styled page, HTML serving is working correctly!</p>
            <p>This means the server can serve HTML files properly.</p>
            <p><strong>Current time:</strong> ${new Date().toLocaleString()}</p>
        </div>
    </body>
    </html>
  `);
});

const hotelRoutes = require('./routes/hotelRoutes')
const siteRoutes = require('./routes/siteRoutes')

app.use('/api/hotels', hotelRoutes)
app.use('/api/sites', siteRoutes)


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});