const fs = require('fs');
const path = require('path');
const handlebars = require('express-handlebars').create();

// Enhanced site generation with multiple themes
async function generateHotelSite(hotelData, themeName) {
  try {
    console.log('Generating site for hotel:', hotelData.name, 'with theme:', themeName);
    
    const templatePath = path.join(__dirname, '../../templates', themeName, 'index.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.handlebars.compile(templateSource);

    const html = template({
      ...hotelData,
      amenities: hotelData.amenities || [],
      images: hotelData.images || [],
      priceRange: hotelData.priceRange || { min: 0, max: 0 }
    });

    // Create output directory with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const hotelNameSlug = hotelData.name.replace(/\s+/g, '-').toLowerCase();
    const outputDir = path.join(__dirname, '../../sites', `${hotelNameSlug}-${timestamp}`);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'index.html'), html);

    const themeAssetsDir = path.join(__dirname, '../../templates', themeName, 'assets');
    if (fs.existsSync(themeAssetsDir)) {
      copyDirectory(themeAssetsDir, path.join(outputDir, 'assets'));
    }

    if (hotelData.logoUrl) {
      const logoPath = path.join(__dirname, '../uploads', path.basename(hotelData.logoUrl));
      if (fs.existsSync(logoPath)) {
        fs.copyFileSync(logoPath, path.join(outputDir, 'logo.png'));
      }
    }
    
    console.log('Site generation completed successfully!');
    console.log('Output directory:', outputDir);
    return outputDir;
  } catch (error) {
    throw new Error(`Failed to generate site: ${error.message}`);
  }
}

// Utility function to copy directory
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = {
  generateHotelSite
};