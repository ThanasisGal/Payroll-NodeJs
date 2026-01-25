// server/utils/pdfHandler.js

const fs = require('fs');
const path = require('path');

/**
 * Δημιουργία φακέλου αν δεν υπάρχει
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
    }
}

/**
 * Αποθήκευση PDF από base64 string
 * @param {string} base64String - The base64 encoded PDF
 * @param {string} documentType - Type of document (e.g., 'arxeio_symbashs')
 * @param {string} ergazomenosId - ID of the ergazomenos
 * @returns {string} - Relative path to saved file
 */
function savePdfFromBase64(base64String, documentType, ergazomenosId) {
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
        
        // ⚠️ ΠΡΟΣΟΧΗ: Το path είναι relative στο server/ folder
        // server/utils/pdfHandler.js → ../.. πάει στο root
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'pdfs', documentType);
        ensureDirectoryExists(uploadDir);
        
        const filepath = path.join(uploadDir, filename);
        
        // Save to filesystem
        fs.writeFileSync(filepath, buffer);
        
        console.log(`✅ PDF saved: ${filename} (${(buffer.length / 1024).toFixed(2)}KB)`);
        
        // Return relative path (για το database)
        return `/uploads/pdfs/${documentType}/${filename}`;
        
    } catch (error) {
        console.error(`❌ Failed to save PDF (${documentType}):`, error.message);
        throw error;
    }
}

/**
 * Διαγραφή PDF από filesystem
 * @param {string} pdfPath - Relative path to PDF
 */
function deletePdf(pdfPath) {
    try {
        if (!pdfPath) return;
        
        // server/utils → ../.. → root
        const fullPath = path.join(__dirname, '..', '..', pdfPath);
        
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`✅ PDF deleted: ${pdfPath}`);
        }
    } catch (error) {
        console.error(`❌ Failed to delete PDF:`, error.message);
    }
}

module.exports = {
    savePdfFromBase64,
    deletePdf,
    ensureDirectoryExists
};