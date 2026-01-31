// server/utils/s3UrlHelper.js

const { generatePresignedUrl } = require('./s3Helper');

/**
 * Convert S3 key to presigned URL (if in production)
 * @param {string} s3Key - S3 key (e.g., 'pdfs/arxeio_symbashs/file.pdf')
 * @param {number} expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns {Promise<string>} - Presigned URL or local path
 */
async function getFileUrl(s3Key, expiresIn = 3600) {
    if (!s3Key) return null;
    
    const isProduction = process.env.NODE_ENV === 'production';
    const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';
    
    // Production: Generate presigned S3 URL
    if (isProduction && !useLocalStorage) {
        try {
            const presignedUrl = await generatePresignedUrl(s3Key, expiresIn);
            return presignedUrl;
        } catch (error) {
            console.error(`❌ Failed to generate presigned URL for: ${s3Key}`, error);
            return null;
        }
    }
    
    // Development: Return local path
    return `/uploads/s3-mock/${s3Key}`;
}

/**
 * Convert multiple S3 keys to URLs
 * @param {Array<string>} s3Keys - Array of S3 keys
 * @param {number} expiresIn - URL expiration in seconds
 * @returns {Promise<Object>} - Map of s3Key → URL
 */
async function getFileUrls(s3Keys, expiresIn = 3600) {
    const urlMap = {};
    
    for (const key of s3Keys) {
        if (key) {
            urlMap[key] = await getFileUrl(key, expiresIn);
        }
    }
    
    return urlMap;
}

/**
 * Add presigned URLs to ergazomenos object
 * @param {Object} ergazomenos - Ergazomenos document
 * @returns {Promise<Object>} - Ergazomenos with _pdfUrls field
 */
async function addPdfUrlsToErgazomenos(ergazomenos) {
    const pdfFields = [
        'arxeio_apodoxhs_oron_atomikhs_symbashs_path',
        'arxeio_apodoxhs_oysiodon_oron_path',
        'bibliario_anhlikoy_path',
        'arxeio_symbashs_daneismoy_path',
        'arxeio_nomimopoihtikon_eggrafon_path'
    ];
    
    const s3Keys = pdfFields
        .map(field => ergazomenos[field])
        .filter(key => key);
    
    const urlMap = await getFileUrls(s3Keys);
    
    // Add URLs to response object
    const ergazomenosObj = ergazomenos.toObject ? ergazomenos.toObject() : ergazomenos;
    ergazomenosObj._pdfUrls = urlMap;
    
    return ergazomenosObj;
}

module.exports = {
    getFileUrl,
    getFileUrls,
    addPdfUrlsToErgazomenos
};