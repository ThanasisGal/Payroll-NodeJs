// server/controllers/pdfDocumentsController.js
// ✅ UPGRADED WITH S3 SUPPORT

const PdfDocument = require('../models/pdfDocument');
const fs = require('fs').promises;
const path = require('path');
const { 
    uploadFileToS3, 
    generatePresignedUrl, 
    deleteFileFromS3 
} = require('../utils/s3Helper');

class PdfDocumentsController {
    // ========================================================================
    // UPLOAD PDF (✅ S3 ENABLED)
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

            // 2️⃣ ✅ Soft delete existing document (and delete from S3)
            const existingDoc = await PdfDocument.findOne({
                ergazomenosId,
                documentType
            });

            if (existingDoc) {
                // Διαγραφή από S3 (αν υπάρχει s3Key)
                if (existingDoc.s3Key) {
                    try {
                        await deleteFileFromS3(existingDoc.s3Key);
                        console.log(`✅ Παλιό αρχείο διαγράφηκε από S3: ${existingDoc.s3Key}`);
                    } catch (err) {
                        console.error('⚠️ Σφάλμα κατά τη διαγραφή από S3:', err);
                    }
                } else {
                    // Fallback: Διαγραφή από local filesystem (legacy)
                    try {
                        const oldFilePath = path.join(__dirname, '../../uploads', existingDoc.relativePath);
                        await fs.unlink(oldFilePath);
                        console.log(`✅ Παλιό αρχείο διαγράφηκε (local): ${existingDoc.relativePath}`);
                    } catch (err) {
                        console.error('⚠️ Σφάλμα κατά τη διαγραφή local αρχείου:', err);
                    }
                }
                
                // Διαγραφή record από DB
                await existingDoc.deleteOne();
            }

            // 3️⃣ ✅ Upload to S3
            const timestamp = Date.now();
            const s3Key = `pdfs/${ergazomenosId}/${documentType}/${timestamp}-${req.file.originalname}`;
            
            const s3Result = await uploadFileToS3(
                req.file.path, 
                s3Key, 
                'application/pdf'
            );

            // 4️⃣ ✅ Delete temp local file
            await fs.unlink(req.file.path);
            console.log(`🗑️ Temp file deleted: ${req.file.path}`);

            // 5️⃣ ✅ Generate presigned URL (valid for 7 days)
            const presignedUrl = await generatePresignedUrl(s3Key, 7 * 24 * 3600);

            // 6️⃣ Create new document record
            const newPdfDocument = new PdfDocument({
                ergazomenosId,
                documentType,
                originalName: req.file.originalname,
                storedFilename: req.file.filename, // Keep for reference
                relativePath: s3Key, // ✅ Now stores S3 key instead of local path
                s3Key: s3Key, // ✅ NEW: S3 object key
                s3Url: s3Result.s3Url, // ✅ NEW: Direct S3 URL
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                uploadedBy: req.session?.userId || null,
            });

            // 7️⃣ Save to database
            const savedDocument = await newPdfDocument.save();

            console.log(`✅ PDF αποθηκεύτηκε στο S3: ${savedDocument._id} | S3 Key: ${s3Key}`);

            // 8️⃣ Success Response
            return res.status(201).json({
                success: true,
                message: 'Το αρχείο αποθηκεύτηκε επιτυχώς στο S3',
                data: {
                    id: savedDocument._id,
                    originalName: savedDocument.originalName,
                    fileSize: savedDocument.fileSize,
                    documentType: savedDocument.documentType,
                    uploadDate: savedDocument.uploadDate,
                    s3Url: s3Result.s3Url,
                    presignedUrl: presignedUrl, // ✅ For immediate access
                }
            });

        } catch (error) {
            console.error('❌ Upload Error:', error);
            
            // Cleanup temp file
            if (req.file) {
                try {
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    console.error('❌ Σφάλμα κατά τη διαγραφή temp αρχείου:', unlinkError);
                }
            }

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την αποθήκευση του αρχείου στο S3',
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
            
            const docs = await PdfDocument.findByErgazomenos(ergazomenosId, documentType);
            
            // ✅ Generate presigned URLs for all documents
            const docsWithUrls = await Promise.all(
                docs.map(async (doc) => {
                    const docObj = doc.toObject();
                    if (doc.s3Key) {
                        try {
                            docObj.presignedUrl = await generatePresignedUrl(doc.s3Key, 3600); // 1 hour
                        } catch (err) {
                            console.error(`⚠️ Error generating presigned URL for ${doc.s3Key}:`, err);
                            docObj.presignedUrl = null;
                        }
                    }
                    return docObj;
                })
            );
            
            res.status(200).json({
                success: true,
                count: docsWithUrls.length,
                documents: docsWithUrls
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
    // DOWNLOAD PDF (✅ S3 PRESIGNED URL)
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
            
            // ✅ S3: Generate presigned URL and redirect
            if (doc.s3Key) {
                const presignedUrl = await generatePresignedUrl(doc.s3Key, 300); // 5 minutes
                
                return res.status(200).json({
                    success: true,
                    downloadUrl: presignedUrl,
                    originalName: doc.originalName,
                    expiresIn: 300 // seconds
                });
            }
            
            // ⚠️ Fallback: Local filesystem (για legacy files)
            const filePath = path.join(__dirname, '../../uploads', doc.relativePath);
            
            try {
                await fs.access(filePath);
            } catch (err) {
                return res.status(404).json({
                    success: false,
                    error: 'Το φυσικό αρχείο δεν βρέθηκε'
                });
            }
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
            
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
    // DELETE PDF (✅ S3 ENABLED)
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
            
            // ✅ Delete from S3
            if (doc.s3Key) {
                try {
                    await deleteFileFromS3(doc.s3Key);
                    console.log(`✅ Αρχείο διαγράφηκε από S3: ${doc.s3Key}`);
                } catch (err) {
                    console.error('⚠️ Σφάλμα κατά τη διαγραφή από S3:', err);
                }
            } else {
                // Fallback: Delete from local filesystem
                await doc.deleteFile();
            }
            
            // Delete from database
            await doc.deleteOne();
            
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