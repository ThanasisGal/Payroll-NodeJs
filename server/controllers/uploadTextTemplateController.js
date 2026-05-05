// ============================================================================
// Upload Text Template Controller - FINAL CANONICAL VERSION
// Handles multi-file .txt uploads to AWS S3
// Canonical structure:
// txt/{team}/{companyFolder}/{category}/{prefix}/_FIELD_XXXX.txt
// ============================================================================

const { uploadBufferToS3 } = require('../utils/s3Helper');
const textCacheManager = require('../utils/textCacheManager');
const { getCompanyFolder } = require('../utils/userContext');

// ============================================================================
// Helpers
// ============================================================================

function normalizePrefix(prefix) {
    if (!prefix) return null;

    let normalized = String(prefix).trim().toUpperCase();
    normalized = normalized.replace(/[^A-Z0-9_]/g, '');
    normalized = normalized.replace(/_+/g, '_');

    if (!normalized.startsWith('_')) normalized = '_' + normalized;
    if (!normalized.endsWith('_')) normalized = normalized + '_';

    if (normalized === '__' || normalized.length < 3) {
        return null;
    }

    return normalized;
}

/**
 * Δέχεται legacy filename τύπου:
 *   _GENIKOI_OROI_0001.txt
 * και το μετατρέπει σε canonical:
 *   _FIELD_0001.txt
 *
 * Επίσης δέχεται ήδη canonical:
 *   _FIELD_0001.txt
 */
function toCanonicalFieldFilename(originalFilename, selectedPrefix) {
    const normalizedPrefix = normalizePrefix(selectedPrefix);
    if (!normalizedPrefix) {
        throw new Error('Invalid selected prefix');
    }

    const filename = String(originalFilename || '')
        .trim()
        .toUpperCase();

    // Ήδη canonical
    if (/^_FIELD_\d{4}\.TXT$/.test(filename)) {
        return filename.replace(/\.TXT$/, '.txt');
    }

    // Legacy format: _PREFIX_0001.txt
    const legacyRegex = new RegExp(`^${normalizedPrefix.replace(/_/g, '\\_')}(\\d{4})\\.TXT$`);
    const legacyMatch = filename.match(legacyRegex);

    if (legacyMatch) {
        return `_FIELD_${legacyMatch[1]}.txt`;
    }

    throw new Error(
        'Invalid filename format. Expected either _FIELD_XXXX.txt or selected-prefix format _PREFIX_XXXX.txt'
    );
}

// ============================================================================
// Upload Text Templates to S3
// ============================================================================
exports.uploadTemplates = async (req, res) => {
    try {
        const { team, company, category, prefix } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files provided'
            });
        }

        if (!team || !company || !category || !prefix) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: team, company, category, prefix'
            });
        }

        const normalizedPrefix = normalizePrefix(prefix);

        if (!normalizedPrefix) {
            return res.status(400).json({
                success: false,
                error: 'Invalid prefix format. Expected something like _GENIKOI_OROI_'
            });
        }

        const companyFolder = await getCompanyFolder(company, team);

        const results = [];
        const errors = [];

        for (const file of files) {
            try {
                const originalFilename = file.originalname;
                const canonicalFilename = toCanonicalFieldFilename(
                    originalFilename,
                    normalizedPrefix
                );

                // Canonical final path:
                // txt/{team}/{companyFolder}/{category}/{prefix}/_FIELD_XXXX.txt
                const s3Key = `txt/${team}/${companyFolder}/${category}/${normalizedPrefix}/${canonicalFilename}`;

                const result = await uploadBufferToS3(
                    file.buffer,
                    s3Key,
                    'text/plain; charset=utf-8'
                );

                results.push({
                    originalFilename,
                    storedFilename: canonicalFilename,
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

        if (results.length > 0) {
            try {
                const refreshResult = await textCacheManager.refresh();
                console.log(`✅ Cache refreshed: ${refreshResult.totalFiles} files`);
            } catch (e) {
                console.error('❌ Cache refresh error:', e.message);
            }
        }

        return res.json({
            success: errors.length === 0,
            uploaded: results.length,
            failed: errors.length,
            results,
            errors,
            uploadPath: `txt/${team}/${companyFolder}/${category}/${normalizedPrefix}/`
        });
    } catch (error) {
        console.error('❌ Template upload error:', error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
