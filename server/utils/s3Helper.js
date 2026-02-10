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
        .catch(err => console.error('Failed to create local storage dir:', err));
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
        etag: 'local-' + Date.now(),
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
            ContentType: contentType,
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
            etag: response.ETag,
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
            ContentType: contentType,
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
            etag: response.ETag,
        };
        
    } catch (error) {
        console.error('❌ S3 Buffer Upload Error:', error);
        throw error;
    }
}

// =========================================================================
// GENERATE PRESIGNED URL (secure temporary access)
// =========================================================================

async function generatePresignedUrl(s3Key, expiresIn = 3600) {
    try {
        // DEV MODE: Return local file URL
        if (USE_LOCAL_STORAGE) {
            const localUrl = await getLocalFileUrl(s3Key);
            console.log(`📁 DEV MODE: Local URL: ${localUrl}`);
            return localUrl;
        }
        
        // PRODUCTION: Generate presigned S3 URL
        const command = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
        });
        
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        
        console.log(`🔗 Presigned URL generated: ${s3Key} (expires: ${expiresIn}s)`);
        
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
            Key: s3Key,
        });
        
        await s3Client.send(command);
        
        console.log(`✅ S3 Delete Success: ${s3Key}`);
        
        return {
            success: true,
            s3Key: s3Key,
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
            Key: s3Key,
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
// EXPORTS
// =========================================================================

module.exports = {
    uploadFileToS3,
    uploadBufferToS3,
    generatePresignedUrl,
    deleteFileFromS3,
    fileExistsInS3,
    USE_LOCAL_STORAGE, // Export for debugging
};