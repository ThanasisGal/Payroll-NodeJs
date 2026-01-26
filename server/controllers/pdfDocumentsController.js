// server/controllers/pdfDocumentsController.js

const PdfDocument = require('../models/pdfDocument');
const fs = require('fs').promises;
const path = require('path');

class PdfDocumentsController {
    // ========================================================================
    // UPLOAD PDF
    // ========================================================================
    static uploadPdf = async (req, res) => {
        try {
            // 1️⃣ Validation
            if (!req.file) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Δεν βρέθηκε αρχείο PDF' 
                });
            }

            const { ergazomenosId, documentType } = req.body;
            
            if (!ergazomenosId || !documentType) {
                await fs.unlink(req.file.path);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Τα πεδία ergazomenosId και documentType είναι υποχρεωτικά' 
                });
            }

            const validTypes = ['anhlikoi', 'allodapoi', 'oysiodeis_oroi', 'arxeio_symbashs'];
            if (!validTypes.includes(documentType)) {
                await fs.unlink(req.file.path);
                return res.status(400).json({ 
                    success: false, 
                    message: `Μη έγκυρος τύπος εγγράφου` 
                });
            }

            // 2️⃣ ✅ Soft delete existing document
            const existingDoc = await PdfDocument.findOne({
                ergazomenosId,
                documentType
            });

            if (existingDoc) {
                // Διαγραφή παλιού φυσικού αρχείου
                try {
                    const oldFilePath = path.join(__dirname, '../../uploads', existingDoc.relativePath);
                    await fs.unlink(oldFilePath);
                    console.log(`✅ Παλιό αρχείο διαγράφηκε: ${existingDoc.relativePath}`);
                } catch (err) {
                    console.error('⚠️ Σφάλμα κατά τη διαγραφή παλιού αρχείου:', err);
                }
                
                // Διαγραφή παλιού record
                await existingDoc.deleteOne();
            }

            // 3️⃣ Calculate relative path
            const relativePath = req.file.path.replace(/\\/g, '/').replace('uploads/', '');

            // 4️⃣ Create new document
            const newPdfDocument = new PdfDocument({
                ergazomenosId,
                documentType,
                originalName: req.file.originalname,
                storedFilename: req.file.filename,
                relativePath: relativePath,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                uploadedBy: req.session?.userId || null,
            });

            // 5️⃣ Save
            const savedDocument = await newPdfDocument.save();

            console.log(`✅ PDF αποθηκεύτηκε: ${savedDocument._id} | Type: ${documentType}`);

            // 6️⃣ Success Response
            return res.status(201).json({
                success: true,
                message: 'Το αρχείο αποθηκεύτηκε επιτυχώς',
                data: {
                    id: savedDocument._id,
                    originalName: savedDocument.originalName,
                    fileSize: savedDocument.fileSize,
                    documentType: savedDocument.documentType,
                    uploadDate: savedDocument.uploadDate,
                    fullPath: savedDocument.fullPath // ✅ Virtual field
                }
            });

        } catch (error) {
            console.error('❌ Upload Error:', error);
            
            // Cleanup
            if (req.file) {
                try {
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    console.error('❌ Σφάλμα κατά τη διαγραφή αρχείου:', unlinkError);
                }
            }

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την αποθήκευση του αρχείου',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };

    // ========================================================================
    // GET PDFs BY ERGAZOMENOS
    // ========================================================================
    static getPdfsByErgazomenos = async (req, res) => {
        try {
            const { ergazomenosId } = req.params;
            const { documentType } = req.query;
            
            // ✅ Χρήση static method από model
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

    // ========================================================================
    // DOWNLOAD PDF
    // ========================================================================
    static downloadPdf = async (req, res) => {
        try {
            const { id } = req.params;
            
            const doc = await PdfDocument.findById(id);
            
            if (!doc) {
                return res.status(404).json({
                    success: false,
                    error: 'Το αρχείο δεν βρέθηκε'
                });
            }
            
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
            
            // Set headers
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

    // ========================================================================
    // DELETE PDF
    // ========================================================================
    static deletePdf = async (req, res) => {
        try {
            const { id } = req.params;
            
            const doc = await PdfDocument.findById(id);
            
            if (!doc) {
                return res.status(404).json({
                    success: false,
                    error: 'Το αρχείο δεν βρέθηκε'
                });
            }
            
            // ✅ Χρήση instance method
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
}

module.exports = PdfDocumentsController;