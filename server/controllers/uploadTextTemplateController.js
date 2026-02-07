// ============================================================================
// Upload Text Template Controller
// Handles multi-file .txt uploads to AWS S3
// ============================================================================

const { uploadBufferToS3 } = require('../utils/s3Helper');
const textCacheManager = require('../utils/textCacheManager');

// ============================================================================
// Upload Text Templates to S3
// ============================================================================
exports.uploadTemplates = async (req, res) => {
    try {
        console.log('🔥 POST /api/admin/templates/upload received');
        console.log('   Headers:', req.headers);
        console.log('   Body:', req.body);
        console.log('   Files:', req.files ? req.files.length : 0);

        const { team, company, category } = req.body;
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

        console.log(`📤 Uploading ${files.length} templates to ${category}`);

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

                // Construct S3 key
                const s3Key = `txt/${team}/${company}/${category}/${filename}`;

                // ✅ Upload to S3 using buffer (NOT file.path)
                const result = await uploadBufferToS3(
                    file.buffer,  // ✅ Use buffer from memoryStorage
                    s3Key,
                    'text/plain; charset=utf-8'
                );

                results.push({
                    filename,
                    s3Key: result.s3Key,
                    s3Url: result.s3Url,
                    success: true
                });

                console.log(`✅ ${filename} uploaded successfully`);

            } catch (error) {
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
                console.error(`❌ ${file.originalname} failed:`, error.message);
            }
        }

        // ✅ Reload text cache after successful uploads
        if (results.length > 0) {
            console.log('🔄 Reloading text cache system...');
            try {
                const refreshResult = await textCacheManager.refresh();
                if (refreshResult.success) {
                    console.log(`✅ Cache reloaded: ${refreshResult.totalFiles} templates in memory`);
                } else {
                    console.warn('⚠️ Cache reload failed:', refreshResult.error);
                }
            } catch (error) {
                console.error('❌ Cache reload error:', error.message);
            }
        }

        // Return summary
        const response = {
            success: errors.length === 0,
            uploaded: results.length,
            failed: errors.length,
            results,
            errors
        };

        console.log(`📊 Upload complete: ${results.length} success, ${errors.length} failed`);

        res.json(response);

    } catch (error) {
        console.error('❌ Template upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};