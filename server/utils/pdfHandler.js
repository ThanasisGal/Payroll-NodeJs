// server/utils/pdfHandler.js

const fs = require('fs');
const path = require('path');
const { uploadBufferToS3, deleteFileFromS3 } = require('./s3Helper');

/**
 * Δημιουργία φακέλου αν δεν υπάρχει
 * DEPRECATED - used only for local fallback
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
    }
}

/**
 * Καθαρίζει τιμές για ασφαλή χρήση σε S3 key / filename
 */
function sanitizeForS3(value, fallback = 'unknown') {
    const cleaned = String(value || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[\/\\:*?"<>|#%{}^~[\]`;@=&+$,]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return cleaned || fallback;
}

/**
 * Αποθήκευση PDF από base64 string σε S3
 *
 * @param {string} base64String - The base64 encoded PDF
 * @param {string} documentType - Type of document, e.g. 'allodapoi'
 * @param {string} ergazomenosId - ID of the ergazomenos
 * @param {object} options - Extra data for readable S3 path
 * @returns {Promise<string>} - S3 key
 */
async function savePdfFromBase64(base64String, documentType, ergazomenosId, options = {}) {
    try {
        if (!base64String || !base64String.startsWith('data:application/pdf;base64,')) {
            throw new Error('Invalid base64 PDF string');
        }

        if (!documentType || !ergazomenosId) {
            throw new Error('Missing documentType or ergazomenosId');
        }

        const base64Data = base64String.replace(/^data:application\/pdf;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const MAX_SIZE = 10 * 1024 * 1024;

        if (buffer.length > MAX_SIZE) {
            throw new Error(
                `PDF too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max 10MB)`
            );
        }

        const timestamp = Date.now();

        let s3Key;

        if (['allodapoi', 'anhlikoi', 'symbash_daneismoy'].includes(documentType)) {
            const userTeam = sanitizeForS3(options.userTeam);
            const companyKodikos = sanitizeForS3(options.companyKodikos);
            const eponymo = sanitizeForS3(options.eponymo);
            const onoma = sanitizeForS3(options.onoma);

            const filename = `${ergazomenosId}_${eponymo}_${onoma}_${timestamp}.pdf`;

            s3Key = path.posix.join('pdfs', documentType, userTeam, companyKodikos, filename);
        } else {
            const filename = `${ergazomenosId}_${documentType}_${timestamp}.pdf`;

            s3Key = path.posix.join('pdfs', documentType, filename);
        }

        console.log(`📤 Uploading PDF to S3: ${s3Key} (${(buffer.length / 1024).toFixed(2)}KB)`);

        const uploadResult = await uploadBufferToS3(buffer, s3Key, 'application/pdf');

        if (!uploadResult.success) {
            throw new Error('S3 upload failed');
        }

        console.log(`✅ PDF saved`);
        console.log(`🔑 S3 Key: ${s3Key}`);
        console.log(`📍 Location: ${uploadResult.s3Url || uploadResult.localPath}`);

        return s3Key;
    } catch (error) {
        console.error(`❌ Failed to save PDF (${documentType}):`, error.message);
        throw error;
    }
}

/**
 * Διαγραφή PDF από S3
 *
 * @param {string} s3Key - S3 key
 */
async function deletePdf(s3Key) {
    try {
        if (!s3Key) return;

        console.log(`🗑️ Deleting PDF from S3: ${s3Key}`);

        const deleteResult = await deleteFileFromS3(s3Key);

        if (deleteResult.success) {
            console.log(`✅ PDF deleted: ${s3Key}`);
        }
    } catch (error) {
        console.error(`❌ Failed to delete PDF:`, error.message);
    }
}

/**
 * LEGACY FUNCTION
 * Converts old local paths to S3 keys
 */
function convertLocalPathToS3Key(localPath) {
    if (!localPath) return null;

    return localPath.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
}

module.exports = {
    savePdfFromBase64,
    deletePdf,
    ensureDirectoryExists,
    convertLocalPathToS3Key
};
