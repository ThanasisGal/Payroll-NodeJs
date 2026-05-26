// server/utils/s3Helper.js
const { s3Client, S3_BUCKET_NAME, AWS_REGION } = require('../config/aws');

const {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { pipeline } = require('stream/promises');

// =========================================================================
// ENVIRONMENT CHECK
// =========================================================================

const isProduction = process.env.NODE_ENV === 'production';
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' || !isProduction;

// Local storage directory (for dev)
const LOCAL_STORAGE_DIR = path.join(__dirname, '../../uploads/s3-mock');

// Initialize local storage directory
if (USE_LOCAL_STORAGE) {
    fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true })
        .then(() => console.log(`📁 Local S3 mock directory: ${LOCAL_STORAGE_DIR}`))
        .catch((err) => console.error('Failed to create local storage dir:', err));
}

// =========================================================================
// ✅ NEW: S3 URL DETECTION & CONVERSION HELPERS
// =========================================================================

/**
 * ✅ Detect if URL is an S3 URL (s3:// or https://*.s3.*.amazonaws.com)
 */
function isS3Url(url) {
    if (!url || typeof url !== 'string') return false;

    // s3:// protocol
    if (url.startsWith('s3://')) return true;

    // HTTPS S3 URLs (*.s3.*.amazonaws.com or *.s3-*.amazonaws.com)
    if (url.startsWith('https://') || url.startsWith('http://')) {
        return /\.s3[.-]([\w-]+\.)?amazonaws\.com/.test(url);
    }

    return false;
}

/**
 * ✅ Convert HTTPS S3 URL to s3:// URI
 * Removes query parameters (presigned URL params) before conversion
 * @param {string} httpsUrl - HTTPS S3 URL
 * @returns {string|null} s3:// URI or null if invalid
 */
function convertHttpsToS3Uri(httpsUrl) {
    // ✅ Remove query parameters (X-Amz-Algorithm, X-Amz-Credential, etc.)
    const urlWithoutQuery = httpsUrl.split('?')[0];

    // Pattern 1: https://bucket.s3.region.amazonaws.com/key
    let match = urlWithoutQuery.match(/^https?:\/\/([^.]+)\.s3[.-]([\w-]+)\.amazonaws\.com\/(.+)$/);
    if (match) {
        const bucket = match[1];
        const key = match[3];
        return `s3://${bucket}/${key}`;
    }

    // Pattern 2: https://s3.region.amazonaws.com/bucket/key
    match = urlWithoutQuery.match(/^https?:\/\/s3[.-]([\w-]+)\.amazonaws\.com\/([^/]+)\/(.+)$/);
    if (match) {
        const bucket = match[2];
        const key = match[3];
        return `s3://${bucket}/${key}`;
    }

    // Pattern 3: https://bucket.s3.amazonaws.com/key (no region)
    match = urlWithoutQuery.match(/^https?:\/\/([^.]+)\.s3\.amazonaws\.com\/(.+)$/);
    if (match) {
        const bucket = match[1];
        const key = match[2];
        return `s3://${bucket}/${key}`;
    }

    return null;
}

/**
 * ✅ Parse s3:// URI into bucket and key
 * @param {string} s3Uri - s3://bucket/key
 * @returns {{bucket: string, key: string}|null}
 */
function parseS3Uri(s3Uri) {
    if (!s3Uri || typeof s3Uri !== 'string' || !s3Uri.startsWith('s3://')) return null;
    const rest = s3Uri.slice('s3://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

// =========================================================================
// ✅ NEW: DOWNLOAD S3 FILE TO TEMP (for ERGANH XML uploads)
// =========================================================================

/**
 * ✅ Download S3 file to temporary directory
 * Supports s3://, HTTPS S3 URLs, and presigned URLs
 *
 * @param {string} s3Url - S3 URL (s3://, https://, or presigned URL)
 * @param {string} companyInUse - Company identifier for temp file naming
 * @returns {Promise<string>} Local temp file path
 */
async function downloadS3UriToTempFile(s3Url, companyInUse) {
    console.log('🔍 [S3-DOWNLOAD] Original s3Url:', s3Url);

    // // =====================================================================
    // // ✅ HTTPS/Presigned URL: Download directly with fetch
    // // =====================================================================
    // if (s3Url.startsWith('http://') || s3Url.startsWith('https://')) {
    //     console.log('[S3-DOWNLOAD] Using direct HTTPS download (presigned URL support)');

    //     // Extract filename from URL
    //     const urlPath = s3Url.split('?')[0]; // Remove query params
    //     const filename = path.basename(urlPath);
    //     const ext = path.extname(filename) || '.xml';

    //     const safeCompany = String(companyInUse || 'company').replace(/[^\w\-]+/g, '_');
    //     const uniq = crypto.randomBytes(6).toString('hex');
    //     const tempPath = path.join(os.tmpdir(), `erganh_${safeCompany}_${uniq}${ext}`);

    //     console.log('[S3-DOWNLOAD] Downloading from HTTPS', {
    //         url: s3Url.substring(0, 150) + '...',
    //         tempPath
    //     });

    //     // =====================================================================
    //     // DEV MODE: Check if it's a local file:// URL
    //     // =====================================================================
    //     if (USE_LOCAL_STORAGE && s3Url.startsWith('file://')) {
    //         const localPath = s3Url.replace('file://', '');
    //         console.log(`📁 [S3-DOWNLOAD] DEV MODE: Copying from ${localPath} to ${tempPath}`);

    //         try {
    //             await fs.copyFile(localPath, tempPath);
    //             console.log(`✅ [S3-DOWNLOAD] DEV copy complete: ${tempPath}`);
    //             return tempPath;
    //         } catch (error) {
    //             console.error(`❌ [S3-DOWNLOAD] Local file not found: ${localPath}`);
    //             throw new Error(`Local file not found: ${localPath}`);
    //         }
    //     }

    //     // =====================================================================
    //     // PRODUCTION: Download from HTTPS (works with presigned URLs)
    //     // =====================================================================
    //     try {
    //         const https = require('https');
    //         const http = require('http');
    //         const client = s3Url.startsWith('https:') ? https : http;

    //         await new Promise((resolve, reject) => {
    //             const file = require('fs').createWriteStream(tempPath);

    //             client
    //                 .get(s3Url, (response) => {
    //                     if (response.statusCode !== 200) {
    //                         reject(
    //                             new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
    //                         );
    //                         return;
    //                     }

    //                     response.pipe(file);

    //                     file.on('finish', () => {
    //                         file.close();
    //                         resolve();
    //                     });
    //                 })
    //                 .on('error', (err) => {
    //                     fs.unlink(tempPath).catch(() => {});
    //                     reject(err);
    //                 });

    //             file.on('error', (err) => {
    //                 fs.unlink(tempPath).catch(() => {});
    //                 reject(err);
    //             });
    //         });

    //         console.log('[S3-DOWNLOAD] HTTPS download complete', { tempPath });
    //         return tempPath;
    //     } catch (error) {
    //         console.error('[S3-DOWNLOAD] HTTPS download failed:', error.message);
    //         throw new Error(`Failed to download from HTTPS: ${error.message}`);
    //     }
    // }

    // // =====================================================================
    // // ✅ s3:// URI: Use AWS SDK
    // // =====================================================================
    // const parsed = parseS3Uri(s3Url);
    // if (!parsed) throw new Error(`Invalid s3:// URI: ${s3Url}`);

    // const ext = path.extname(parsed.key) || '.xml';
    // const safeCompany = String(companyInUse || 'company').replace(/[^\w\-]+/g, '_');
    // const uniq = crypto.randomBytes(6).toString('hex');
    // const tempPath = path.join(os.tmpdir(), `erganh_${safeCompany}_${uniq}${ext}`);

    // console.log('[S3-DOWNLOAD] Downloading from S3 via SDK', {
    //     bucket: parsed.bucket,
    //     key: parsed.key,
    //     tempPath
    // });

    // =====================================================================
    // ✅ HTTPS / Presigned / S3 URL handling
    // =====================================================================

    // Πρώτα: αν είναι κανονικό HTTPS S3 URL τύπου
    // https://bucket.s3.region.amazonaws.com/key
    // το μετατρέπουμε σε s3://bucket/key ώστε να γίνει download με AWS SDK.
    // Αυτό λύνει το 403 στο EC2 για private S3 objects.
    if (s3Url.startsWith('http://') || s3Url.startsWith('https://')) {
        const convertedS3Uri = isS3Url(s3Url) ? convertHttpsToS3Uri(s3Url) : null;

        if (convertedS3Uri) {
            console.log('[S3-DOWNLOAD] Converted HTTPS S3 URL to SDK URI', {
                from: s3Url.substring(0, 150) + '...',
                to: convertedS3Uri
            });

            s3Url = convertedS3Uri;
        } else {
            console.log('[S3-DOWNLOAD] Using direct HTTPS download');

            const urlPath = s3Url.split('?')[0];
            const filename = path.basename(urlPath);
            const ext = path.extname(filename) || '.xml';

            const safeCompany = String(companyInUse || 'company').replace(/[^\w\-]+/g, '_');
            const uniq = crypto.randomBytes(6).toString('hex');
            const tempPath = path.join(os.tmpdir(), `erganh_${safeCompany}_${uniq}${ext}`);

            console.log('[S3-DOWNLOAD] Downloading from HTTPS', {
                url: s3Url.substring(0, 150) + '...',
                tempPath
            });

            try {
                const https = require('https');
                const http = require('http');
                const client = s3Url.startsWith('https:') ? https : http;

                await new Promise((resolve, reject) => {
                    const file = require('fs').createWriteStream(tempPath);

                    client
                        .get(s3Url, (response) => {
                            if (response.statusCode !== 200) {
                                file.close(() => {
                                    fs.unlink(tempPath).catch(() => {});
                                });

                                reject(
                                    new Error(
                                        `HTTP ${response.statusCode}: ${response.statusMessage}`
                                    )
                                );
                                return;
                            }

                            response.pipe(file);

                            file.on('finish', () => {
                                file.close();
                                resolve();
                            });
                        })
                        .on('error', (err) => {
                            fs.unlink(tempPath).catch(() => {});
                            reject(err);
                        });

                    file.on('error', (err) => {
                        fs.unlink(tempPath).catch(() => {});
                        reject(err);
                    });
                });

                console.log('[S3-DOWNLOAD] HTTPS download complete', { tempPath });
                return tempPath;
            } catch (error) {
                console.error('[S3-DOWNLOAD] HTTPS download failed:', error.message);
                throw new Error(`Failed to download from HTTPS: ${error.message}`);
            }
        }
    }

    // =====================================================================
    // ✅ s3:// URI: Use AWS SDK
    // =====================================================================
    const parsed = parseS3Uri(s3Url);
    if (!parsed) throw new Error(`Invalid s3:// URI: ${s3Url}`);

    const ext = path.extname(parsed.key) || '.xml';
    const safeCompany = String(companyInUse || 'company').replace(/[^\w\-]+/g, '_');
    const uniq = crypto.randomBytes(6).toString('hex');
    const tempPath = path.join(os.tmpdir(), `erganh_${safeCompany}_${uniq}${ext}`);

    console.log('[S3-DOWNLOAD] Downloading from S3 via SDK', {
        bucket: parsed.bucket,
        key: parsed.key,
        tempPath
    });

    // =====================================================================
    // DEV MODE: Copy from local filesystem
    // =====================================================================
    if (USE_LOCAL_STORAGE) {
        const localPath = path.join(LOCAL_STORAGE_DIR, parsed.key);
        console.log(`📁 [S3-DOWNLOAD] DEV MODE: Copying from ${localPath} to ${tempPath}`);

        try {
            await fs.copyFile(localPath, tempPath);
            console.log(`✅ [S3-DOWNLOAD] DEV copy complete: ${tempPath}`);
            return tempPath;
        } catch (error) {
            console.error(`❌ [S3-DOWNLOAD] Local file not found: ${localPath}`);
            throw new Error(`Local file not found: ${parsed.key}`);
        }
    }

    // =====================================================================
    // PRODUCTION: Download from AWS S3
    // =====================================================================
    const resp = await s3Client.send(
        new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key })
    );

    if (!resp?.Body) throw new Error('S3 GetObject: empty body');

    await pipeline(resp.Body, require('fs').createWriteStream(tempPath));

    console.log('[S3-DOWNLOAD] S3 SDK download complete', { tempPath });

    return tempPath;
}

// =========================================================================
// HELPER: Save to local filesystem (Dev mode)
// =========================================================================

async function saveToLocalStorage(s3Key, data) {
    const localPath = path.join(LOCAL_STORAGE_DIR, s3Key);
    const dir = path.dirname(localPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(localPath, data);

    // console.log(`📁 DEV MODE: Saved locally: ${localPath}`);

    return {
        success: true,
        s3Key: s3Key,
        s3Url: `file://${localPath}`,
        localPath: localPath,
        bucket: 'LOCAL_STORAGE',
        etag: 'local-' + Date.now()
    };
}

async function deleteFromLocalStorage(s3Key) {
    const localPath = path.join(LOCAL_STORAGE_DIR, s3Key);

    try {
        await fs.unlink(localPath);
        console.log(`📁 DEV MODE: Deleted locally: ${localPath}`);
        return { success: true, s3Key: s3Key };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { success: true, s3Key: s3Key }; // Already deleted
        }
        throw error;
    }
}

async function fileExistsLocally(s3Key) {
    const localPath = path.join(LOCAL_STORAGE_DIR, s3Key);

    try {
        await fs.access(localPath);
        return true;
    } catch {
        return false;
    }
}

async function getLocalFileUrl(s3Key) {
    const localPath = path.join(LOCAL_STORAGE_DIR, s3Key);
    // Return relative path for serving via express static
    return `/uploads/s3-mock/${s3Key}`;
}

// =========================================================================
// UPLOAD FILE TO S3
// =========================================================================

async function uploadFileToS3(localFilePath, s3Key, contentType = 'application/pdf') {
    try {
        const fileContent = await fs.readFile(localFilePath);

        // DEV MODE: Save locally
        if (USE_LOCAL_STORAGE) {
            return await saveToLocalStorage(s3Key, fileContent);
        }

        // PRODUCTION: Upload to real S3
        console.log(`📤 Uploading to S3: ${s3Key}`);

        const uploadParams = {
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType
        };

        const command = new PutObjectCommand(uploadParams);
        const response = await s3Client.send(command);

        const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

        console.log(`✅ S3 Upload Success: ${s3Url}`);

        return {
            success: true,
            s3Key: s3Key,
            s3Url: s3Url,
            bucket: S3_BUCKET_NAME,
            etag: response.ETag
        };
    } catch (error) {
        console.error('❌ S3 Upload Error:', error);
        throw error;
    }
}

// =========================================================================
// UPLOAD BUFFER TO S3 (for in-memory files)
// =========================================================================

async function uploadBufferToS3(buffer, s3Key, contentType = 'application/pdf') {
    try {
        // DEV MODE: Save locally
        if (USE_LOCAL_STORAGE) {
            return await saveToLocalStorage(s3Key, buffer);
        }

        // PRODUCTION: Upload to real S3
        console.log(`📤 Uploading buffer to S3: ${s3Key}`);

        const uploadParams = {
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
            Body: buffer,
            ContentType: contentType
        };

        const command = new PutObjectCommand(uploadParams);
        const response = await s3Client.send(command);

        const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

        console.log(`✅ Buffer Upload Success: ${s3Url}`);

        return {
            success: true,
            s3Key: s3Key,
            s3Url: s3Url,
            bucket: S3_BUCKET_NAME,
            etag: response.ETag
        };
    } catch (error) {
        console.error('❌ S3 Buffer Upload Error:', error);
        throw error;
    }
}

// =========================================================================
// ✅ GENERATE PRESIGNED URL (EDGE COMPATIBLE) - UPDATED
// =========================================================================

/**
 * ✅ Generate presigned URL with Edge-compatible headers
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 3600)
 * @returns {Promise<string>} Presigned URL
 */
async function generatePresignedUrl(s3Key, expiresIn = 3600) {
    try {
        // DEV MODE: Return local file URL
        if (USE_LOCAL_STORAGE) {
            const localUrl = await getLocalFileUrl(s3Key);
            console.log(`📁 DEV MODE: Local URL: ${localUrl}`);
            return localUrl;
        }

        // =====================================================================
        // ✅ PRODUCTION: Generate presigned S3 URL with Edge-compatible headers
        // =====================================================================

        const command = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
            // ✅ CRITICAL: Force correct headers for Edge browser
            ResponseContentType: 'application/pdf',
            ResponseContentDisposition: 'inline',
            ResponseCacheControl: 'no-cache, must-revalidate'
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
            expiresIn,
            // ✅ Ensure proper URL encoding
            unhoistableHeaders: new Set(['x-amz-server-side-encryption'])
        });

        console.log(
            `🔗 Presigned URL generated (Edge-compatible): ${s3Key} (expires: ${expiresIn}s)`
        );

        return presignedUrl;
    } catch (error) {
        console.error('❌ Presigned URL Error:', error);
        throw error;
    }
}

// =========================================================================
// DELETE FILE FROM S3
// =========================================================================

async function deleteFileFromS3(s3Key) {
    try {
        // DEV MODE: Delete local file
        if (USE_LOCAL_STORAGE) {
            return await deleteFromLocalStorage(s3Key);
        }

        // PRODUCTION: Delete from S3
        console.log(`🗑️  Deleting from S3: ${s3Key}`);

        const command = new DeleteObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key
        });

        await s3Client.send(command);

        console.log(`✅ S3 Delete Success: ${s3Key}`);

        return {
            success: true,
            s3Key: s3Key
        };
    } catch (error) {
        console.error('❌ S3 Delete Error:', error);
        throw error;
    }
}

// =========================================================================
// CHECK IF FILE EXISTS IN S3
// =========================================================================

async function fileExistsInS3(s3Key) {
    try {
        // DEV MODE: Check local filesystem
        if (USE_LOCAL_STORAGE) {
            return await fileExistsLocally(s3Key);
        }

        // PRODUCTION: Check S3
        const command = new HeadObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key
        });

        await s3Client.send(command);
        return true;
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        throw error;
    }
}

// =========================================================================
// DOWNLOAD FILE FROM S3
// =========================================================================

/**
 * ✅ Download file from S3 and return as buffer
 * @param {string} s3Key - S3 object key (e.g., "contracts/team/company/file.pdf")
 * @returns {Promise<Buffer>} File buffer
 *
 * @example
 * const buffer = await downloadFileFromS3('contracts/team1/company1/123_DOE_JOHN.pdf');
 * // Use buffer for email attachment, image processing, etc.
 */
async function downloadFileFromS3(s3Key) {
    try {
        // =====================================================================
        // DEV MODE: Read from local filesystem
        // =====================================================================

        if (USE_LOCAL_STORAGE) {
            const localPath = path.join(LOCAL_STORAGE_DIR, s3Key);
            console.log(`📁 [S3-HELPER] DEV MODE: Reading locally: ${localPath}`);

            try {
                const buffer = await fs.readFile(localPath);
                console.log(`✅ [S3-HELPER] Read ${buffer.length} bytes from local file`);
                return buffer;
            } catch (error) {
                console.error(`❌ [S3-HELPER] Local file not found: ${localPath}`);
                throw new Error(`Local file not found: ${s3Key}`);
            }
        }

        // =====================================================================
        // PRODUCTION: Download from AWS S3
        // =====================================================================

        console.log(`☁️  [S3-HELPER] Downloading from S3: ${s3Key}`);

        const command = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key
        });

        const response = await s3Client.send(command);

        // =====================================================================
        // Convert readable stream to buffer
        // =====================================================================

        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        console.log(`✅ [S3-HELPER] Downloaded ${buffer.length} bytes from S3`);

        return buffer;
    } catch (error) {
        console.error('❌ [S3-HELPER] Download Error:', error.message);

        // Provide helpful error messages
        if (error.name === 'NoSuchKey') {
            throw new Error(`File not found in S3: ${s3Key}`);
        }
        if (error.name === 'AccessDenied') {
            throw new Error(`Access denied to S3 file: ${s3Key}`);
        }

        throw error;
    }
}

// =========================================================================
// ✅ DELETE ALL XML FILES FOR EMPLOYEE (E3N & WTO_weekly)
// =========================================================================

/**
 * ✅ Delete all XML files starting with employee ID
 * @param {string} employeeId - MongoDB _id of employee
 * @param {Object} options - { team, companyKod }
 * @returns {Promise<Object>} Deletion result
 */
async function deleteXmlFilesForEmployee(employeeId, options = {}) {
    const { team, companyKod, companyName } = options;

    if (!employeeId) {
        throw new Error('Employee ID is required');
    }

    const deletedFiles = [];
    const failedFiles = [];

    try {
        // =====================================================================
        // ✅ BUILD SEARCH PATHS
        // =====================================================================

        const searchPaths = [];

        if (team && companyKod && companyName) {
            // ✅ Use company name passed from controller (no model lookup needed)
            const baseDir = `xmls/${team}/${companyKod}_${companyName}`;

            console.log(`📁 [XML-DELETE] Base directory: ${baseDir}`);

            searchPaths.push(`${baseDir}/E3N`, `${baseDir}/WTO_weekly`);
        } else {
            // ✅ No team/company - search entire xmls folder (slower)
            searchPaths.push('xmls');
        }

        console.log(`🔍 [XML-DELETE] Searching for files starting with: ${employeeId}`);
        console.log(`   Search paths:`, searchPaths);

        // =====================================================================
        // ✅ DEV MODE: Search local filesystem
        // =====================================================================

        if (USE_LOCAL_STORAGE) {
            const fg = require('fast-glob');

            for (const searchPath of searchPaths) {
                const pattern = path.join(LOCAL_STORAGE_DIR, searchPath, `${employeeId}_*.xml`);

                console.log(`📁 [XML-DELETE] DEV pattern: ${pattern}`);

                const files = await fg(pattern, { onlyFiles: true });

                console.log(`   Found ${files.length} files`);

                for (const filePath of files) {
                    try {
                        await fs.unlink(filePath);
                        const s3Key = path
                            .relative(LOCAL_STORAGE_DIR, filePath)
                            .replace(/\\/g, '/');
                        deletedFiles.push(s3Key);
                        console.log(`   ✅ Deleted: ${s3Key}`);
                    } catch (err) {
                        failedFiles.push({ path: filePath, error: err.message });
                        console.error(`   ❌ Failed: ${filePath} - ${err.message}`);
                    }
                }
            }

            return {
                success: true,
                deletedCount: deletedFiles.length,
                failedCount: failedFiles.length,
                deletedFiles,
                failedFiles
            };
        }

        // =====================================================================
        // ✅ PRODUCTION: List & delete from S3
        // =====================================================================

        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

        for (const searchPath of searchPaths) {
            const prefix = `${searchPath}/${employeeId}_`;

            console.log(`☁️  [XML-DELETE] S3 prefix: ${prefix}`);

            const listCommand = new ListObjectsV2Command({
                Bucket: S3_BUCKET_NAME,
                Prefix: prefix
            });

            const listResponse = await s3Client.send(listCommand);

            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                console.log(`   No files found with prefix: ${prefix}`);
                continue;
            }

            console.log(`   Found ${listResponse.Contents.length} files`);

            for (const obj of listResponse.Contents) {
                try {
                    await deleteFileFromS3(obj.Key);
                    deletedFiles.push(obj.Key);
                    console.log(`   ✅ Deleted: ${obj.Key}`);
                } catch (err) {
                    failedFiles.push({ path: obj.Key, error: err.message });
                    console.error(`   ❌ Failed: ${obj.Key} - ${err.message}`);
                }
            }
        }

        return {
            success: true,
            deletedCount: deletedFiles.length,
            failedCount: failedFiles.length,
            deletedFiles,
            failedFiles
        };
    } catch (error) {
        console.error('[XML-DELETE] Error:', error.message);
        return {
            success: false,
            deletedCount: deletedFiles.length,
            failedCount: failedFiles.length,
            deletedFiles,
            failedFiles,
            error: error.message
        };
    }
}

// =========================================================================
// ✅ DELETE ALL CONTRACT FILES FOR EMPLOYEE
// =========================================================================

/**
 * ✅ Delete all contract PDF files starting with employee ID
 * @param {string} employeeId - MongoDB _id of employee
 * @param {Object} options - { team, companyKod, companyName }
 * @returns {Promise<Object>} Deletion result
 */
async function deleteContractsForEmployee(employeeId, options = {}) {
    const { team, companyKod, companyName } = options;

    if (!employeeId) {
        throw new Error('Employee ID is required');
    }

    const deletedFiles = [];
    const failedFiles = [];

    try {
        // =====================================================================
        // ✅ BUILD SEARCH PATHS
        // =====================================================================

        const searchPaths = [];

        if (team && companyKod && companyName) {
            const baseDir = `contracts/${team}/${companyKod}_${companyName}`;
            console.log(`📁 [CONTRACT-DELETE] Base directory: ${baseDir}`);
            searchPaths.push(baseDir);
        } else {
            searchPaths.push('contracts');
        }

        console.log(`🔍 [CONTRACT-DELETE] Searching for files starting with: ${employeeId}`);

        // =====================================================================
        // ✅ DEV MODE: Search local filesystem
        // =====================================================================

        if (USE_LOCAL_STORAGE) {
            const fg = require('fast-glob');

            for (const searchPath of searchPaths) {
                const pattern = path.join(LOCAL_STORAGE_DIR, searchPath, `${employeeId}_*.pdf`);

                console.log(`📁 [CONTRACT-DELETE] DEV pattern: ${pattern}`);

                const files = await fg(pattern, { onlyFiles: true });

                console.log(`   Found ${files.length} files`);

                for (const filePath of files) {
                    try {
                        await fs.unlink(filePath);
                        const s3Key = path
                            .relative(LOCAL_STORAGE_DIR, filePath)
                            .replace(/\\/g, '/');
                        deletedFiles.push(s3Key);
                        console.log(`   ✅ Deleted: ${s3Key}`);
                    } catch (err) {
                        failedFiles.push({ path: filePath, error: err.message });
                        console.error(`   ❌ Failed: ${filePath} - ${err.message}`);
                    }
                }
            }

            return {
                success: true,
                deletedCount: deletedFiles.length,
                failedCount: failedFiles.length,
                deletedFiles,
                failedFiles
            };
        }

        // =====================================================================
        // ✅ PRODUCTION: List & delete from S3
        // =====================================================================

        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

        for (const searchPath of searchPaths) {
            const prefix = `${searchPath}/${employeeId}_`;

            console.log(`☁️  [CONTRACT-DELETE] S3 prefix: ${prefix}`);

            const listCommand = new ListObjectsV2Command({
                Bucket: S3_BUCKET_NAME,
                Prefix: prefix
            });

            const listResponse = await s3Client.send(listCommand);

            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                console.log(`   No files found with prefix: ${prefix}`);
                continue;
            }

            console.log(`   Found ${listResponse.Contents.length} files`);

            for (const obj of listResponse.Contents) {
                try {
                    await deleteFileFromS3(obj.Key);
                    deletedFiles.push(obj.Key);
                    console.log(`   ✅ Deleted: ${obj.Key}`);
                } catch (err) {
                    failedFiles.push({ path: obj.Key, error: err.message });
                    console.error(`   ❌ Failed: ${obj.Key} - ${err.message}`);
                }
            }
        }

        return {
            success: true,
            deletedCount: deletedFiles.length,
            failedCount: failedFiles.length,
            deletedFiles,
            failedFiles
        };
    } catch (error) {
        console.error('[CONTRACT-DELETE] Error:', error.message);
        return {
            success: false,
            deletedCount: deletedFiles.length,
            failedCount: failedFiles.length,
            deletedFiles,
            failedFiles,
            error: error.message
        };
    }
}

// =========================================================================
// ✅ UPLOAD ORARIA XLSX (Εισαγωγή Ωραρίων από Εργάνη)
// =========================================================================

/**
 * Αποθηκεύει το ληφθέν xlsx ωραρίων είτε στο local s3-mock (dev)
 * είτε στο AWS S3 (prod).
 *
 * S3 key δομή:
 *   xlsx/<team>/<companyKod>_<companyName>/Oraria_Apo_Erganh/<year>_<month>.xlsx
 *
 * @param {Buffer} fileBuffer
 * @param {object} params
 * @param {string} params.team
 * @param {string} params.companyKod
 * @param {string} params.companyName   - π.χ. "ΕΤΑΙΡΕΙΑ ΑΕ"
 * @param {string} params.year          - π.χ. "2026"
 * @param {string} params.month         - π.χ. "03"  (2-ψήφιο)
 * @returns {Promise<{s3Key:string, s3Url:string, localPath?:string}>}
 */
async function uploadOrariaXlsx(fileBuffer, { team, companyKod, companyName, year, month }) {
    // Sanitize company name for safe filesystem/S3 key
    const safeCompanyName = (companyName || 'unknown')
        .replace(/[^a-zA-Z0-9_\u0370-\u03FF\u1F00-\u1FFF\u0080-\u024F]/g, '_')
        .substring(0, 40);

    const s3Key = `xlsx/${team}/${companyKod}_${safeCompanyName}/Oraria_Apo_Erganh/${year}_${month}.xlsx`;

    console.log(`[uploadOrariaXlsx] Saving to: ${s3Key}`);

    return uploadBufferToS3(
        fileBuffer,
        s3Key,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
}

async function uploadCardsXlsx(fileBuffer, { team, companyKod, companyName, year, month }) {
    // Sanitize company name for safe filesystem/S3 key
    const safeCompanyName = (companyName || 'unknown')
        .replace(/[^a-zA-Z0-9_\u0370-\u03FF\u1F00-\u1FFF\u0080-\u024F]/g, '_')
        .substring(0, 40);

    const s3Key = `xlsx/${team}/${companyKod}_${safeCompanyName}/Apasxolhseis_Apo_Kartes/${year}_${month}.xlsx`;

    console.log(`[uploadCardsXlsx] Saving to: ${s3Key}`);

    return uploadBufferToS3(
        fileBuffer,
        s3Key,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
}

// =========================================================================
// EXPORTS
// =========================================================================

module.exports = {
    uploadFileToS3,
    uploadBufferToS3,
    uploadOrariaXlsx,
    uploadCardsXlsx,
    generatePresignedUrl,
    deleteFileFromS3,
    fileExistsInS3,
    downloadFileFromS3,
    downloadS3UriToTempFile, // ✅ For ERGANH uploads
    isS3Url, // ✅ S3 URL detection
    convertHttpsToS3Uri, // ✅ HTTPS to s3:// conversion
    parseS3Uri, // ✅ Parse s3:// URIs
    deleteXmlFilesForEmployee,
    deleteContractsForEmployee,
    USE_LOCAL_STORAGE // Export for debugging
};
