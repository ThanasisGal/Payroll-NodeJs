'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function privateDirectory(directory, repositoryRoot) {
    const absolute = path.resolve(directory), root = fs.realpathSync(repositoryRoot);
    if (!fs.existsSync(absolute)) fs.mkdirSync(absolute, { mode: 0o700 });
    const stat = fs.lstatSync(absolute), real = fs.realpathSync(absolute);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() ||
        (stat.mode & 0o777) !== 0o700 || real === root || real.startsWith(root + path.sep))
        throw Error('PRIVATE_APPROVAL_DIRECTORY_REQUIRED');
    return real;
}
function createRecoveryApprovalStore({ directory, repositoryRoot, sessionSecret }) {
    if (typeof sessionSecret !== 'string' || sessionSecret.length < 16) throw Error('SESSION_SECRET_REQUIRED');
    const dir = privateDirectory(directory, repositoryRoot);
    const syncDirectory = () => { const descriptor = fs.openSync(dir, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
        try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); } };
    const sessionBinding = sid => crypto.createHmac('sha256', sessionSecret).update(sid).digest('hex');
    function filename(id) {
        if (!/^[a-f0-9-]{36}$/.test(id || '')) throw Error('APPROVAL_TICKET_REQUIRED');
        return path.join(dir, id + '.json');
    }
    return Object.freeze({
        save({ fingerprint, reservationId, executionId, actorUserId, scope, sessionId, expiresAt }) {
            if (!/^[A-Za-z0-9_-]{43}$/.test(fingerprint || '') || !sessionId ||
                !Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt) <= new Date())
                throw Error('INVALID_APPROVAL_EVIDENCE');
            const id = crypto.randomUUID();
            const file = fs.openSync(filename(id), fs.constants.O_WRONLY | fs.constants.O_CREAT |
                fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
            try {
                fs.writeFileSync(file, JSON.stringify({ version: 1, purpose: 'LEGACY_FENCE_RECOVERY',
                    fingerprint, reservationId, executionId, actorUserId, scope,
                    sessionBinding: sessionBinding(sessionId), expiresAt: new Date(expiresAt).toISOString() }));
                fs.fsyncSync(file);
            } finally { fs.closeSync(file); }
            syncDirectory();
            return id;
        },
        consume(input) {
            const evidence = this.readUnconsumed(input);
            // Append-only, process-independent ownership. Never remove this marker
            // after timeout, rollback or uncertain acknowledgement.
            const marker = path.join(dir, evidence.reservationId + '.completion-requested.json');
            const file = fs.openSync(marker, fs.constants.O_WRONLY | fs.constants.O_CREAT |
                fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
            try {
                fs.writeFileSync(file, JSON.stringify({ version: 1, ticketId: input.id,
                    reservationId: evidence.reservationId, executionId: evidence.executionId,
                    actorUserId: evidence.actorUserId, requestedAt: new Date().toISOString() }));
                fs.fsyncSync(file);
            } finally { fs.closeSync(file); }
            syncDirectory();
            return evidence;
        },
        readUnconsumed(input) {
            const evidence = this.read(input);
            if (fs.existsSync(path.join(dir, evidence.reservationId + '.completion-requested.json')))
                throw Error('RECOVERY_ALREADY_REQUESTED');
            return evidence;
        },
        read({ id, sessionId, reservationId, actorUserId, scope }) {
            const file = fs.openSync(filename(id), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
            try {
                const stat = fs.fstatSync(file);
                if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 ||
                    stat.nlink !== 1 || stat.size > 16384) throw Error('PRIVATE_APPROVAL_FILE_REQUIRED');
                const value = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (value.version !== 1 || value.purpose !== 'LEGACY_FENCE_RECOVERY' ||
                    value.sessionBinding !== sessionBinding(sessionId) || value.reservationId !== reservationId ||
                    value.actorUserId !== actorUserId || JSON.stringify(value.scope) !== JSON.stringify(scope) ||
                    !Number.isFinite(new Date(value.expiresAt).getTime()) || new Date(value.expiresAt) <= new Date() ||
                    !/^[A-Za-z0-9_-]{43}$/.test(value.fingerprint || ''))
                    throw Error('APPROVAL_EVIDENCE_CHANGED');
                return value;
            } finally { fs.closeSync(file); }
        }
    });
}
module.exports = { createRecoveryApprovalStore, privateDirectory };
