# Website Cloning API Documentation

## Overview

This API allows you to clone any website and replace the original hotel's information with your own hotel data while maintaining the exact same design, CSS, JS, and assets.

## Base URL

```
http://localhost:5000
```

## Endpoints

### 1. Clone Website

**POST** `/api/sites/clone`

Clones a website from a given URL and replaces hotel information with your provided data.

#### Request Body

```json
{
  "url": "https://www.example-hotel.com",
  "hotelData": {
    "name": "Grand Hotel",
    "phone": "+90 555 123 45 67",
    "address": "Paris, France",
    "email": "info@grandhotel.com",
    "description": "Luxury hotel in the heart of Paris",
    "logo": "https://example.com/logo.png"
  }
}
```

#### Response

```json
{
  "success": true,
  "siteUrl": "/sites/grand-hotel-cloned-2024-01-15-10-30/",
  "outputPath": "sites/grand-hotel-cloned-2024-01-15-10-30",
  "folderName": "grand-hotel-cloned-2024-01-15-10-30",
  "message": "Website cloned successfully",
  "originalUrl": "https://www.example-hotel.com",
  "hotelData": {
    "name": "Grand Hotel",
    "phone": "+90 555 123 45 67",
    "address": "Paris, France",
    "email": "info@grandhotel.com"
  },
  "note": "The cloned website maintains the original design while replacing hotel information with your provided data."
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

### 2. List All Cloned Sites

**GET** `/api/sites/list`

Returns a list of all cloned websites.

#### Response

```json
{
  "success": true,
  "sites": [
    {
      "folderName": "grand-hotel-cloned-2024-01-15-10-30",
      "siteUrl": "/sites/grand-hotel-cloned-2024-01-15-10-30/",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "hasIndex": true,
      "size": 1024
    }
  ]
}
```

### 3. Delete Cloned Site

**DELETE** `/api/sites/:folderName`

Deletes a specific cloned website.

#### Response

```json
{
  "success": true,
  "message": "Site grand-hotel-cloned-2024-01-15-10-30 deleted successfully"
}
```

## Usage Examples

### cURL Example

```bash
curl -X POST http://localhost:5000/api/sites/clone \
-H "Content-Type: application/json" \
-d '{
  "url": "https://www.example-hotel.com",
  "hotelData": {
    "name": "Grand Hotel",
    "phone": "+90 555 123 45 67",
    "address": "Paris, France",
    "email": "info@grandhotel.com"
  }
}'
```

### JavaScript Example

```javascript
const axios = require('axios');

async function cloneWebsite() {
  try {
    const response = await axios.post('http://localhost:5000/api/sites/clone', {
      url: 'https://www.example-hotel.com',
      hotelData: {
        name: 'Grand Hotel',
        phone: '+90 555 123 45 67',
        address: 'Paris, France',
        email: 'info@grandhotel.com'
      }
    });

    console.log('Site cloned successfully!');
    console.log('Access at:', `http://localhost:5000${response.data.siteUrl}`);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

cloneWebsite();
```

### Python Example

```python
import requests
import json

def clone_website():
    url = "http://localhost:5000/api/sites/clone"
    data = {
        "url": "https://www.example-hotel.com",
        "hotelData": {
            "name": "Grand Hotel",
            "phone": "+90 555 123 45 67",
            "address": "Paris, France",
            "email": "info@grandhotel.com"
        }
    }
    
    response = requests.post(url, json=data)
    
    if response.status_code == 200:
        result = response.json()
        print("Site cloned successfully!")
        print(f"Access at: http://localhost:5000{result['siteUrl']}")
    else:
        print("Error:", response.json())

clone_website()
```

## Features

### What Gets Cloned

- ✅ Complete HTML structure
- ✅ All CSS files (styles remain unchanged)
- ✅ All JavaScript files (functionality preserved)
- ✅ All images and media files
- ✅ Fonts and other assets
- ✅ Relative paths updated for offline use

### What Gets Replaced

- 🏨 Hotel name
- 📞 Phone numbers
- 📍 Addresses
- 📧 Email addresses
- 📝 Descriptions
- 🖼️ Logo (if specified)

### Smart Detection

The system automatically detects:
- Hotel names in the original website
- Phone number patterns
- Address patterns
- Email addresses
- Common hotel-related text

### Fallback Handling

If a website cannot be cloned (due to blocking, dynamic content, etc.), the system creates a fallback template with your hotel information.

## Technical Details

### Supported Website Types

1. **Static Websites**: Uses axios + cheerio for fast cloning
2. **Dynamic Websites (SPA)**: Uses Puppeteer for full rendering
3. **Blocked Websites**: Creates fallback template

### Asset Processing

- Downloads all linked CSS, JS, and image files
- Updates all asset paths to be relative
- Handles both HTTP and HTTPS URLs
- Supports query parameters and complex URLs

### Output Structure

```
sites/
└── hotel-name-cloned-timestamp/
    ├── index.html
    ├── css/
    │   └── (all CSS files)
    ├── js/
    │   └── (all JS files)
    ├── images/
    │   └── (all images)
    └── (other assets)
```

## Error Handling

The API handles various error scenarios:

- Invalid URL format
- Network timeouts
- Blocked websites
- Missing hotel data
- File system errors

## Testing

Run the test script to verify the API:

```bash
cd backend
node test-clone.js
```

## Notes

- Cloned sites are saved with timestamps to avoid conflicts
- All assets are downloaded locally for offline use
- The original design is preserved 100%
- Only hotel-related text content is replaced
- Sites are accessible via the returned URL immediately after cloning 