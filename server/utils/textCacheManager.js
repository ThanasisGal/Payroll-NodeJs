/**
 * ============================================================================
 * textCacheManager.js
 * ============================================================================
 */

const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');
const { USE_LOCAL_STORAGE } = require('./s3Helper');

/**
 * ============================================================================
 * TextCacheManager Class
 * ============================================================================
 */
class TextCacheManager {
    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'eu-central-1'
        });

        this.bucket = process.env.TEXT_S3_BUCKET || process.env.S3_BUCKET;
        this.cacheDir = path.join(__dirname, '..', '..', 'public', 'txt-cache');
        this.localS3MockDir = path.join(__dirname, '..', '..', 'uploads', 's3-mock');
        this.memoryCache = new Map();
        this.refreshInterval = null;
        this.isRefreshing = false;
        this.lastRefresh = null;
    }

    // ========================================================================
    // Initialize & Sync Methods
    // ========================================================================

    async initialize() {
        try {
            await fs.ensureDir(this.cacheDir);

            logger.info(`📦 Text cache source: ${USE_LOCAL_STORAGE ? 'LOCAL S3 MOCK' : 'AWS S3'}`);
            logger.info(`📁 Cache directory: ${this.cacheDir}`);

            if (USE_LOCAL_STORAGE) {
                logger.info(`📁 Local mock source: ${this.localS3MockDir}`);
            } else {
                logger.info(`☁️ S3 bucket: ${this.bucket}`);
            }

            await this.syncFromS3();
            await this.loadToMemory();

            const refreshInterval = process.env.TEXT_CACHE_REFRESH_INTERVAL
                ? parseInt(process.env.TEXT_CACHE_REFRESH_INTERVAL, 10)
                : 5 * 60 * 1000;

            this.startAutoRefresh(refreshInterval);
        } catch (error) {
            logger.error('❌ Text Cache Manager initialization failed:', error);
            logger.warn('⚠️ App θα λειτουργήσει χωρίς text cache');
        }
    }

    async syncFromS3() {
        if (this.isRefreshing) return;

        try {
            this.isRefreshing = true;

            const keysSet = await this.listAllS3Keys('txt/');

            if (!keysSet || keysSet.size === 0) {
                logger.warn('⚠️ No txt/ files found in source storage');
                return;
            }

            const { deleted, kept } = await this.deleteOrphanCacheFiles(keysSet);
            logger.info(`🧹 Cache cleanup: deleted ${deleted} orphan files, kept ${kept}`);

            const keys = [...keysSet];
            const BATCH_SIZE = 10;
            let successCount = 0;

            for (let i = 0; i < keys.length; i += BATCH_SIZE) {
                const batch = keys.slice(i, i + BATCH_SIZE);

                const results = await Promise.all(
                    batch.map(async (key) => {
                        try {
                            await this.downloadFile(key);
                            return true;
                        } catch (err) {
                            logger.error(`❌ Download failed for ${key}:`, err.message);
                            return false;
                        }
                    })
                );

                successCount += results.filter(Boolean).length;
            }

            this.lastRefresh = new Date();
            logger.info(`✅ Synced ${successCount}/${keysSet.size} files from source storage`);
        } catch (error) {
            logger.error('❌ Σφάλμα sync:', error.message);
        } finally {
            this.isRefreshing = false;
        }
    }

    async downloadFile(key) {
        try {
            const localPath = path.join(this.cacheDir, key);

            await fs.ensureDir(path.dirname(localPath));

            // DEV MODE: Copy from local mock storage
            if (USE_LOCAL_STORAGE) {
                const sourcePath = path.join(this.localS3MockDir, key);

                const exists = await fs.pathExists(sourcePath);
                if (!exists) {
                    throw new Error(`Local mock source file not found: ${sourcePath}`);
                }

                await fs.copyFile(sourcePath, localPath);
                return;
            }

            // PRODUCTION: Download from AWS S3
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key
            });

            const response = await this.s3Client.send(command);
            const content = await this.streamToString(response.Body);

            await fs.writeFile(localPath, content, 'utf-8');
        } catch (error) {
            logger.error(`❌ Αποτυχία download: ${key}`, error.message);
            throw error;
        }
    }

    async streamToString(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer.toString('utf-8'));
            });
        });
    }

    async listAllS3Keys(prefix = 'txt/') {
        const keys = new Set();

        // DEV MODE: Read from local mock directory
        if (USE_LOCAL_STORAGE) {
            const baseDir = path.join(this.localS3MockDir, prefix);

            const exists = await fs.pathExists(baseDir);
            if (!exists) {
                logger.warn(`⚠️ Local mock path does not exist: ${baseDir}`);
                return keys;
            }

            const files = await this.getAllCachedFiles(baseDir);

            for (const filePath of files) {
                const relativeToMockRoot = path
                    .relative(this.localS3MockDir, filePath)
                    .replace(/\\/g, '/');

                if (!relativeToMockRoot.endsWith('.txt')) continue;

                keys.add(relativeToMockRoot);
            }

            return keys;
        }

        // PRODUCTION: Read from AWS S3
        let continuationToken = undefined;

        while (true) {
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });

            const response = await this.s3Client.send(listCommand);

            if (response.Contents) {
                for (const item of response.Contents) {
                    if (!item?.Key) continue;
                    if (item.Key.endsWith('/')) continue;
                    keys.add(item.Key);
                }
            }

            if (!response.IsTruncated) break;
            continuationToken = response.NextContinuationToken;
            if (!continuationToken) break;
        }

        return keys;
    }

    // ========================================================================
    // Memory Cache & Fast Access
    // ========================================================================

    async loadToMemory() {
        try {
            this.memoryCache.clear();

            const files = await this.getAllCachedFiles(this.cacheDir);
            let invalidCount = 0;

            for (const filePath of files) {
                const relativePath = path.relative(this.cacheDir, filePath).replace(/\\/g, '/');

                // Guard for invalid company folder format
                if (/^txt\/THA\/\d{4}\/symbash\//.test(relativePath)) {
                    logger.error(`🚨 INVALID CACHE PATH DETECTED (ignored): ${relativePath}`);
                    invalidCount++;
                    continue;
                }

                const content = await fs.readFile(filePath, 'utf-8');
                this.memoryCache.set(relativePath, content.trim());
            }

            if (invalidCount > 0) {
                logger.error(`🚨 ${invalidCount} invalid cache files were detected and ignored`);
            }

            logger.info(`🧠 Memory cache loaded: ${this.memoryCache.size} files`);
        } catch (error) {
            logger.error('❌ Σφάλμα κατά τη φόρτωση στη μνήμη:', error);
        }
    }

    async getAllCachedFiles(dir) {
        const files = [];

        const exists = await fs.pathExists(dir);
        if (!exists) {
            return files;
        }

        const items = await fs.readdir(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                const subFiles = await this.getAllCachedFiles(fullPath);
                files.push(...subFiles);
            } else if (item.endsWith('.txt')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    async deleteOrphanCacheFiles(sourceKeysSet) {
        let deleted = 0;
        let kept = 0;

        const localFiles = await this.getAllCachedFiles(this.cacheDir);

        for (const filePath of localFiles) {
            const relativePath = path.relative(this.cacheDir, filePath).replace(/\\/g, '/');

            if (!sourceKeysSet.has(relativePath)) {
                try {
                    await fs.remove(filePath);
                    deleted++;
                } catch (err) {
                    logger.error(`❌ Failed to delete orphan file: ${relativePath}`, err.message);
                }
            } else {
                kept++;
            }
        }

        return { deleted, kept };
    }

    getText(team, companyFolder, category, filename) {
        const normalizedFilename = String(filename || '').replace(/\\/g, '/');
        const key = `txt/${team}/${companyFolder}/${category}/${normalizedFilename}.txt`;

        if (this.memoryCache.has(key)) {
            return this.memoryCache.get(key);
        }

        logger.warn(`⚠️ Template δεν βρέθηκε στο cache: ${key}`);
        return '';
    }

    getStats() {
        const teamsMap = new Map();

        for (const [key] of this.memoryCache) {
            const parts = key.split('/');
            if (parts.length >= 2 && parts[0] === 'txt') {
                const team = parts[1];
                teamsMap.set(team, (teamsMap.get(team) || 0) + 1);
            }
        }

        let totalBytes = 0;
        for (const value of this.memoryCache.values()) {
            totalBytes += Buffer.byteLength(value, 'utf-8');
        }

        const memoryMB = (totalBytes / 1024 / 1024).toFixed(2);
        const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        return {
            totalFiles: this.memoryCache.size,
            teams: Object.fromEntries(teamsMap),
            lastRefresh: this.lastRefresh,
            isRefreshing: this.isRefreshing,
            autoRefreshEnabled: !!this.refreshInterval,
            cacheDirectory: this.cacheDir,
            sourceMode: USE_LOCAL_STORAGE ? 'local-mock' : 'aws-s3',
            bucket: USE_LOCAL_STORAGE ? 'LOCAL_MOCK' : this.bucket,
            localMockDir: USE_LOCAL_STORAGE ? this.localS3MockDir : null,
            memory: {
                cacheSizeMB: memoryMB,
                heapUsedMB: heapUsed,
                avgFileSizeKB:
                    this.memoryCache.size > 0
                        ? (totalBytes / this.memoryCache.size / 1024).toFixed(2)
                        : '0'
            }
        };
    }

    async refresh() {
        try {
            await this.syncFromS3();
            await this.loadToMemory();

            return {
                success: true,
                lastRefresh: this.lastRefresh,
                totalFiles: this.memoryCache.size
            };
        } catch (error) {
            logger.error('❌ Manual refresh απέτυχε:', error.message);

            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========================================================================
    // Auto-Refresh & Lifecycle Management
    // ========================================================================

    startAutoRefresh(intervalMs = 5 * 60 * 1000) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            try {
                await this.refresh();
            } catch (error) {
                logger.error('❌ Auto-refresh error:', error);
            }
        }, intervalMs);

        this.refreshInterval.unref();
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async clearCache() {
        try {
            logger.warn('🗑️ Καθαρισμός cache...');
            this.memoryCache.clear();
            await fs.emptyDir(this.cacheDir);
            return { success: true };
        } catch (error) {
            logger.error('❌ Σφάλμα καθαρισμού cache:', error);
            return { success: false, error: error.message };
        }
    }

    async healthCheck() {
        const health = {
            status: 'unknown',
            checks: {
                memoryCache: false,
                diskCache: false,
                sourceConnection: false,
                autoRefresh: false
            },
            details: {}
        };

        try {
            health.checks.memoryCache = this.memoryCache.size > 0;
            health.details.cachedFiles = this.memoryCache.size;

            const exists = await fs.pathExists(this.cacheDir);
            health.checks.diskCache = exists;
            health.details.cacheDir = this.cacheDir;

            if (USE_LOCAL_STORAGE) {
                const mockExists = await fs.pathExists(this.localS3MockDir);
                health.checks.sourceConnection = mockExists;
                health.details.localMockDir = this.localS3MockDir;
            } else {
                try {
                    const listCommand = new ListObjectsV2Command({
                        Bucket: this.bucket,
                        Prefix: 'txt/',
                        MaxKeys: 1
                    });
                    await this.s3Client.send(listCommand);
                    health.checks.sourceConnection = true;
                } catch (s3Error) {
                    health.checks.sourceConnection = false;
                    health.details.s3Error = s3Error.message;
                }
                health.details.bucket = this.bucket;
            }

            health.checks.autoRefresh = !!this.refreshInterval;
            health.details.lastRefresh = this.lastRefresh;
            health.details.sourceMode = USE_LOCAL_STORAGE ? 'local-mock' : 'aws-s3';

            const allChecks = Object.values(health.checks);
            const passedChecks = allChecks.filter(Boolean).length;

            if (passedChecks === allChecks.length) {
                health.status = 'healthy';
            } else if (passedChecks > 0) {
                health.status = 'degraded';
            } else {
                health.status = 'unhealthy';
            }

            return health;
        } catch (error) {
            health.status = 'error';
            health.error = error.message;
            return health;
        }
    }
}

// ============================================================================
// Singleton Export
// ============================================================================
const cacheManager = new TextCacheManager();
module.exports = cacheManager;
