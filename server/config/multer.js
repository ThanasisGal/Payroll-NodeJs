const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * ============================================================================
 * ENVIRONMENT VARIABLES
 * ============================================================================
 */
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || 'uploads/pdfs';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default
const ALLOWED_MIME_TYPES = process.env.ALLOWED_MIME_TYPES 
    ? process.env.ALLOWED_MIME_TYPES.split(',').map(type => type.trim())
    : ['application/pdf'];

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Sanitize folder names - Αφαιρεί ειδικούς χαρακτήρες
 */
const sanitizeFolderName = (name) => {
    if (!name) return 'UNKNOWN';
    return String(name)
        .trim()
        .replace(/[^a-zA-Z0-9-_]/g, '_')  // Αντικατάσταση μη-έγκυρων χαρακτήρων
        .replace(/_+/g, '_')               // Multiple underscores -> single
        .substring(0, 50);                 // Max 50 χαρακτήρες
};

/**
 * ============================================================================
 * MULTER STORAGE - Disk Storage για PDFs
 * ============================================================================
 * Δομή: uploads/pdfs/{team}/{company}/{year}/{kodikos}/ΠΡΟΣΛΗΨΕΙΣ/
 */
const pdfStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            // 1️⃣ Παίρνουμε τα session fields
            const userTeam = req.session?.userTeam || 'NO_TEAM';
            const companyDescription = req.session?.companyDescription || req.session?.companyInUse || 'NO_COMPANY';
            const yearInUse = req.session?.yearInUse || new Date().getFullYear();
            
            // 2️⃣ Παίρνουμε τον κωδικό εργαζόμενου από το body
            const kodikosErgazomenou = req.body?.kodikosErgazomenou || 'TEMP';
            
            // 3️⃣ Sanitization (καθαρισμός από ειδικούς χαρακτήρες)
            const cleanTeam = sanitizeFolderName(userTeam);
            const cleanCompany = sanitizeFolderName(companyDescription);
            const cleanYear = sanitizeFolderName(String(yearInUse));
            const cleanKodikos = sanitizeFolderName(kodikosErgazomenou);
            
            // 4️⃣ Δημιουργία path με base directory από .env
            const uploadPath = path.join(
                UPLOAD_BASE_DIR,      // ✅ Από .env
                cleanTeam,
                cleanCompany,
                cleanYear,
                cleanKodikos,
                'ΠΡΟΣΛΗΨΕΙΣ'
            );
            
            // 5️⃣ Δημιουργία φακέλων (recursive)
            fs.mkdirSync(uploadPath, { recursive: true });
            
            console.log(`📁 PDF upload path: ${uploadPath}`);
            cb(null, uploadPath);
            
        } catch (error) {
            console.error('❌ Error creating upload directory:', error);
            cb(error, null);
        }
    },
    
    filename: function (req, file, cb) {
        try {
            // Παίρνουμε το documentType από το body
            const documentType = req.body?.documentType || 'unknown';
            
            // Timestamp για uniqueness
            const timestamp = Date.now();
            
            // Random string για extra uniqueness
            const randomStr = Math.random().toString(36).substring(2, 8);
            
            // Original extension
            const ext = path.extname(file.originalname);
            
            // Format: {documentType}_{timestamp}_{random}.pdf
            const fileName = `${documentType}_${timestamp}_${randomStr}${ext}`;
            
            console.log(`📄 Generated PDF filename: ${fileName}`);
            cb(null, fileName);
            
        } catch (error) {
            console.error('❌ Error generating filename:', error);
            cb(error, null);
        }
    }
});

/**
 * ============================================================================
 * FILE FILTERS
 * ============================================================================
 */

// ✅ PDF File Filter
const pdfFileFilter = (req, file, cb) => {
    const allowedExtensions = ['.pdf'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;
    
    // ✅ Χρησιμοποιεί ALLOWED_MIME_TYPES από .env
    if (ALLOWED_MIME_TYPES.includes(mimeType) && allowedExtensions.includes(ext)) {
        cb(null, true); // Accept file
    } else {
        const error = new Error(`Μόνο αρχεία ${allowedExtensions.join(', ')} επιτρέπονται!`);
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
    }
};

// ✅ Text Template File Filter
const textFileFilter = (req, file, cb) => {
    const allowedExtensions = ['.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ext === '.txt' || file.mimetype === 'text/plain') {
        cb(null, true); // Accept file
    } else {
        const error = new Error('Μόνο .txt αρχεία επιτρέπονται για templates!');
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
    }
};

/**
 * ============================================================================
 * MULTER INSTANCES
 * ============================================================================
 */

// ✅ PDF Upload - Disk Storage
const uploadPdf = multer({
    storage: pdfStorage,
    fileFilter: pdfFileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,  // ✅ Από .env (10MB)
        files: 1,                  // 1 αρχείο κάθε φορά
        fieldSize: 5 * 1024 * 1024 // 5MB για metadata fields
    }
});

// ✅ Text Template Upload - Memory Storage
const uploadTextTemplate = multer({
    storage: multer.memoryStorage(),
    fileFilter: textFileFilter,
    limits: {
        fileSize: 1024 * 1024,  // 1MB max per file
        files: 20,              // ✅ Up to 20 files at once
        fieldSize: 100 * 1024
    }
});

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */
module.exports = {
    upload: uploadPdf,           // ✅ Default export (backward compatibility)
    uploadPdf,                   // ✅ Explicit για PDFs
    uploadTextTemplate,          // ✅ Για text templates
    UPLOAD_BASE_DIR,             // ✅ Export constants
    MAX_FILE_SIZE,
    ALLOWED_MIME_TYPES,
    sanitizeFolderName           // ✅ Export helper (optional)
};

// ✅ Legacy support - για παλιό code που κάνει: const upload = require('./multer')
module.exports.default = uploadPdf;