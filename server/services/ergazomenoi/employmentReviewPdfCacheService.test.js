'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsPromises = fs.promises;
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const PDFDocument = require('pdfkit');
const {
    EmploymentReviewPdfCacheService,
    PDF_CACHE_TTL_MS
} = require('./employmentReviewPdfCacheService');

const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';

async function temporaryDirectory(t) {
    const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'employment-review-cache-test-'));
    t.after(() => fsPromises.rm(root, { recursive: true, force: true }));
    return root;
}

function pdfDocument(text = 'cached pdf') {
    const doc = new PDFDocument();
    doc.text(text);
    return doc;
}

test('αποθηκεύει μία δημιουργημένη έκδοση για ακριβώς πέντε λεπτά', async (t) => {
    const cacheDir = await temporaryDirectory(t);
    let now = 1_000_000;
    const cache = new EmploymentReviewPdfCacheService({
        cacheDir, now: () => now, enableTimers: false
    });
    const entry = await cache.storeDocument({
        previewId: FIRST_ID,
        fileName: 'THA_0004_ΕΠΩΝΥΜΙΑ_01-06-2026_30-06-2026.pdf',
        sessionId: 'session-a', userId: 'user-a', reportType: 'simple',
        document: pdfDocument()
    });
    assert.equal(PDF_CACHE_TTL_MS, 5 * 60 * 1000);
    assert.equal(entry.expiresAt - entry.createdAt, PDF_CACHE_TTL_MS);
    assert.equal((await cache.getEntry({ previewId: FIRST_ID,
        sessionId: 'session-a', userId: 'user-a' })).status, 'ok');
    assert.ok((await fsPromises.readFile(entry.filePath)).subarray(0, 5).equals(Buffer.from('%PDF-')));

    now = entry.expiresAt + 1;
    assert.equal((await cache.getEntry({ previewId: FIRST_ID,
        sessionId: 'session-a', userId: 'user-a' })).status, 'expired');
    await assert.rejects(fsPromises.access(entry.filePath), { code: 'ENOENT' });
});

test('απορρίπτει διαφορετική συνεδρία ή χρήστη χωρίς να επιστρέφει αρχείο', async (t) => {
    const cache = new EmploymentReviewPdfCacheService({
        cacheDir: await temporaryDirectory(t), enableTimers: false
    });
    await cache.storeDocument({
        previewId: FIRST_ID, fileName: 'δοκιμή.pdf', sessionId: 'session-a',
        userId: 'user-a', reportType: 'dossier', document: pdfDocument()
    });
    assert.equal((await cache.getEntry({ previewId: FIRST_ID,
        sessionId: 'session-b', userId: 'user-a' })).status, 'forbidden');
    assert.equal((await cache.getEntry({ previewId: FIRST_ID,
        sessionId: 'session-a', userId: 'user-b' })).status, 'forbidden');
});

test('ο αυτόματος χρονοδιακόπτης αφαιρεί αρχείο και μεταδεδομένα', async (t) => {
    const cacheDir = await temporaryDirectory(t);
    const cache = new EmploymentReviewPdfCacheService({
        cacheDir, ttlMs: 20, cleanupIntervalMs: 1000
    });
    t.after(() => clearInterval(cache.cleanupInterval));
    const entry = await cache.storeDocument({
        previewId: FIRST_ID, fileName: 'timer.pdf', sessionId: 'session-a',
        userId: 'user-a', reportType: 'simple', document: pdfDocument()
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(cache.entries.has(FIRST_ID), false);
    await assert.rejects(fsPromises.access(entry.filePath), { code: 'ENOENT' });
});

test('ο καθαρισμός εκκίνησης αγγίζει μόνο παλιά αρχεία του αποκλειστικού καταλόγου', async (t) => {
    const root = await temporaryDirectory(t);
    const cacheDir = path.join(root, 'cache');
    await fsPromises.mkdir(cacheDir);
    const oldInside = path.join(cacheDir, 'old.pdf');
    const freshInside = path.join(cacheDir, 'fresh.pdf');
    const oldOutside = path.join(root, 'outside.pdf');
    await Promise.all([oldInside, freshInside, oldOutside].map((file) =>
        fsPromises.writeFile(file, 'pdf')));
    const now = Date.now();
    const oldDate = new Date(now - PDF_CACHE_TTL_MS - 1000);
    await Promise.all([oldInside, oldOutside].map((file) =>
        fsPromises.utimes(file, oldDate, oldDate)));

    new EmploymentReviewPdfCacheService({ cacheDir, now: () => now, enableTimers: false });
    await assert.rejects(fsPromises.access(oldInside), { code: 'ENOENT' });
    await fsPromises.access(freshInside);
    await fsPromises.access(oldOutside);
});

test('αποτυχία δημιουργίας διαγράφει το μερικό αρχείο και τα μεταδεδομένα', async (t) => {
    const cacheDir = await temporaryDirectory(t);
    const cache = new EmploymentReviewPdfCacheService({ cacheDir, enableTimers: false });
    const document = new EventEmitter();
    document.pipe = (output) => {
        output.write('partial');
        process.nextTick(() => document.emit('error', new Error('generation failed')));
    };
    document.end = () => {};
    await assert.rejects(cache.storeDocument({
        previewId: SECOND_ID, fileName: 'failed.pdf', sessionId: 'session-a',
        userId: 'user-a', reportType: 'simple', document
    }), /generation failed/);
    assert.equal(cache.entries.has(SECOND_ID), false);
    assert.deepEqual(await fsPromises.readdir(cacheDir), []);
});
