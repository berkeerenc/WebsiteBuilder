const axios = require('axios');

/**
 * Test script for the website cloning API
 * Run this with: node test-clone.js
 */

const BASE_URL = 'http://localhost:5000';

async function testWebsiteClone() {
  try {
    console.log('🧪 Testing website cloning API...\n');

    const testData = {
      url: 'https://www.example.com', // Replace with a real hotel website URL
      hotelData: {
        name: 'Grand Hotel Paris',
        phone: '+90 555 123 45 67',
        address: '123 Champs-Élysées, Paris, France',
        email: 'info@grandhotelparis.com',
        description: 'Luxury hotel in the heart of Paris',
        logo: 'https://example.com/logo.png'
      }
    };

    console.log('📤 Sending clone request...');
    console.log('URL:', testData.url);
    console.log('Hotel Data:', testData.hotelData);
    console.log('');

    const response = await axios.post(`${BASE_URL}/api/sites/clone`, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 seconds timeout
    });

    console.log('✅ Clone successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('🌐 Access your cloned site at:', `${BASE_URL}${response.data.siteUrl}`);

  } catch (error) {
    console.error('❌ Error testing clone:', error.response?.data || error.message);
  }
}

async function listSites() {
  try {
    console.log('📋 Listing all cloned sites...\n');

    const response = await axios.get(`${BASE_URL}/api/sites/list`);
    
    console.log('✅ Sites retrieved successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error listing sites:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting API tests...\n');
  
  // Test 1: Clone a website
  await testWebsiteClone();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: List all sites
  await listSites();
}

// Run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWebsiteClone, listSites }; 