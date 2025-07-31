/**
 * Frontend upload configuration
 * Matches backend settings for consistency
 */

export const uploadConfig = {
  // File size limits (in bytes)
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  
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
  
  // Error messages
  ERROR_MESSAGES: {
    FILE_TOO_LARGE: 'File size too large. Maximum size is 20MB.',
    INVALID_FILE_TYPE: 'Please select an image file (PNG, JPG, SVG, GIF, WEBP)',
    UPLOAD_FAILED: 'Failed to upload file. Please try again.'
  },
  
  // UI text
  UI_TEXT: {
    UPLOAD_HINT: 'PNG, JPG, SVG, WEBP up to 20MB',
    UPLOAD_PLACEHOLDER: 'Click to upload logo'
  }
}; 