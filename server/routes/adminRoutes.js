const express = require('express');
const router = express.Router();
const { uploadTextTemplate } = require('../config/multer');
const { uploadBufferToS3 } = require('../utils/s3Helper');
const textCacheManager = require('../utils/textCacheManager');
const { UserPrivilegesModel } = require('../models/privileges');
const { CompaniesModel } = require('../models/companies');
const uploadTextTemplateController = require('../controllers/uploadTextTemplateController');

// ============================================================================
// Middleware: Require Admin
// ============================================================================
function requireAdmin(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized - Please login'
        });
    }
    next();
}

// ============================================================================
// GET /admin/aws_s3 - Render Upload Page
// ============================================================================
router.get('/aws_s3', requireAdmin, async (req, res) => {
    const sessionUserTeam = req.session.userTeam;
    const companyId = req.session.companyInUse;
    const sessionUserId = req.session.userId;

    try {
        if (!sessionUserId || !companyId || !sessionUserTeam) {
            return res.status(400).send('Missing session data');
        }

        // Get user privileges
        const userPrivileges = await UserPrivilegesModel.findOne({
            userId: sessionUserId,
            form: 'Ergazomenoi'
        }).lean();

        // Get company info
        const company = await CompaniesModel.findOne({
            _id: companyId,
            team: sessionUserTeam
        })
            .select('kod eponymia')
            .lean();

        if (!company) {
            return res.status(404).send('Company not found');
        }

        // Render upload page
        res.render('admin/uploadTemplates', {
            bodyClass: 'upload-templates-page',
            userPrivileges: userPrivileges?.privileges || {},
            title: 'Upload Templates', // ✅ Απευθείας
            description: 'Web Payroll Solutions', // ✅ Απευθείας
            sessionTeam: sessionUserTeam,
            companyId: companyId,
            companyKod: company.kod,
            companyName: company.eponymia
        });
    } catch (error) {
        console.error('❌ Error loading upload page:', error);
        res.status(500).send('Σφάλμα κατά τη φόρτωση της σελίδας');
    }
});

// ============================================================================
// POST /admin/templates/upload - Upload Multi Templates
// ============================================================================
router.post(
    '/templates/upload',
    requireAdmin,
    uploadTextTemplate.array('files', 20),
    uploadTextTemplateController.uploadTemplates
);

module.exports = router;
