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
 * ✅ FIXED: Support both local paths AND S3 keys
 */
router.post('/send-contract-email', async (req, res) => {
    try {
        const { 
            email,           // Employee email
            pdfUrl,          // PDF URL path OR S3 key
            employeeName,    // Employee full name
            fylo,            // Gender (false = male, true = female)
            yphkoothta,      // Nationality code (048 = Greek)
            companyEmail,    // Company email
            companyPhone,    // Company phone
            companyName,     // Company name
            companyType      // Εταιρεία / Επιχείρηση
        } = req.body;
        
        // ============================================================================
        // ✅ VALIDATION
        // ============================================================================
        
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
        
        // ============================================================================
        // ✅ DETERMINE LANGUAGE & GENDER
        // ============================================================================
        
        const isGreek = yphkoothta === '048';
        const isMale = fylo === false || fylo === 'false';

        // ============================================================================
        // ✅ SMART PATH DETECTION: S3 key OR local path
        // ============================================================================
        
        let pdfPath;
        let pdfFilename;
        
        console.log('\n🔍 [API] PDF Path Detection:');
        console.log('   pdfUrl:', pdfUrl);
        console.log('   pdfUrl type:', typeof pdfUrl);
        
        // Check if it's an S3 key (starts with "contracts/")
        const isS3Key = typeof pdfUrl === 'string' && pdfUrl.startsWith('contracts/');
        
        if (isS3Key) {
            // ✅ S3 KEY: Pass directly (no decoding, no filesystem check)
            console.log('   ✅ Detected: S3 key');
            
            // Decode if URL-encoded (fix Greek characters)
            pdfPath = decodeURIComponent(pdfUrl);
            pdfFilename = path.basename(pdfPath);
            
            console.log('   Decoded S3 key:', pdfPath);
            console.log('   Filename:', pdfFilename);
            
        } else if (pdfUrl.startsWith('/uploads/')) {
            // ✅ LOCAL PATH: Convert to filesystem path
            console.log('   ✅ Detected: Local filesystem path');
            
            pdfPath = path.join(process.cwd(), pdfUrl);
            pdfFilename = path.basename(pdfPath);
            
            console.log('   Filesystem path:', pdfPath);
            console.log('   Filename:', pdfFilename);
            
            // ✅ CHECK IF FILE EXISTS (with retry for async generation)
            let pdfExists = false;
            let retries = 0;
            const maxRetries = 10;

            while (!pdfExists && retries < maxRetries) {
                try {
                    await fs.access(pdfPath);
                    pdfExists = true;
                    console.log('   ✅ File exists on filesystem');
                } catch (error) {
                    retries++;
                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        console.error('❌ [API] PDF file NOT FOUND after retries:', pdfPath);
                        throw new Error(`Το αρχείο PDF δεν βρέθηκε: ${pdfFilename}`);
                    }
                }
            }
            
        } else {
            // ❌ UNKNOWN FORMAT
            console.error('❌ [API] Unknown pdfUrl format:', pdfUrl);
            throw new Error('Μη έγκυρη μορφή PDF path');
        }

        console.log();

        // ============================================================================
        // ✅ SEND EMAIL
        // ============================================================================
        
        console.log('📧 [API] Sending email...');
        console.log('   To:', email);
        console.log('   PDF Path:', pdfPath);
        console.log('   Filename:', pdfFilename);
        
        const result = await sendContractEmail({
            to: email,
            employeeName: employeeName || 'Εργαζόμενε/η',
            pdfPath: pdfPath,  // ✅ Can be S3 key OR local path
            pdfFilename: pdfFilename,
            isGreek: isGreek,
            isMale: isMale,
            companyEmail: companyEmail || null,
            companyPhone: companyPhone || null,
            companyName: companyName || null,
            companyType: companyType || 'ΕΠΙΧΕΙΡΗΣΗ'
        });
        
        // ✅ SUCCESS RESPONSE
        console.log('✅ [API] Email sent successfully');
        
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