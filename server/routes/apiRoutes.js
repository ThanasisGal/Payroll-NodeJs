// routes/apiRoutes.js
const express = require('express');
const router  = express.Router();
const path = require('path');
const fs = require('fs').promises;

const symbaseisController = require('../controllers/symbaseisController');
const { sendContractEmail } = require('../utils/emailService');

// ============================================================================
// SYMBASEIS - CONTRACTS DATA
// ============================================================================

// ΠΙΝΑΚΑΣ ΜΕ PAGINATION (JSON: items, page, pages, total)
router.get('/symbaseis/kathgories',             symbaseisController.listKathgoriesSymbaseon);
router.get('/symbaseis/eidikothtes',            symbaseisController.listEidikothtesSymbaseon);
router.get('/symbaseis/eidikothtes_multi',      symbaseisController.listEidikothtesSymbaseonMulti);
router.get('/symbaseis/stoixeiaSymbaseon',      symbaseisController.listStoixeiaSymbaseon);

// ============================================================================
// EMAIL - SEND CONTRACT PDF
// ============================================================================

/**
 * POST /api/send-contract-email
 * Send contract PDF via email to employee
 */
router.post('/send-contract-email', async (req, res) => {
    try {
        const { 
            email,           // Employee email
            pdfUrl,          // PDF URL path
            employeeName,    // Employee full name
            fylo,            // Gender (false = male, true = female)
            yphkoothta,      // Nationality code (048 = Greek)
            companyEmail,    // Company email
            companyPhone,    // Company phone
            companyName,     // Company name
            companyType      // Εταιρεία / Επιχείρηση
        } = req.body;
        
        // ✅ VALIDATION
        
        if (!email || !email.includes('@')) {
            console.error('❌ [API] Invalid email:', email);
            return res.status(400).json({
                success: false,
                message: 'Μη έγκυρη διεύθυνση email'
            });
        }
        
        if (!pdfUrl) {
            console.error('❌ [API] Missing PDF URL');
            return res.status(400).json({
                success: false,
                message: 'Λείπει το URL του PDF'
            });
        }
        
        // ✅ DETERMINE LANGUAGE (Greek if nationality = 048)
        const isGreek = yphkoothta === '048';
        
        // ✅ DETERMINE GENDER (fylo: false = male, true = female)
        const isMale = fylo === false || fylo === 'false';

        // ✅ CONVERT PDF URL TO FILESYSTEM PATH
        // PDFs are stored in uploads/ (at root level, NOT in public/)
        const pdfPath = pdfUrl.startsWith('/uploads/')
            ? path.join(process.cwd(), pdfUrl)  // /uploads/... → <root>/uploads/...
            : pdfUrl;

        // ✅ EXTRACT FILENAME FROM PATH
        const pdfFilename = path.basename(pdfPath);

        // ✅ CHECK IF FILE EXISTS (with retry mechanism for async PDF generation)
        let pdfExists = false;
        let retries = 0;
        const maxRetries = 10; // 10 retries = 5 seconds

        while (!pdfExists && retries < maxRetries) {
            try {
                await fs.access(pdfPath);
                pdfExists = true;
            } catch (error) {
                retries++;
                if (retries < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
                } else {
                    console.error('❌ [API] PDF file NOT FOUND after retries:', pdfPath);
                    
                    // ✅ DEBUG: List available files
                    try {
                        const dir = path.dirname(pdfPath);
                        const files = await fs.readdir(dir);
                    } catch (e) {
                        console.error('❌ [API] Cannot read directory:', e.message);
                    }
                    
                    throw new Error(`Το αρχείο PDF δεν βρέθηκε: ${pdfFilename}`);
                }
            }
        }

        // ✅ SEND EMAIL
        const result = await sendContractEmail({
            to: email,
            employeeName: employeeName || 'Εργαζόμενε/η',
            pdfPath: pdfPath,
            pdfFilename: pdfFilename,
            isGreek: isGreek,
            isMale: isMale,
            companyEmail: companyEmail || null,
            companyPhone: companyPhone || null,
            companyName: companyName || null,
            companyType: companyType || 'ΕΠΙΧΕΙΡΗΣΗ'
        });
        
        // ✅ SUCCESS RESPONSE
        res.json({
            success: true,
            message: `Email στάλθηκε επιτυχώς στο ${email}`,
            messageId: result.messageId
        });
        
    } catch (error) {
        console.error('❌ [API] Error sending email:', error.message);
        console.error('❌ [API] Stack:', error.stack);
        
        // ✅ ERROR RESPONSE
        res.status(500).json({
            success: false,
            message: error.message || 'Αποτυχία αποστολής email'
        });
    }
});

module.exports = router;