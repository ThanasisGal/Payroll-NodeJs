'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const storageRoot = path.resolve(__dirname, '../../../uploads/s3-mock');

function invalidReference() {
    return Object.assign(new Error('Invalid XML storage reference'), { code: 'XML_REFERENCE_INVALID' });
}

function validateKey(key) {
    if (typeof key !== 'string' || !key.startsWith('xmls/') || !key.endsWith('.xml') ||
        /[\\\x00-\x1f\x7f]/.test(key) ||
        key.split('/').some(part => !part || part === '.' || part === '..')) {
        throw invalidReference();
    }
    return key;
}

// Decode exactly one URL layer, segment by segment. Keys and filesystem paths
// are opaque: a literal %CE, %20, #, ? or + in them must retain its identity.
function decodeUrlKey(key) {
    try {
        return validateKey(key.split('/').map(part => {
            const decoded = decodeURIComponent(part);
            if (/[\/\\]/.test(decoded)) throw invalidReference();
            return decoded;
        }).join('/'));
    } catch {
        throw invalidReference();
    }
}

function localKey(filename, root) {
    const relative = path.relative(root, filename);
    // Check before resolve/normalize can erase traversal components.
    if (filename.split('/').some(part => part === '.' || part === '..') ||
        path.isAbsolute(relative) || relative.startsWith('../')) throw invalidReference();
    return validateKey(relative);
}

function parseReference(reference, root, bucket) {
    if (typeof reference !== 'string' || !reference || /[\\\x00-\x1f\x7f]/.test(reference)) {
        throw invalidReference();
    }
    if (reference.startsWith('s3://')) {
        const match = reference.match(/^s3:\/\/([^/]+)\/(.+)$/);
        if (!match || match[1] !== bucket) throw invalidReference();
        return { remote: true, keys: [validateKey(match[2])] };
    }
    if (/^https?:\/\//.test(reference)) {
        // Match the original path before WHATWG URL normalization removes '..'.
        const match = reference.match(/^https?:\/\/([^/?#]+)\/([^?#]*)(?:[?#].*)?$/);
        if (!match) throw invalidReference();
        const host = match[1];
        const virtual = host.match(/^(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/);
        const service = /^s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host);
        let encodedKey;
        if (virtual && virtual[1] === bucket) encodedKey = match[2];
        else if (service && match[2].startsWith(`${bucket}/`)) encodedKey = match[2].slice(bucket.length + 1);
        else throw invalidReference();
        return { remote: true, keys: [decodeUrlKey(encodedKey)] };
    }
    if (reference.startsWith('/uploads/s3-mock/')) {
        const encodedKey = reference.slice('/uploads/s3-mock/'.length).split(/[?#]/)[0];
        const decoded = decodeUrlKey(encodedKey);
        // Compatibility with historical unescaped URLs for literally encoded
        // filenames. Only try the exact original key after canonical lookup.
        return { remote: false, keys: [...new Set([decoded, validateKey(encodedKey)])] };
    }
    if (reference.startsWith('file:///')) {
        const filename = reference.slice('file://'.length);
        const raw = localKey(filename, root);
        // saveToLocalStorage historically returns file:// + a raw filesystem
        // path. Prefer that exact file before considering a standard file URL.
        let decoded;
        try { decoded = decodeUrlKey(raw); } catch { decoded = raw; }
        return { remote: false, keys: [...new Set([raw, decoded])] };
    }
    if (reference.startsWith('uploads/s3-mock/')) {
        return { remote: false, keys: [validateKey(reference.slice('uploads/s3-mock/'.length))] };
    }
    if (path.isAbsolute(reference)) {
        return { remote: false, keys: [localKey(reference, root)] };
    }
    return { remote: true, keys: [validateKey(reference)] };
}

async function resolveXmlUploadReference(reference, company, options) {
    const { downloadS3UriToTempFile, bucket, useLocalStorage,
        root = storageRoot, fileSystem = fs } = options;
    const parsed = parseReference(reference, root, bucket);
    if (parsed.remote && !useLocalStorage) {
        const localXmlPath = await downloadS3UriToTempFile(`s3://${bucket}/${parsed.keys[0]}`, company);
        return { localXmlPath, tempDownloaded: true };
    }
    // Production never accepts client-supplied local filesystem references.
    if (!useLocalStorage) throw invalidReference();
    const realRoot = await fileSystem.realpath(path.join(root, 'xmls'));
    for (const key of parsed.keys) {
        const filename = path.join(root, key);
        try {
            const realFile = await fileSystem.realpath(filename);
            const relative = path.relative(realRoot, realFile);
            if (path.isAbsolute(relative) || relative.startsWith('../') || relative === '..') {
                throw invalidReference();
            }
            const stat = await fileSystem.stat(realFile);
            if (!stat.isFile()) throw invalidReference();
            return { localXmlPath: realFile, tempDownloaded: false };
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }
    throw Object.assign(new Error('XML file not found'), { code: 'XML_REFERENCE_NOT_FOUND' });
}

function xmlReferenceFailure(error) {
    if (!['XML_REFERENCE_INVALID', 'XML_REFERENCE_NOT_FOUND', 'ENOENT', 'NoSuchKey'].includes(error?.code || error?.name)) return null;
    return {
        success: false,
        userMessage: 'Η υποβολή σταμάτησε επειδή το αποθηκευμένο αρχείο της αναγγελίας δεν είναι διαθέσιμο με ασφαλή διαδρομή. ' +
            'Δεν έγινε επικοινωνία ή υποβολή στο ΕΡΓΑΝΗ και δεν αποθηκεύτηκε καμία νέα αλλαγή. ' +
            'Η προηγούμενη αποθήκευση εργαζομένου διατηρείται.\n' +
            '1. Κλείστε το μήνυμα χωρίς να επαναλάβετε την αποθήκευση εργαζομένου.\n' +
            '2. Ζητήστε από την τεχνική υποστήριξη να ελέγξει το υπάρχον αρχείο της αναγγελίας.\n' +
            'Κωδικός αναφοράς: ERGANI_XML_REFERENCE',
        errorDetails: '', messages: []
    };
}

module.exports = { resolveXmlUploadReference, xmlReferenceFailure };
