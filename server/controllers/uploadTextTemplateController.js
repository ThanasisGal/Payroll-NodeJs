// ============================================================================
// Upload Text Template Controller - FIXED
// Handles multi-file .txt uploads to AWS S3
// ============================================================================

const { uploadBufferToS3 } = require('../utils/s3Helper');
const textCacheManager = require('../utils/textCacheManager');
const { getCompanyFolder } = require('../utils/userContext'); // ✅ Import!

// ============================================================================
// Upload Text Templates to S3
// ============================================================================
exports.uploadTemplates = async (req, res) => {
    try {
        // console.log('🔥 POST /api/admin/templates/upload received');
        // console.log('   Headers:', req.headers);
        // console.log('   Body:', req.body);
        // console.log('   Files:', req.files ? req.files.length : 0);

        const { team, company, category } = req.body; // company = _id από frontend
        const files = req.files;

        // Validation: Check files
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files provided'
            });
        }

        // Validation: Required fields
        if (!team || !company || !category) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: team, company, category'
            });
        }

        // ✅ ΔΙΟΡΘΩΣΗ: Get company folder με slug
        // console.log(`🔍 Resolving company folder for: ${company}`);
        const companyFolder = await getCompanyFolder(company, team);
        // console.log(`✅ Company folder resolved: ${companyFolder}`);
        // Π.χ. "0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ"

        // console.log(`📤 Uploading ${files.length} templates to ${category}`);
        // console.log(`📁 Target path: txt/${team}/${companyFolder}/${category}/`);

        // Process all files
        const results = [];
        const errors = [];

        for (const file of files) {
            try {
                const filename = file.originalname;

                // Server-side filename validation
                if (!filename.match(/^_[A-Z0-9_]+_\d{4}\.txt$/)) {
                    errors.push({
                        filename,
                        error: 'Invalid filename format. Expected: _PREFIX_XXXX.txt'
                    });
                    continue;
                }

                // ✅ ΔΙΟΡΘΩΣΗ: Construct S3 key με slug
                const s3Key = `txt/${team}/${companyFolder}/${category}/${filename}`;
                // Π.χ. txt/THA/0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ/symbash/_HOTEL_0001.txt ✅

                // console.log(`📤 Uploading: ${s3Key}`);

                // Upload to S3 using buffer
                const result = await uploadBufferToS3(
                    file.buffer,
                    s3Key,
                    'text/plain; charset=utf-8'
                );

                results.push({
                    filename,
                    s3Key: result.s3Key,
                    s3Url: result.s3Url,
                    success: true
                });

                // console.log(`✅ ${filename} uploaded successfully`);
            } catch (error) {
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
                console.error(`❌ ${file.originalname} failed:`, error.message);
            }
        }

        // // ✅ Reload text cache after successful uploads
        // if (results.length > 0) {
        //     try {
        //         const refreshResult = await textCacheManager.refresh();
        //     } catch (error) {
        //         console.error('❌ Cache reload error:', error.message);
        //     }
        // }

        // Return summary
        const response = {
            success: errors.length === 0,
            uploaded: results.length,
            failed: errors.length,
            results,
            errors,
            // ✅ Include για debugging
            uploadPath: `txt/${team}/${companyFolder}/${category}/`
        };

        res.json(response);

        // ✅ Μετά refresh cache ασύγχρονα (fire and forget)
        if (results.length > 0) {
            textCacheManager
                .refresh()
                .then((r) => console.log(`✅ Cache refreshed: ${r.totalFiles} files`))
                .catch((e) => console.error('❌ Cache refresh error:', e.message));
        }
    } catch (error) {
        console.error('❌ Template upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
