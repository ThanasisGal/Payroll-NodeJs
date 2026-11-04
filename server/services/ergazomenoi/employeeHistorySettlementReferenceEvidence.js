'use strict';

// NORMAL-only evidence contract. The legacy preparation:v1 hash and the
// representative reference checker deliberately retain their old semantics.
const { createHash } = require('node:crypto');
const { BSON } = require('mongoose').mongo;
const { REFERENCE_QUERIES } = require('./employeeHistoryReferenceAuditService');
const VERSION = 'employee-history-settlement-reference-evidence:v2';
const CONTRACT_KEY = 'referenceEvidenceContract';
const digest = raw => createHash('sha256').update(raw).digest('hex');

async function referenceSummary(connection, rows, session) {
    const summary = { [CONTRACT_KEY]: VERSION };
    for (const row of [...rows].sort((a, b) => String(a._id).localeCompare(String(b._id)))) {
        const id = String(row._id), values = [id, new BSON.ObjectId(id)];
        const references = [];
        for (const [collection, fields] of REFERENCE_QUERIES) {
            // Hash the actual wire BSON, avoiding numeric promotion, JSON
            // conversion and the different projections of model/native reads.
            const documents = await connection.collection(collection).find({
                $or: fields.map(field => ({ [field]: { $in: values } }))
            }, { session, raw: true }).sort({ _id: 1 }).toArray();
            for (const raw of documents) {
                if (!Buffer.isBuffer(raw)) throw new TypeError('Raw BSON reference evidence required');
                const document = BSON.deserialize(raw, { promoteValues: false });
                references.push({ collection, documentId: String(document._id),
                    documentIdBson: BSON.serialize({ _id: document._id }).toString('base64'),
                    evidenceVersion: VERSION, bsonSha256: digest(raw) });
            }
        }
        summary[id] = references;
    }
    return summary;
}

// Claim every existing document, including nonrepresentatives. Reading twice
// under snapshot isolation alone cannot detect a concurrent delete/update.
// Temporary technical metadata is restored in the SAME transaction; the real
// write intent remains until commit. New references also require their writers'
// existing History fence, which this settlement already claims for every row.
async function claimReferenceEvidence(connection, summary, session, claimId) {
    const P = require('./employeeHistorySettlementProtocol');
    if (!session?.inTransaction() || summary[CONTRACT_KEY] !== VERSION) throw P.blocked('REFERENCE_CONTRACT_REQUIRED');
    const field = '__employee_history_settlement_reference_claim';
    const seen = new Set();
    for (const references of Object.values(summary).filter(Array.isArray)) {
        for (const reference of references) {
            const key = reference.collection + ':' + reference.documentIdBson;
            if (seen.has(key)) continue;
            seen.add(key);
            if (reference.evidenceVersion !== VERSION || !REFERENCE_QUERIES.some(([name]) => name === reference.collection))
                throw P.blocked('REFERENCE_CONTRACT_REQUIRED');
            const identity = BSON.deserialize(Buffer.from(reference.documentIdBson, 'base64'), { promoteValues: false });
            const collection = connection.collection(reference.collection);
            const raw = await collection.findOne(identity, { session, raw: true });
            if (!Buffer.isBuffer(raw) || digest(raw) !== reference.bsonSha256) throw P.blocked('REFERENCE_CHANGED');
            const claimed = await collection.updateOne({ ...identity, [field]: { $exists: false } },
                { $set: { [field]: claimId } }, { session });
            if (claimed.modifiedCount !== 1) throw P.blocked('REFERENCE_CLAIM_FAILED');
            const restored = await collection.updateOne({ ...identity, [field]: claimId }, { $unset: { [field]: 1 } }, { session });
            if (restored.modifiedCount !== 1) throw P.blocked('REFERENCE_RESTORE_FAILED');
        }
    }
}

// A new evidence representation must never give an unresolved old attempt a
// new identity. Only a proved terminal outcome or completed legacy sequence
// fence permits an independent approval to proceed. No proposal comparison.
async function assertPriorAttemptsClosed({ auditModel, scope, employeeId, fingerprint,
    currentEmployee, session, protocol }) {
    const P = require('./employeeHistorySettlementProtocol');
    const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
    const records = await auditModel.find({ 'employeeScope.team': scope.team,
        'employeeScope.company_kod': scope.company_kod, 'employeeScope.kodikos': scope.kodikos,
        'employeeScope.employee_id': employeeId }).session(session).lean();
    for (const attempt of records.filter(row => row.mutationSource === P.ATTEMPT &&
        row.diagnostics?.fingerprint !== fingerprint)) {
        const old = attempt.diagnostics;
        if (!old || typeof old.actorUserId !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(old.fingerprint || ''))
            throw P.blocked('PRIOR_APPROVAL_REQUIRES_RECONCILIATION');
        const committed = records.find(row => row.mutationSource === 'EMPLOYEE_HISTORY_SETTLEMENT' &&
            (row.diagnostics?.approvalFingerprint === old.fingerprint ||
                old.protocol?.version === P.VERSION && row.diagnostics?.protocol?.rootId === old.protocol.rootId) &&
            row.diagnostics?.actorUserId === old.actorUserId);
        if (committed) { await P.assertCommitted({ auditModel, audit: committed, session }); continue; }
        if (old.protocol?.version === P.VERSION) {
            const terminal = records.find(row => String(row._id) === old.protocol.terminalId);
            const grant = records.find(row => row.mutationSource === P.GRANT &&
                row.diagnostics?.fingerprint === fingerprint && A.equal(row.diagnostics.protocol, protocol));
            if (protocol && grant && protocol.rootId === old.protocol.rootId &&
                protocol.generation > old.protocol.generation &&
                terminal?.mutationSource === P.TERMINAL && terminal.diagnostics?.outcome === 'FENCED' &&
                terminal.diagnostics.fingerprint === old.fingerprint &&
                terminal.diagnostics.actorUserId === old.actorUserId &&
                A.equal(terminal.diagnostics.protocol, old.protocol)) continue;
        } else if (!old.protocol) {
            const fence = records.find(row => row.mutationSource === 'EMPLOYEE_HISTORY_LEGACY_APPROVAL_FENCE' &&
                row.diagnostics?.legacyAttemptId === String(attempt._id) && row.diagnostics.fingerprint === old.fingerprint &&
                row.diagnostics.previousSequence === (attempt.currentBefore?.employee_profile_mutation_sequence ?? null) &&
                row.diagnostics.sequence === (attempt.currentBefore?.employee_profile_mutation_sequence || 0) + 1 &&
                row.diagnostics.sequence <= currentEmployee.employee_profile_mutation_sequence &&
                row.diagnostics.requiresNewIndependentApproval === true &&
                row.diagnostics.legacyHash === A.hash(attempt));
            if (fence) continue;
        }
        throw P.blocked('PRIOR_APPROVAL_REQUIRES_RECONCILIATION');
    }
}

async function findSettlementHistoryIdReferences({ connection, historyIds = [], session }) {
    const summary = await referenceSummary(connection, historyIds.map(_id => ({ _id })), session);
    const unique = new Map();
    for (const references of Object.values(summary).filter(Array.isArray))
        for (const reference of references) unique.set(reference.collection + ':' + reference.documentIdBson, reference);
    return [...unique.values()];
}

module.exports = { VERSION, CONTRACT_KEY, referenceSummary, findSettlementHistoryIdReferences,
    claimReferenceEvidence, assertPriorAttemptsClosed };
