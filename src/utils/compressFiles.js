// Import external packages
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import internal utilities
import { ApiError } from './ApiError.js';


async function compressMedia(localFilePath, options = {}) {
  try {
    if (!localFilePath) throw new ApiError(404, null, 'Local file path is required.');

    // Validate file existence
    if (!fs.existsSync(localFilePath)) {
      throw new ApiError(404, null, `File not found: ${localFilePath}`);
    }

    // Validate file type
    const fileExtension = path.extname(localFilePath).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!validExtensions.includes(fileExtension)) {
      throw new ApiError(400, null, 'Unsupported file type for compression.');
    }

    const fileName = path.basename(localFilePath);
    // Use public/temp directory as per error log
    const tempDir = path.join(__dirname, 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }
    const compressedFilePath = path.join(tempDir, `compressed-${Date.now()}-${fileName}`);

    // Default compression options
    const { maxWidth = 1024, quality = 35, format = 'jpeg' } = options;

    // Compress image
    await sharp(localFilePath)
      .resize({ width: maxWidth, fit: 'contain' })
      .toFormat(format, { quality })
      .toFile(compressedFilePath);

    // Verify compressed file exists
    if (!fs.existsSync(compressedFilePath)) {
      throw new ApiError(500, null, 'Failed to create compressed file.');
    }

    console.log('Image compressed successfully:', compressedFilePath);

    return { success: true, filePath: compressedFilePath, isCompressed: true };
  } catch (error) {
    console.error('Error compressing image:', error.message);
    return { success: false, error: error.message, isCompressed: false };
  }
}










export { compressMedia };