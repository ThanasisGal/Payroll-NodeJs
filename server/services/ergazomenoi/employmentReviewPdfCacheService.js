'use strict';

const fs = require('fs');
const fsPromises = fs.promises;
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');

const PDF_CACHE_TTL_MS = 5 * 60 * 1000;
const PDF_CACHE_CLEANUP_INTERVAL_MS = 60 * 1000;
const DEFAULT_PDF_CACHE_DIR = path.join(
    os.tmpdir(),
    'payroll-employment-review-pdf-cache'
);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class EmploymentReviewPdfCacheService {
    constructor({
        cacheDir = DEFAULT_PDF_CACHE_DIR,
        ttlMs = PDF_CACHE_TTL_MS,
        cleanupIntervalMs = PDF_CACHE_CLEANUP_INTERVAL_MS,
        now = () => Date.now(),
        enableTimers = true
    } = {}) {
        this.cacheDir = cacheDir;
        this.ttlMs = ttlMs;
        this.cleanupIntervalMs = cleanupIntervalMs;
        this.now = now;
        this.enableTimers = enableTimers;
        this.entries = new Map();
        this.expiryTimers = new Map();
        fs.mkdirSync(this.cacheDir, { recursive: true });
        this.cleanupStaleDiskFilesSync();
        if (enableTimers) {
            this.cleanupInterval = setInterval(
                () => this.cleanupExpired().catch(() => {}),
                this.cleanupIntervalMs
            );
            this.cleanupInterval.unref?.();
        }
    }

    isValidPreviewId(previewId) {
        return UUID_PATTERN.test(String(previewId || ''));
    }

    filePathFor(previewId, suffix = '.pdf') {
        if (!this.isValidPreviewId(previewId)) {
            const error = new Error('INVALID_PREVIEW_ID');
            error.code = 'INVALID_PREVIEW_ID';
            throw error;
        }
        return path.join(this.cacheDir, `${previewId}${suffix}`);
    }

    cleanupStaleDiskFilesSync() {
        const cutoff = this.now() - this.ttlMs;
        for (const name of fs.readdirSync(this.cacheDir)) {
            const filePath = path.join(this.cacheDir, name);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isFile() && stat.mtimeMs < cutoff) fs.unlinkSync(filePath);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
    }

    async deleteEntry(previewId) {
        const entry = this.entries.get(previewId);
        this.entries.delete(previewId);
        const expiryTimer = this.expiryTimers.get(previewId);
        this.expiryTimers.delete(previewId);
        if (expiryTimer) clearTimeout(expiryTimer);
        const candidates = entry
            ? [entry.filePath]
            : [this.filePathFor(previewId), this.filePathFor(previewId, '.partial')];
        await Promise.all(candidates.map(async (filePath) => {
            try {
                await fsPromises.unlink(filePath);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }));
    }

    async storeDocument({ previewId, fileName, sessionId, userId, reportType, document }) {
        const finalPath = this.filePathFor(previewId);
        const partialPath = this.filePathFor(previewId, '.partial');
        if (this.entries.has(previewId)) {
            const error = new Error('PREVIEW_ID_ALREADY_EXISTS');
            error.code = 'PREVIEW_ID_ALREADY_EXISTS';
            throw error;
        }
        try {
            const output = fs.createWriteStream(partialPath, { flags: 'wx' });
            const completed = pipeline(document, output);
            document.end();
            await completed;
            await fsPromises.rename(partialPath, finalPath);
            const createdAt = this.now();
            const entry = {
                previewId,
                filePath: finalPath,
                fileName,
                createdAt,
                expiresAt: createdAt + this.ttlMs,
                sessionId: String(sessionId || ''),
                userId: String(userId || ''),
                reportType
            };
            this.entries.set(previewId, entry);
            if (this.enableTimers) {
                const expiryTimer = setTimeout(
                    () => this.deleteEntry(previewId).catch(() => {}),
                    this.ttlMs
                );
                expiryTimer.unref?.();
                this.expiryTimers.set(previewId, expiryTimer);
            }
            return entry;
        } catch (error) {
            await Promise.all([partialPath, finalPath].map(async (filePath) => {
                try {
                    await fsPromises.unlink(filePath);
                } catch (unlinkError) {
                    if (unlinkError.code !== 'ENOENT') throw unlinkError;
                }
            }));
            this.entries.delete(previewId);
            throw error;
        }
    }

    async getEntry({ previewId, sessionId, userId }) {
        if (!this.isValidPreviewId(previewId)) return { status: 'not_found' };
        const entry = this.entries.get(previewId);
        if (!entry) return { status: 'not_found' };
        if (entry.sessionId !== String(sessionId || '') ||
            entry.userId !== String(userId || '')) return { status: 'forbidden' };
        if (this.now() > entry.expiresAt) {
            await this.deleteEntry(previewId);
            return { status: 'expired' };
        }
        try {
            await fsPromises.access(entry.filePath, fs.constants.R_OK);
        } catch (_) {
            this.entries.delete(previewId);
            return { status: 'not_found' };
        }
        return { status: 'ok', entry };
    }

    async cleanupExpired() {
        const now = this.now();
        const expiredIds = [...this.entries.values()]
            .filter((entry) => now > entry.expiresAt)
            .map((entry) => entry.previewId);
        await Promise.all(expiredIds.map((previewId) => this.deleteEntry(previewId)));

        const cutoff = now - this.ttlMs;
        const names = await fsPromises.readdir(this.cacheDir);
        await Promise.all(names.map(async (name) => {
            const filePath = path.join(this.cacheDir, name);
            try {
                const stat = await fsPromises.stat(filePath);
                if (stat.isFile() && stat.mtimeMs < cutoff) await fsPromises.unlink(filePath);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }));
    }
}

const employmentReviewPdfCache = new EmploymentReviewPdfCacheService();

module.exports = {
    EmploymentReviewPdfCacheService,
    employmentReviewPdfCache,
    PDF_CACHE_TTL_MS,
    DEFAULT_PDF_CACHE_DIR
};
