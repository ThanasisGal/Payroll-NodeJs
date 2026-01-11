// server/controllers/pdfDocumentsController.js

const PdfDocument = require('../models/pdfDocument');
const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// UPLOAD PDF
// ============================================================================

const uploadPdf = async (req, res) => {
    try {
        // Validate file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Δεν επιλέχθηκε αρχείο'
            });
        }
        
        // Extract data from request
        const { ergazomenosId, documentType = 'oysiodeis_oroi' } = req.body;
        
        // Validate ergazomenosId
        if (! ergazomenosId) {
            // Delete uploaded file if validation fails
            await fs.unlink(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Το ergazomenosId είναι υποχρεωτικό'
            });
        }
        
        // Calculate relative path from uploads/ directory
        const relativePath = req.file.path.replace(/\\/g, '/').replace('uploads/', '');
        
        // Create database record
        const pdfDoc = new PdfDocument({
            ergazomenosId:  ergazomenosId,
            documentType: documentType,
            originalName: req.file.originalname,
            storedFilename:  req.file.filename,
            relativePath: relativePath,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadDate: new Date(),
            uploadedBy: req. session?. userId || null,
        });
        
        // Save to database
        await pdfDoc.save();
        
        // Success response
        res.status(200).json({
            success: true,
            message: 'Το αρχείο αποθηκεύτηκε με επιτυχία',
            file: {
                id: pdfDoc._id,
                originalName: pdfDoc.originalName,
                fileSize: pdfDoc.fileSize,
                uploadDate: pdfDoc.uploadDate,
                documentType: pdfDoc.documentType
            }
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Delete file if database save failed
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting file after failed upload:', unlinkError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Σφάλμα κατά την αποθήκευση του αρχείου'
        });
    }
};

// ============================================================================
// GET PDFs BY ERGAZOMENOS
// ============================================================================

const getPdfsByErgazomenos = async (req, res) => {
    try {
        const { ergazomenosId } = req.params;
        const { documentType } = req.query;
        
        const docs = await PdfDocument.findByErgazomenos(ergazomenosId, documentType);
        
        res.status(200).json({
            success: true,
            count: docs.length,
            documents: docs
        });
        
    } catch (error) {
        console.error('Error fetching PDFs:', error);
        res.status(500).json({
            success: false,
            error: 'Σφάλμα κατά την ανάκτηση των αρχείων'
        });
    }
};

// ============================================================================
// DOWNLOAD PDF
// ============================================================================

const downloadPdf = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find document in database
        const doc = await PdfDocument.findById(id);
        
        if (!doc) {
            return res.status(404).json({
                success: false,
                error: 'Το αρχείο δεν βρέθηκε'
            });
        }
        
        // Build file path
        const filePath = path.join(__dirname, '../../uploads', doc.relativePath);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (err) {
            return res.status(404).json({
                success: false,
                error: 'Το φυσικό αρχείο δεν βρέθηκε'
            });
        }
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
        
        // Stream file
        const fileStream = require('fs').createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            error: 'Σφάλμα κατά τη λήψη του αρχείου'
        });
    }
};

// ============================================================================
// DELETE PDF
// ============================================================================

const deletePdf = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find document
        const doc = await PdfDocument.findById(id);
        
        if (!doc) {
            return res.status(404).json({
                success: false,
                error: 'Το αρχείο δεν βρέθηκε'
            });
        }
        
        // Delete file and database record using instance method
        await doc.deleteFile();
        
        res.status(200).json({
            success: true,
            message: 'Το αρχείο διαγράφηκε με επιτυχία'
        });
        
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Σφάλμα κατά τη διαγραφή του αρχείου'
        });
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module. exports = {
    uploadPdf,
    getPdfsByErgazomenos,
    downloadPdf,
    deletePdf
};