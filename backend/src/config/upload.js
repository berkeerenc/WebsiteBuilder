/**
 * Upload configuration settings
 * Easy to adjust file size limits and other upload settings
 */

module.exports = {
  // File size limits (in bytes)
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB (temporarily increased)
  
  // Allowed file types
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/svg+xml',
    'image/gif',
    'image/webp'
  ],
  
  // File extensions for validation
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.svg', '.gif', '.webp'],
  
  // Upload directory
  UPLOAD_DIR: 'uploads',
  
  // File naming
  FILE_PREFIX: 'logo-',
  
  // Error messages
  ERROR_MESSAGES: {
    FILE_TOO_LARGE: 'File size too large. Maximum size is 50MB.',
    INVALID_FILE_TYPE: 'Only image files are allowed (PNG, JPG, JPEG, SVG, GIF, WEBP)',
    UPLOAD_FAILED: 'Failed to upload file. Please try again.'
  }
}; 