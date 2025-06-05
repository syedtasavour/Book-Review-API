// AWS SDK Imports
import {
  S3Client,
  PutObjectCommand, // Upload objects
  GetObjectCommand, // Retrieve objects
  DeleteObjectCommand, // Delete objects
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // Generate pre-signed URLs

// Environment Configuration
import "dotenv/config";

// Error Handling
import { ApiError } from "./ApiError.js";

// File System Utilities
import fs from "fs";
import path from "path";
import mime from "mime-types"; // For determining content type based on file extensions

// Custom Utilities
import { compressMedia,compressPDF } from "./compressFiles.js";
// Configure AWS SDK v3

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3 Bucket Name
const bucketName = process.env.AWS_S3_BUCKET_NAME;

const uploadOnS3 = async (
  localFilePath,
  folderName = "",
  isPrivate = false,
  expiresIn = 3600
) => {
  let compressedFilePath = null;

  try {
    if (!localFilePath) {
      throw new ApiError(400, null, "Local file path is required.");
    }
    if (!bucketName) {
      throw new ApiError(500, null, "S3 bucket name is not configured.");
    }
    if (!fs.existsSync(localFilePath)) {
      throw new ApiError(404, null, `File not found: ${localFilePath}`);
    }

    const fileName = path.basename(localFilePath);
    const mimeType = mime.lookup(localFilePath);
    let compressionResult = { success: true, filePath: localFilePath };

    // Apply compression only for supported types
    if (["image/jpeg", "image/png", "image/gif"].includes(mimeType)) {
      compressionResult = await compressMedia(localFilePath, {
        maxWidth: 1024,
        quality: 35,
        format: "jpeg",
      });
    } else if (mimeType === "application/pdf") {
      compressionResult = await compressPDF(localFilePath, {
        optimize: true,
      });
    }

    if (!compressionResult.success) {
      throw new ApiError(500, null, `Compression failed: ${compressionResult.error}`);
    }

    compressedFilePath = compressionResult.filePath;
    const fileContent = await fs.promises.readFile(compressedFilePath);

    const baseFolder = isPrivate ? "private" : "public";
    const fullFolderPath = folderName ? `${baseFolder}/${folderName}` : baseFolder;
    const filePath = `${fullFolderPath}/${fileName}`;
    const contentType = mime.lookup(fileName) || "application/octet-stream";

    const uploadResult = await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: fileContent,
      ContentType: contentType,
    }));

    if (uploadResult.$metadata.httpStatusCode !== 200) {
      throw new ApiError(500, null, "Failed to upload file to S3.");
    }

    // Clean up compressed file (if different from original)
    if (compressedFilePath !== localFilePath && fs.existsSync(compressedFilePath)) {
      await fs.promises.unlink(compressedFilePath);
    }

    // Generate URL
    let fileUrl = `https://${bucketName}.s3.amazonaws.com/${filePath}`;
    if (isPrivate) {
      fileUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucketName, Key: filePath }),
        { expiresIn }
      );
    }

    return { success: true, url: fileUrl, key: filePath };

  } catch (error) {
    // Clean up temp file
    if (compressedFilePath && compressedFilePath !== localFilePath && fs.existsSync(compressedFilePath)) {
      await fs.promises.unlink(compressedFilePath);
    }

    throw new ApiError(500, null, `Failed to upload media: ${error.message}`);
  }
};

const getS3FileUrl = async (fileKey, isPrivate = false, expiresIn = 3600) => {
  try {
    if (!fileKey) throw new ApiError(403, null, "File key is required.");

    if (!isPrivate) {
      // ✅ Public file (Direct URL)
      return {
        success: true,
        url: `https://${bucketName}.s3.amazonaws.com/${fileKey}`,
      };
    }

    // ✅ Private file (Generate presigned URL)
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fileKey });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });

    return { success: true, url: signedUrl };
  } catch (error) {
    console.error("❌ Error getting S3 file URL:", error.message);
    return { success: false, error: error.message };
  }
};

// Function to delete a file from S3
const destroyMediaOnS3 = async (fileName) => {
  try {
    if (!fileName) throw new ApiError(500, null, "File name is required.");

    const filePath = fileName;
    const params = { Bucket: bucketName, Key: filePath };

    await s3.send(new DeleteObjectCommand(params));

    console.log(`🗑️ File deleted from S3: ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error(
      `❌ Error deleting file "${fileName}" from S3:`,
      error.message
    );
    return { success: false, error: error.message };
  }
};

export { uploadOnS3, destroyMediaOnS3, getS3FileUrl };
