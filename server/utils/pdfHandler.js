// server/utils/pdfHandler.js

const fs = require('fs');
const path = require('path');
const { uploadBufferToS3, deleteFileFromS3 } = require('./s3Helper');

/**
 * Δημιουργία φακέλου αν δεν υπάρχει (DEPRECATED - used only for local fallback)
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
    }
}

/**
 * Αποθήκευση PDF από base64 string (Updated για S3)
 * @param {string} base64String - The base64 encoded PDF
 * @param {string} documentType - Type of document (e.g., 'arxeio_symbashs')
 * @param {string} ergazomenosId - ID of the ergazomenos
 * @returns {Promise<string>} - S3 key (NOT local path!)
 */
async function savePdfFromBase64(base64String, documentType, ergazomenosId) {
    try {
        // Validation
        if (!base64String || !base64String.startsWith('data:application/pdf;base64,')) {
            throw new Error('Invalid base64 PDF string');
        }
        
        if (!documentType || !ergazomenosId) {
            throw new Error('Missing documentType or ergazomenosId');
        }
        
        // Remove prefix
        const base64Data = base64String.replace(/^data:application\/pdf;base64,/, '');
        
        // Convert to Buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Validate buffer size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
            throw new Error(`PDF too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max 10MB)`);
        }
        
        // Create filename
        const timestamp = Date.now();
        const filename = `${ergazomenosId}_${documentType}_${timestamp}.pdf`;
        
        // Generate S3 key
        const s3Key = `pdfs/${documentType}/${filename}`;
        
        console.log(`📤 Uploading PDF to S3: ${s3Key} (${(buffer.length / 1024).toFixed(2)}KB)`);
        
        // Upload to S3 (or local mock in dev)
        const uploadResult = await uploadBufferToS3(buffer, s3Key, 'application/pdf');
        
        if (!uploadResult.success) {
            throw new Error('S3 upload failed');
        }
        
        console.log(`✅ PDF saved: ${filename}`);
        console.log(`   S3 Key: ${s3Key}`);
        console.log(`   Location: ${uploadResult.s3Url || uploadResult.localPath}`);
        
        // Return S3 key (NOT local path!)
        return s3Key;
        
    } catch (error) {
        console.error(`❌ Failed to save PDF (${documentType}):`, error.message);
        throw error;
    }
}

/**
 * Διαγραφή PDF από S3 (Updated)
 * @param {string} s3Key - S3 key (e.g., 'pdfs/arxeio_symbashs/file.pdf')
 */
async function deletePdf(s3Key) {
    try {
        if (!s3Key) return;
        
        console.log(`🗑️  Deleting PDF from S3: ${s3Key}`);
        
        const deleteResult = await deleteFileFromS3(s3Key);
        
        if (deleteResult.success) {
            console.log(`✅ PDF deleted: ${s3Key}`);
        }
        
    } catch (error) {
        console.error(`❌ Failed to delete PDF:`, error.message);
    }
}

/**
 * LEGACY FUNCTION - Keep for backward compatibility with old local paths
 * Converts old local paths to S3 keys
 */
function convertLocalPathToS3Key(localPath) {
    // Old: /uploads/pdfs/arxeio_symbashs/file.pdf
    // New: pdfs/arxeio_symbashs/file.pdf
    if (!localPath) return null;
    
    return localPath
        .replace(/^\/uploads\//, '')
        .replace(/^uploads\//, '');
}

module.exports = {
    savePdfFromBase64,
    deletePdf,
    ensureDirectoryExists, // Keep for backward compatibility
    convertLocalPathToS3Key
};