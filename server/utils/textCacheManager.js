/**
 * ============================================================================
 * textCacheManager.js
 * ============================================================================
 */

const { S3Client, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const fs = require("fs-extra");
const path = require("path");
const logger = require("./logger");

/**
 * ============================================================================
 * TextCacheManager Class
 * ============================================================================
 */
class TextCacheManager {
    // ========================================================================
    // ΜΕΡΟΣ 1: Constructor
    // ========================================================================
    constructor() {
        this.s3Client = new S3Client({ 
            region: process.env.AWS_REGION || "eu-central-1" 
        });
        
        this.bucket = process.env.TEXT_S3_BUCKET || process.env.S3_BUCKET;
        this.cacheDir = path.join(__dirname, "..", "..", "public", "txt-cache");
        this.memoryCache = new Map();
        this.refreshInterval = null;
        this.isRefreshing = false;
        this.lastRefresh = null;
        
    }

    // ========================================================================
    // ΜΕΡΟΣ 2: Initialize & Sync Methods
    // ========================================================================
    
    /**
     * initialize() - Καλείται από app.js κατά την εκκίνηση
     */
    async initialize() {
        try {
            await fs.ensureDir(this.cacheDir);
            
            await this.syncFromS3();
            await this.loadToMemory();
            
            // ✅ ΕΝΗΜΕΡΩΣΗ: Διαβάζει από .env
            const refreshInterval = process.env.TEXT_CACHE_REFRESH_INTERVAL 
                ? parseInt(process.env.TEXT_CACHE_REFRESH_INTERVAL, 10)
                : 5 * 60 * 1000; // Default: 5 minutes
            
            this.startAutoRefresh(refreshInterval);
            
        } catch (error) {
            logger.error("❌ Text Cache Manager initialization failed:", error);
            logger.warn("⚠️ App θα λειτουργήσει χωρίς text cache");
        }
    }

    /**
     * syncFromS3() - Κατεβάζει όλα τα files από S3
     */
    async syncFromS3() {
        if (this.isRefreshing) {
            return;
        }

        try {
            this.isRefreshing = true;
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: "txt/"
            });
            
            const response = await this.s3Client.send(listCommand);
            
            if (!response.Contents || response.Contents.length === 0) {
                return;
            }

            let syncedCount = 0;
            for (const item of response.Contents) {
                const key = item.Key;
                if (key.endsWith("/")) continue;
                
                await this.downloadFile(key);
                syncedCount++;
            }

            this.lastRefresh = new Date();
            
        } catch (error) {
            logger.error("❌ Σφάλμα κατά το sync από S3:", error.message);
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * downloadFile() - Κατεβάζει ένα αρχείο από S3
     */
    async downloadFile(key) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key
            });
            
            const response = await this.s3Client.send(command);
            const content = await this.streamToString(response.Body);
            
            const localPath = path.join(this.cacheDir, key);
            await fs.ensureDir(path.dirname(localPath));
            await fs.writeFile(localPath, content, "utf-8");
            
        } catch (error) {
            logger.error(`❌ Αποτυχία download: ${key}`, error.message);
        }
    }

    /**
     * streamToString() - Helper για S3 streams
     */
    async streamToString(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("error", reject);
            stream.on("end", () => {
                const buffer = Buffer.concat(chunks);
                const string = buffer.toString("utf-8");
                resolve(string);
            });
        });
    }

    // ========================================================================
    // ΜΕΡΟΣ 3: Memory Cache & Fast Access
    // ========================================================================

    /**
     * ========================================================================
     * loadToMemory()
     * ========================================================================
     * 
     * Φορτώνει όλα τα cached files από το filesystem στη RAM
     * 
     * ΣΚΟΠΟΣ:
     * Όταν ο controller ζητάει ένα template, διαβάζει από RAM (Map)
     * αντί από filesystem → ULTRA FAST (0ms I/O)
     * 
     * ΡΟΗ:
     * 1. Βρίσκει όλα τα .txt files στο cache directory (αναδρομικά)
     * 2. Διαβάζει το καθένα
     * 3. Αποθηκεύει στο Map με key = relative path
     * 
     * ΠΑΡΑΔΕΙΓΜΑ:
     * File: public/txt-cache/txt/THA/0001_COMPANY/symbash/_HOTEL_0001.txt
     * Key:  "txt/THA/0001_COMPANY/symbash/_HOTEL_0001.txt"
     * Value: "Το περιεχόμενο του αρχείου..."
     */
    async loadToMemory() {
        try {
            // Clear existing cache
            this.memoryCache.clear();
            
            // Βρίσκουμε όλα τα .txt files αναδρομικά
            const files = await this.getAllCachedFiles(this.cacheDir);
            
            // Φορτώνουμε το καθένα στη μνήμη
            for (const filePath of files) {
                // Παίρνουμε το relative path από το cache directory
                // Π.χ. "txt/THA/0001_COMPANY/symbash/_HOTEL_0001.txt"
                const relativePath = path.relative(this.cacheDir, filePath);
                
                // Διαβάζουμε το περιεχόμενο
                const content = await fs.readFile(filePath, "utf-8");
                
                // Normalize path (Windows: \ → /)
                const cacheKey = relativePath.replace(/\\/g, "/");
                
                // Αποθηκεύουμε στο Map
                this.memoryCache.set(cacheKey, content.trim());
            }
            
        } catch (error) {
            logger.error("❌ Σφάλμα κατά τη φόρτωση στη μνήμη:", error);
            // Δεν κάνουμε throw - το app μπορεί να τρέξει
        }
    }

    /**
     * ========================================================================
     * getAllCachedFiles()
     * ========================================================================
     * 
     * Helper: Βρίσκει όλα τα .txt files αναδρομικά σε έναν κατάλογο
     * 
     * @param {string} dir - Ο κατάλογος προς σάρωση
     * @returns {Promise<string[]>} Array με full paths των .txt files
     * 
     * ΛΟΓΙΚΗ:
     * 1. Διαβάζει τα items του directory
     * 2. Για κάθε item:
     *    - Αν είναι directory → αναδρομική κλήση
     *    - Αν είναι .txt file → προσθήκη στο array
     * 3. Επιστρέφει συγκεντρωτικά όλα τα files
     */
    async getAllCachedFiles(dir) {
        const files = [];
        
        // Check αν υπάρχει ο κατάλογος
        const exists = await fs.pathExists(dir);
        if (!exists) {
            return files;
        }
        
        // Διάβασε τα items
        const items = await fs.readdir(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory()) {
                // Αναδρομική κλήση για subdirectories
                const subFiles = await this.getAllCachedFiles(fullPath);
                files.push(...subFiles);
            } else if (item.endsWith(".txt")) {
                // Προσθήκη .txt file
                files.push(fullPath);
            }
        }
        
        return files;
    }

    /**
     * ========================================================================
     * getText()
     * ========================================================================
     * 
     * Διαβάζει ένα template από το in-memory cache
     * 
     * @param {string} team - Team name (π.χ. "THA")
     * @param {string} companyFolder - Company folder (π.χ. "0001_ΞΕΝΟΔΟΧΕΙΟ_ΙΚΑΡΙΑ")
     * @param {string} category - Category (π.χ. "symbash")
     * @param {string} filename - Filename χωρίς .txt (π.χ. "_HOTEL_0001")
     * @returns {string} Το περιεχόμενο του template ή κενό string
     * 
     * ΧΡΗΣΗ ΣΕ CONTROLLER:
     * const text = cacheManager.getText("THA", "0001_COMPANY", "symbash", "_HOTEL_0001");
     * 
     * PERFORMANCE:
     * - Map.get() = O(1) complexity
     * - Χωρίς I/O → Ultra fast (< 1ms)
     * - Thread-safe (JavaScript single-threaded)
     */
    getText(team, companyFolder, category, filename) {
        // Φτιάχνουμε το key
        const key = `txt/${team}/${companyFolder}/${category}/${filename}.txt`;
        
        // Lookup στο Map
        if (this.memoryCache.has(key)) {
            return this.memoryCache.get(key);
        }
        
        // Not found
        logger.warn(`⚠️ Template δεν βρέθηκε στο cache: ${key}`);
        return "";
    }

    /**
     * ========================================================================
     * getStats()
     * ========================================================================
     * 
     * Επιστρέφει statistics για το cache
     * 
     * @returns {Object} Stats object
     * 
     * ΧΡΗΣΗ:
     * Για admin dashboard ή monitoring
     */
    getStats() {
        const teamsMap = new Map();
        
        for (const [key] of this.memoryCache) {
            const parts = key.split("/");
            if (parts.length >= 2 && parts[0] === "txt") {
                const team = parts[1];
                teamsMap.set(team, (teamsMap.get(team) || 0) + 1);
            }
        }

        // 💾 Memory calculation
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
            bucket: this.bucket,
            memory: {
                cacheSizeMB: memoryMB,
                heapUsedMB: heapUsed,
                avgFileSizeKB: this.memoryCache.size > 0 
                    ? ((totalBytes / this.memoryCache.size) / 1024).toFixed(2)
                    : '0'
            }
        };
    }

    /**
     * ========================================================================
     * refresh()
     * ========================================================================
     * 
     * Manual refresh trigger
     * 
     * ΧΡΗΣΗ:
     * Από API endpoint για instant update
     * 
     * ΡΟΗ:
     * 1. Sync από S3
     * 2. Reload στη μνήμη
     * 3. Return result
     */
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
            logger.error("❌ Manual refresh απέτυχε:", error.message);
            
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // ========================================================================
    // ΜΕΡΟΣ 4: Auto-Refresh & Lifecycle Management
    // ========================================================================

    /**
     * ========================================================================
     * startAutoRefresh()
     * ========================================================================
     * 
     * Ξεκινάει περιοδικό auto-refresh
     * 
     * @param {number} intervalMs - Διάστημα σε milliseconds (default: 5 min)
     * 
     * ΛΟΓΙΚΗ:
     * Κάθε X λεπτά:
     * 1. Sync από S3 (κατεβάζει νέα/updated files)
     * 2. Reload στη μνήμη
     * 3. Continue...
     * 
     * ΧΡΗΣΗ:
     * Καλείται αυτόματα από το initialize()
     */
    startAutoRefresh(intervalMs = 5 * 60 * 1000) {
        // Stop existing interval (αν υπάρχει)
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        const minutes = intervalMs / 1000 / 60;
        // Ξεκινά το interval
        this.refreshInterval = setInterval(async () => {
            try {
                await this.refresh();
            } catch (error) {
                logger.error("❌ Auto-refresh error:", error);
                // Δεν σταματάμε το interval - θα δοκιμάσει ξανά
            }
        }, intervalMs);
        
        // Αποτρέπει το interval να κρατάει το process alive
        // (σημαντικό για graceful shutdown)
        this.refreshInterval.unref();
    }

    /**
     * ========================================================================
     * stopAutoRefresh()
     * ========================================================================
     * 
     * Σταματάει το auto-refresh
     * 
     * ΧΡΗΣΗ:
     * Κατά το graceful shutdown του app
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * ========================================================================
     * clearCache()
     * ========================================================================
     * 
     * Καθαρίζει το cache (memory + disk)
     * 
     * ΧΡΗΣΗ:
     * - Testing
     * - Troubleshooting
     * - Manual cleanup
     * 
     * ⚠️ ΠΡΟΣΟΧΗ: Destructive operation!
     */
    async clearCache() {
        try {
            logger.warn("🗑️ Καθαρισμός cache...");
            
            // Clear memory
            this.memoryCache.clear();
            
            // Clear disk
            await fs.emptyDir(this.cacheDir);
            
            return { success: true };
            
        } catch (error) {
            logger.error("❌ Σφάλμα καθαρισμού cache:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ========================================================================
     * healthCheck()
     * ========================================================================
     * 
     * Έλεγχος υγείας του cache system
     * 
     * @returns {Object} Health status
     * 
     * ΧΡΗΣΗ:
     * Για monitoring / health endpoints
     */
    async healthCheck() {
        const health = {
            status: 'unknown',
            checks: {
                memoryCache: false,
                diskCache: false,
                s3Connection: false,
                autoRefresh: false
            },
            details: {}
        };

        try {
            // 1. Memory cache check
            health.checks.memoryCache = this.memoryCache.size > 0;
            health.details.cachedFiles = this.memoryCache.size;

            // 2. Disk cache check
            const exists = await fs.pathExists(this.cacheDir);
            health.checks.diskCache = exists;
            health.details.cacheDir = this.cacheDir;

            // 3. S3 connection check (quick list)
            try {
                const listCommand = new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: 'txt/',
                    MaxKeys: 1
                });
                await this.s3Client.send(listCommand);
                health.checks.s3Connection = true;
            } catch (s3Error) {
                health.checks.s3Connection = false;
                health.details.s3Error = s3Error.message;
            }

            // 4. Auto-refresh check
            health.checks.autoRefresh = !!this.refreshInterval;
            health.details.lastRefresh = this.lastRefresh;

            // Overall status
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