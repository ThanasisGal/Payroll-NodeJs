'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { BSON, MongoClient, ObjectId } = mongoose.mongo;
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const D = require('./employeeHistoryReferenceDefinitionsService');
const { privateDirectory } = require('./employeeHistoryRecoveryApprovalStore');
const SOURCE = 'EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE', SEQUENCE = 'employee_profile_mutation_sequence';
const MAX_EVIDENCE_BYTES = 64 * 1024 * 1024;
const equal = (a, b) => BSON.EJSON.stringify(a, { relaxed: false }) === BSON.EJSON.stringify(b, { relaxed: false });
const plain = value => BSON.deserialize(BSON.serialize({ value })).value;
const hash = value => crypto.createHash('sha256').update(BSON.serialize(value)).digest('hex');
function reject(reason) { throw Object.assign(Error(reason), { reason }); }
function finalId(binding) {
    return crypto.createHash('sha256').update(JSON.stringify([SOURCE,
        { team: binding.scope.team, company_kod: binding.scope.company_kod, kodikos: binding.scope.kodikos, employee_id: binding.employeeId },
        binding.legacyAttemptId, binding.fingerprint])).digest('hex').slice(0, 24);
}
function privateRead(file) {
    const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        const stat = fs.fstatSync(descriptor);
        if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1 || stat.size > MAX_EVIDENCE_BYTES)
            reject('PRIVATE_VERIFICATION_EVIDENCE_REQUIRED');
        const bytes = fs.readFileSync(descriptor);
        if (bytes.length !== stat.size) reject('VERIFICATION_EVIDENCE_CHANGED');
        return bytes;
    } finally { fs.closeSync(descriptor); }
}
function evidenceFile(options, create = false) {
    if (!/^[a-f0-9]{24}$/.test(options.binding.reservationId || '') || !options.secret || options.secret.length < 16)
        reject('VERIFICATION_IDENTITY_REQUIRED');
    let directory;
    if (create) directory = privateDirectory(options.directory, options.repositoryRoot);
    else {
        const stat = fs.lstatSync(options.directory), root = fs.realpathSync(options.repositoryRoot);
        directory = fs.realpathSync(options.directory);
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700 ||
            directory === root || directory.startsWith(root + path.sep)) reject('PRIVATE_VERIFICATION_EVIDENCE_REQUIRED');
    }
    return path.join(directory, options.binding.reservationId + '.pre-fence-evidence.bson');
}
function seal(payload, secret) {
    // The aggregate evidence may exceed BSON's default 17 MiB scratch buffer
    // even though every source MongoDB document is below its individual limit.
    const size = BSON.calculateObjectSize(payload);
    if (!Number.isSafeInteger(size) || size < 5 || size > MAX_EVIDENCE_BYTES - 32)
        reject('PRIVATE_VERIFICATION_EVIDENCE_REQUIRED');
    const bytes = BSON.serialize(payload, { minInternalBufferSize: size });
    // BSON 7 can overestimate Int32 wrappers; validate the actual wire length.
    if (bytes.length > size || bytes.readInt32LE(0) !== bytes.length) reject('VERIFICATION_EVIDENCE_CHANGED');
    const signature = crypto.createHmac('sha256', secret).update(bytes).digest();
    return Buffer.concat([signature, bytes]);
}
function persistEvidence(file, bytes) {
    const temporary = file + '.' + crypto.randomUUID() + '.partial';
    let descriptor, published = false;
    try {
        descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT |
            fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        for (let offset = 0; offset < bytes.length;) {
            const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, null);
            if (!Number.isSafeInteger(written) || written <= 0 || written > bytes.length - offset)
                reject('VERIFICATION_EVIDENCE_CHANGED');
            offset += written;
        }
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor); descriptor = undefined;
        if (!privateRead(temporary).equals(bytes)) reject('VERIFICATION_EVIDENCE_CHANGED');
        // Publish without replacing an existing baseline. A crash leaves either
        // a private .partial file or complete authenticated bytes, never a prefix.
        fs.linkSync(temporary, file); published = true;
        const directory = fs.openSync(path.dirname(file), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
        try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
        // Keep nlink=2 (unreadable by privateRead) until publication is durable.
        // If a crash restores the temporary name, verification fails closed.
        fs.unlinkSync(temporary);
    } catch (error) {
        if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch {} }
        let removeTemporary = !published;
        if (published) { try { fs.unlinkSync(file); removeTemporary = true; } catch {} }
        // If rollback cannot remove the final name, retain its second link so
        // the existing privateRead security check continues to reject it.
        if (removeTemporary) { try { fs.unlinkSync(temporary); } catch {} }
        throw error;
    }
}
function unseal(file, secret) {
    const bytes = privateRead(file), payload = bytes.subarray(32);
    const signature = crypto.createHmac('sha256', secret).update(payload).digest();
    if (bytes.length < 33 || !crypto.timingSafeEqual(signature, bytes.subarray(0, 32))) reject('VERIFICATION_EVIDENCE_CHANGED');
    return BSON.deserialize(payload, { promoteValues: false, promoteLongs: false });
}
async function snapshot(options) {
    // Every invocation creates and closes its own MongoClient. It shares no
    // session, connection pool, models or snapshots with the completion writer.
    const client = new MongoClient(options.uri, { retryWrites: false, readPreference: 'primary',
        serverSelectionTimeoutMS: 6000, socketTimeoutMS: 15000 });
    let session;
    try {
        await client.connect(); session = client.startSession();
        let result;
        await session.withTransaction(async () => {
            const db = client.db(), b = options.binding, scope = b.scope;
            const queryOptions = { session, maxTimeMS: 5000, promoteValues: false, promoteLongs: false };
            // Independent clients can receive the same seed hosts in different
            // orders. Target identity binds the complete host list, not its order.
            const target = hash({ database: db.databaseName, hosts: client.options.hosts.map(String).sort(), replicaSet: client.options.replicaSet || '' });
            const auditQuery = { $or: [Object.fromEntries(Object.entries(scope).map(([key, value]) => ['employeeScope.' + key, value])),
                { _id: { $in: [b.reservationId, b.legacyAttemptId, finalId(b)].map(id => new ObjectId(id)) } },
                { 'diagnostics.executionId': b.executionId }, { 'diagnostics.legacyAttemptId': b.legacyAttemptId }] };
            const audits = await db.collection('Employee_History_Repair_Audit').find(auditQuery, queryOptions).sort({ _id: 1 }).limit(10001).toArray();
            const employee = await db.collection('Ergazomenoi').findOne({ ...scope, _id: new ObjectId(b.employeeId) }, queryOptions);
            const history = await db.collection('Istoriko_Proslhpseon_Allagon').find(scope, queryOptions).sort({ _id: 1 }).limit(10001).toArray();
            const references = {}, ids = (options.historyIds || history.map(row => String(row._id))).flatMap(id => [id, new ObjectId(id)]);
            for (const collection of D.SUPPORTED_COLLECTIONS) references[collection] = await db.collection(collection)
                .find({ $or: D.employeeHistoryReferenceQueryPaths(collection).map(field => ({ [field]: { $in: ids } })) }, queryOptions)
                .sort({ _id: 1 }).limit(10001).toArray();
            const referenceSummary = {};
            for (const id of [...new Set(ids.filter(value => typeof value === 'string'))]) {
                referenceSummary[id] = [];
                for (const collection of D.SUPPORTED_COLLECTIONS) {
                    const match = await db.collection(collection).findOne({ $or: D.employeeHistoryReferenceQueryPaths(collection)
                        .map(field => ({ [field]: { $in: [id, new ObjectId(id)] } })) },
                    { ...queryOptions, sort: { _id: 1 }, projection: { _id: 1 } });
                    if (match) referenceSummary[id].push({ collection, documentId: String(match._id) });
                }
            }
            if (audits.length > 10000 || history.length > 10000 || Object.values(references).some(rows => rows.length > 10000))
                reject('VERIFICATION_READ_LIMIT');
            result = { target, employee, history, references, referenceSummary, audits };
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
        return result;
    } finally { if (session) await session.endSession(); await client.close(); }
}
function assertIdentity(state, binding) {
    const reservation = state.audits.find(row => String(row._id) === binding.reservationId);
    const legacy = state.audits.find(row => String(row._id) === binding.legacyAttemptId);
    const scope = { ...binding.scope, employee_id: new ObjectId(binding.employeeId) };
    if (!reservation || !legacy || reservation.mutationSource !== SOURCE + '_ATTEMPT' ||
        !A.equal(plain(reservation.employeeScope), scope) || reservation.diagnostics.executionId !== binding.executionId ||
        reservation.diagnostics.actorUserId !== binding.actorUserId || reservation.diagnostics.legacyAttemptId !== binding.legacyAttemptId ||
        reservation.diagnostics.fingerprint !== binding.fingerprint || legacy.mutationSource !== 'EMPLOYEE_HISTORY_SETTLEMENT_ATTEMPT' ||
        legacy.diagnostics.fingerprint !== binding.fingerprint || !A.equal(plain(legacy.employeeScope), scope))
        reject('RESERVATION_IDENTITY_MISMATCH');
    return { reservation, legacy };
}
async function captureFenceVerificationEvidence(options) {
    const file = evidenceFile(options, true), state = await snapshot(options);
    const { reservation } = assertIdentity(state, options.binding);
    if (state.audits.some(row => row.mutationSource === SOURCE && row.diagnostics.legacyAttemptId === options.binding.legacyAttemptId))
        reject('PRE_FENCE_BASELINE_REQUIRED');
    if (!state.employee || !A.equal(plain(state.employee), plain(reservation.currentBefore)) ||
        !A.equal(plain(state.history), A.ordered(plain(reservation.historyBefore)))) reject('BASELINE_SNAPSHOT_MISMATCH');
    const count = Object.values(state.references).reduce((total, rows) => total + rows.length, 0);
    if ((options.expectedHistoryCount !== undefined && state.history.length !== options.expectedHistoryCount) ||
        (options.expectedProtectedCount !== undefined && count !== options.expectedProtectedCount)) reject('BASELINE_COUNTS_MISMATCH');
    const payload = { version: 1, binding: options.binding, state, capturedAt: new Date() };
    if (fs.existsSync(file)) {
        const saved = unseal(file, options.secret);
        const savedBinding = plain(saved.binding);
        const bindingChanged = !A.equal(savedBinding, options.binding);
        const stateChanged = !equal(saved.state, state);
        if (bindingChanged || stateChanged) {
            const diagnostics = require('./employeeHistoryFenceComparisonDiagnostics').describe({ savedBinding,
                binding: options.binding, before: saved.state, after: state, bindingChanged, stateChanged,
                bindingEqual: A.equal, stateEqual: equal, secret: options.secret });
            try {
                const rejectedFile = file + '.rejected-' + crypto.randomUUID() + '.bson';
                persistEvidence(rejectedFile, seal({ ...payload,
                    baselineEvidenceDigest: crypto.createHash('sha256').update(privateRead(file)).digest('hex'),
                    diagnostics }, options.secret));
                const rejected = unseal(rejectedFile, options.secret);
                if (!A.equal(plain(rejected.binding), options.binding) || !equal(rejected.state, state))
                    reject('REJECTED_EVIDENCE_VERIFICATION_FAILED');
                diagnostics.REJECTED_EVIDENCE_VERIFIED = true;
            } catch { diagnostics.REJECTED_EVIDENCE_VERIFIED = false; }
            process.stderr.write(JSON.stringify({ code: 'VERIFICATION_BASELINE_CHANGED', ...diagnostics }) + '\n');
            throw Object.assign(Error('VERIFICATION_BASELINE_CHANGED'), { reason: 'VERIFICATION_BASELINE_CHANGED', diagnostics });
        }
    } else {
        persistEvidence(file, seal(payload, options.secret));
    }
    return { outcome: 'BASELINE_PRESERVED', historyCount: state.history.length, protectedDocumentCount: count };
}
function verifyMarker(options, before) {
    const directory = path.dirname(evidenceFile(options)), b = options.binding;
    const markers = fs.readdirSync(directory).filter(name => name.endsWith('.completion-requested.json')).map(name =>
        ({ name, value: JSON.parse(privateRead(path.join(directory, name)).toString('utf8')) })).filter(item => item.value.reservationId === b.reservationId);
    if (markers.length !== 1 || markers[0].name !== b.reservationId + '.completion-requested.json') reject('TICKET_MARKER_MISMATCH');
    const marker = markers[0].value;
    if (marker.version !== 1 || marker.executionId !== b.executionId || marker.actorUserId !== b.actorUserId ||
        !/^[a-f0-9-]{36}$/.test(marker.ticketId || '')) reject('TICKET_MARKER_MISMATCH');
    const ticket = JSON.parse(privateRead(path.join(directory, marker.ticketId + '.json')).toString('utf8'));
    const reservation = before.audits.find(row => String(row._id) === b.reservationId);
    const expected = A.hash({ purpose: SOURCE + '_RECOVERY', reservation: plain(reservation), approvalFingerprint: reservation.diagnostics.approvalFingerprint });
    if (marker.version !== 1 || !Number.isFinite(new Date(marker.requestedAt).getTime()) ||
        ticket.version !== 1 || ticket.purpose !== 'LEGACY_FENCE_RECOVERY' || ticket.reservationId !== b.reservationId || ticket.executionId !== b.executionId || ticket.actorUserId !== b.actorUserId ||
        !A.equal(ticket.scope, b.scope) || !A.tokenMatches(ticket.fingerprint, expected)) reject('TICKET_MARKER_MISMATCH');
}
async function verifyLegacyFenceIndependently(options) {
    try {
        const saved = unseal(evidenceFile(options), options.secret), b = options.binding;
        if (Number(saved.version) !== 1 || !A.equal(plain(saved.binding), b)) reject('VERIFICATION_EVIDENCE_CHANGED');
        const before = saved.state;
        if ((options.expectedHistoryCount !== undefined && before.history.length !== options.expectedHistoryCount) ||
            (options.expectedProtectedCount !== undefined && Object.values(before.references).reduce((n, rows) => n + rows.length, 0) !== options.expectedProtectedCount))
            reject('VERIFICATION_COUNTS_MISMATCH');
        const after = await snapshot({ ...options, historyIds: before.history.map(row => String(row._id)) });
        if (before.target !== after.target) reject('VERIFICATION_TARGET_CHANGED');
        const { reservation, legacy } = assertIdentity(after, b);
        for (const row of before.audits) if (!equal(row, after.audits.find(item => String(item._id) === String(row._id))))
            reject('PREVIOUS_AUDIT_CHANGED');
        const previous = Number(before.employee?.[SEQUENCE]), current = Number(after.employee?.[SEQUENCE]);
        if (!Number.isSafeInteger(previous) || current !== previous + 1 ||
            (options.expectedPreviousSequence !== undefined && previous !== options.expectedPreviousSequence) ||
            before.employee[SEQUENCE]?._bsontype !== after.employee[SEQUENCE]?._bsontype) reject('MUTATION_SEQUENCE_MISMATCH');
        const { [SEQUENCE]: oldSequence, ...oldBusiness } = before.employee;
        const { [SEQUENCE]: newSequence, ...newBusiness } = after.employee;
        if (!equal(oldBusiness, newBusiness)) reject('EMPLOYEE_BUSINESS_CHANGED');
        if (!equal(before.history, after.history)) reject('HISTORY_CHANGED');
        if (!equal(before.references, after.references)) reject('PROTECTED_DOCUMENTS_CHANGED');
        const newAudits = after.audits.filter(row => !before.audits.some(old => String(old._id) === String(row._id)));
        const finals = after.audits.filter(row => row.mutationSource === SOURCE &&
            (row.diagnostics?.executionId === b.executionId || row.diagnostics?.legacyAttemptId === b.legacyAttemptId));
        if (newAudits.length !== 1 || finals.length !== 1 || String(finals[0]._id) !== finalId(b) || newAudits[0] !== finals[0])
            reject('FINAL_FENCE_AUDIT_MISMATCH');
        const final = plain(finals[0]), r = plain(reservation), f = final.diagnostics;
        if (!A.equal(final.employeeScope, r.employeeScope) || !A.equal(final.currentBefore, r.currentBefore) ||
            !A.equal(final.historyBefore, r.historyBefore) || !A.equal(final.historyAfter, r.historyAfter) ||
            !A.equal(final.survivingHistoryIds, r.survivingHistoryIds) || final.deletedLegacyHistoryIds.length ||
            !['executionId', 'actorUserId', 'legacyAttemptId', 'fingerprint', 'approvalFingerprint'].every(key => f[key] === r.diagnostics[key]) ||
            f.previousSequence !== previous || f.sequence !== current || f.requiresNewIndependentApproval !== true ||
            f.referencesHash !== A.hash(plain(before.referenceSummary)) ||
            f.historyHash !== A.hash(plain(before.history)) || f.legacyHash !== A.hash(plain(legacy)) || !(final.repairedAt instanceof Date))
            reject('FINAL_FENCE_AUDIT_MISMATCH');
        verifyMarker(options, before);
        return { outcome: 'COMMITTED', independentlyVerified: true, auditId: finalId(b), sequence: current,
            historyCount: after.history.length, protectedDocumentCount: Object.values(after.references).reduce((n, rows) => n + rows.length, 0),
            originalReservationPreserved: true, previousAuditsPreserved: true, ticketMarkerVerified: true, unauthorizedChanges: 0 };
    } catch (error) { return { outcome: 'BLOCKED', reason: error.reason || 'INDEPENDENT_VERIFICATION_UNCERTAIN', retryAllowed: false }; }
}
module.exports = { captureFenceVerificationEvidence, verifyLegacyFenceIndependently };
