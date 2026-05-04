// ============================================================================
// Upload Text Template Controller - FIXED
// Handles multi-file .txt uploads to AWS S3
// ============================================================================

const { uploadBufferToS3 } = require('../utils/s3Helper');
const textCacheManager = require('../utils/textCacheManager');
const { getCompanyFolder } = require('../utils/userContext');

// ============================================================================
// Upload Text Templates to S3
// ============================================================================
exports.uploadTemplates = async (req, res) => {
    try {
        const { team, company, category, prefix } = req.body;
        const files = req.files;

        // Validation: Check files
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files provided'
            });
        }

        // Validation: Required fields
        if (!team || !company || !category || !prefix) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: team, company, category, prefix'
            });
        }

        // Validation: Prefix format
        if (!prefix.match(/^_[A-Z0-9_]+_$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid prefix format. Expected: _PREFIX_'
            });
        }

        const companyFolder = await getCompanyFolder(company, team);

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

                // Optional αλλά προτείνεται:
                // Επιτρέπει upload μόνο αρχείων που ξεκινούν με το selected prefix
                if (!filename.startsWith(prefix)) {
                    errors.push({
                        filename,
                        error: `Filename does not match selected prefix ${prefix}`
                    });
                    continue;
                }

                // ✅ ΝΕΟ path με prefix folder
                const s3Key = `txt/${team}/${companyFolder}/${category}/${prefix}/${filename}`;
                // Π.χ. txt/THA/0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ/symbash/_HOTEL_/_HOTEL_0001.txt

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
            } catch (error) {
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });

                console.error(`❌ ${file.originalname} failed:`, error.message);
            }
        }

        const response = {
            success: errors.length === 0,
            uploaded: results.length,
            failed: errors.length,
            results,
            errors,
            uploadPath: `txt/${team}/${companyFolder}/${category}/${prefix}/`
        };

        res.json(response);

        if (results.length > 0) {
            try {
                const refreshResult = await textCacheManager.refresh();
                console.log(`✅ Cache refreshed: ${refreshResult.totalFiles} files`);
            } catch (e) {
                console.error('❌ Cache refresh error:', e.message);
            }
        }
    } catch (error) {
        console.error('❌ Template upload error:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
