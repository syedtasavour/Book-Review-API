// Import external packages
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Setup dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import internal utilities
import { ApiError } from "./ApiError.js";
const TEMP_DIR = path.resolve("public", "temp");
async function compressMedia(localFilePath, options = {}) {
  try {
    if (!localFilePath) throw new ApiError(404, null, "Local file path is required.");

    if (!fs.existsSync(localFilePath)) {
      throw new ApiError(404, null, `File not found: ${localFilePath}`);
    }

    const fileExtension = path.extname(localFilePath).toLowerCase();
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    if (!validExtensions.includes(fileExtension)) {
      throw new ApiError(400, null, "Unsupported file type for compression.");
    }

    const fileName = path.basename(localFilePath);

    if (!fs.existsSync(TEMP_DIR)) {
      await fs.promises.mkdir(TEMP_DIR, { recursive: true });
    }

    const compressedFilePath = path.join(TEMP_DIR, `compressed-${Date.now()}-${fileName}`);

    const { maxWidth = 1024, quality = 35, format = "jpeg" } = options;

    await sharp(localFilePath)
      .resize({ width: maxWidth, fit: "contain" })
      .toFormat(format, { quality })
      .toFile(compressedFilePath);

    if (!fs.existsSync(compressedFilePath)) {
      throw new ApiError(500, null, "Failed to create compressed file.");
    }
await fs.promises.unlink(localFilePath);
    console.log("Image compressed successfully:", compressedFilePath);

    return { success: true, filePath: compressedFilePath, isCompressed: true };
  } catch (error) {
    await fs.promises.unlink(localFilePath);
    return { success: false, error: error.message, isCompressed: false };
  }
}


const compressPDF = async (localFilePath, options = {}) => {
  try {
    if (!localFilePath) throw new ApiError(404, null, "Local file path is required.");

    if (!fs.existsSync(localFilePath)) {
      throw new ApiError(404, null, `File not found: ${localFilePath}`);
    }

    const fileExtension = path.extname(localFilePath).toLowerCase();
    if (fileExtension !== ".pdf") {
      throw new ApiError(400, null, "Only PDF files are supported.");
    }

    const fileName = path.basename(localFilePath);

    if (!fs.existsSync(TEMP_DIR)) {
      await fs.promises.mkdir(TEMP_DIR, { recursive: true });
    }

    const compressedFilePath = path.join(TEMP_DIR, `compressed-${Date.now()}-${fileName}`);

    const { optimize = true } = options;

    const pdfBytes = await fs.promises.readFile(localFilePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // pdf-lib doesn't support advanced compression yet
    const compressedPdfBytes = await pdfDoc.save({ useObjectStreams: true });

    await fs.promises.writeFile(compressedFilePath, compressedPdfBytes);

    if (!fs.existsSync(compressedFilePath)) {
      throw new ApiError(500, null, "Failed to create compressed PDF.");
    }

   await fs.promises.unlink(localFilePath);

    return { success: true, filePath: compressedFilePath, isCompressed: true };
  } catch (error) {
    await fs.promises.unlink(localFilePath);
    return { success: false, error: error.message, isCompressed: false };
  }
};


export { compressMedia, compressPDF };
