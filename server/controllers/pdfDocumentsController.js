const PdfDocument = require('../models/pdfDocument');
const fs = require('fs').promises;
const path = require('path');

class PdfDocumentsController {
    /**
     * POST /api/upload-pdf
     * Αποθηκεύει PDF αρχείο στο filesystem και metadata στη MongoDB
     */
    static uploadPdf = async (req, res) => {
        try {
            // 1️⃣ Validation:  Έλεγχος αν υπάρχει αρχείο
            if (! req.file) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Δεν βρέθηκε αρχείο PDF' 
                });
            }

            // 2️⃣ Validation: Έλεγχος απαραίτητων πεδίων
            const { ergazomenosId, documentType } = req.body;
            
            if (!ergazomenosId) {
                // Διαγραφή του αρχείου που ανέβηκε
                await fs.unlink(req.file.path);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Το ergazomenosId είναι υποχρεωτικό' 
                });
            }

            if (!documentType) {
                await fs.unlink(req.file.path);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Το documentType είναι υποχρεωτικό' 
                });
            }

            // 3️⃣ Validation: Έλεγχος έγκυρου documentType
            const validTypes = ['anhlikoi', 'allodapoi', 'oysiodeis_oroi'];
            if (!validTypes.includes(documentType)) {
                await fs.unlink(req.file.path);
                return res.status(400).json({ 
                    success: false, 
                    message: `Μη έγκυρος τύπος εγγράφου. Επιτρεπόμενοι:  ${validTypes.join(', ')}` 
                });
            }

            // 4️⃣ Έλεγχος αν υπάρχει ήδη αρχείο για αυτόν τον εργαζόμενο και τύπο
            const existingDoc = await PdfDocument.findOne({
                ergazomenosId,
                documentType,
                isActive: true
            });

            if (existingDoc) {
                // Soft delete:  Μαρκάρουμε το παλιό ως inactive
                existingDoc.isActive = false;
                existingDoc.replacedAt = new Date();
                await existingDoc.save();
                
                // 🔥 Προαιρετικά:  Διαγραφή του παλιού φυσικού αρχείου
                try {
                    await fs.unlink(existingDoc.filePath);
                    console.log(`✅ Παλιό αρχείο διαγράφηκε: ${existingDoc.filePath}`);
                } catch (unlinkErr) {
                    console.error('⚠️ Σφάλμα κατά τη διαγραφή παλιού αρχείου:', unlinkErr);
                }
            }

            // 5️⃣ Δημιουργία νέου document στη MongoDB
            const newPdfDocument = new PdfDocument({
                ergazomenosId,
                documentType,
                fileName: req.file.filename,
                originalName: req.file.originalname,
                filePath: req.file.path,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                uploadedBy: req.session?.userId || null, // ✅ Από session
                uploadedAt: new Date(),
                isActive: true
            });

            // 6️⃣ Αποθήκευση στη βάση
            const savedDocument = await newPdfDocument.save();

            console.log(`✅ PDF αποθηκεύτηκε: ${savedDocument._id} | Type: ${documentType}`);

            // 7️⃣ Success Response
            return res.status(201).json({
                success: true,
                message: 'Το αρχείο αποθηκεύτηκε επιτυχώς',
                data: {
                    id: savedDocument._id,
                    fileName: savedDocument.fileName,
                    originalName: savedDocument.originalName,
                    fileSize: savedDocument.fileSize,
                    documentType: savedDocument.documentType,
                    uploadedAt: savedDocument.uploadedAt
                }
            });

        } catch (error) {
            console.error('❌ Upload Error:', error);
            
            // 🧹 Cleanup:  Διαγραφή αρχείου σε περίπτωση σφάλματος
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
                error: process.env.NODE_ENV === 'development' ? error.message :  undefined
            });
        }
    };

    // 🔄 Placeholder για τις υπόλοιπες μεθόδους (ΒΗΜΑ 2)
    static getPdfsByErgazomenos = async (req, res) => {
        // TODO:  ΒΗΜΑ 2
        res.status(501).json({ message: 'Not implemented yet' });
    };

    static downloadPdf = async (req, res) => {
        // TODO: ΒΗΜΑ 2
        res.status(501).json({ message: 'Not implemented yet' });
    };

    static deletePdf = async (req, res) => {
        // TODO: ΒΗΜΑ 2
        res.status(501).json({ message: 'Not implemented yet' });
    };
}

module.exports = PdfDocumentsController;