const fs = require('fs');
const path = require('path');
const handlebars = require('express-handlebars').create();

async function generateHotelSite(hotelData, themeName) {
  // 1. Load the template
  const templatePath = path.join(__dirname, '../../templates', themeName, 'index.hbs');
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = handlebars.handlebars.compile(templateSource);

  // 2. Generate HTML
  const html = template(hotelData);

  // 3. Create output directory
  const outputDir = path.join(__dirname, '../../sites', hotelData.name.replace(/\\s+/g, '-').toLowerCase());
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 4. Write HTML file
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);

  // 5. Copy CSS (if exists)
  const cssPath = path.join(__dirname, '../../templates', themeName, 'style.css');
  if (fs.existsSync(cssPath)) {
    fs.copyFileSync(cssPath, path.join(outputDir, 'style.css'));
  }

  // 6. (Optional) Copy logo if needed

  return outputDir;
}

module.exports = { generateHotelSite };