'use strict';
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const P = require('./employeeHistoryApprovedProposalContract');
const { verifyStoredFrozenProvenance } = require('./employeeHistoryFrozenProvenanceContract');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const VERSION = 'company-serialized-legacy-history-protection:v1';
const preparedReads = new WeakMap();
const snapshotFields = ['_id', 'team', 'company_kod', 'ypokatasthma', 'period_start', 'period_end',
    'snapshot_schema_version', 'source_calculation_version', 'frozen_snapshot_fingerprint', 'finalized_at'];
async function readLegacyProtection({ input, period, session, dependencies: d, preserveOriginal = false, compactEvidence = false }) {
    const filter = { team: input.scope.team, company_kod: input.scope.company_kod,
        period_start: mongoose.trusted({ $lte: new Date(period.to || '9999-12-31') }),
        period_end: mongoose.trusted({ $gte: new Date(period.from || '0001-01-01') }) };
    // Validate the company's rows BEFORE range filtering: missing/invalid dates
    // must not disappear from a Mongo range query and masquerade as no control.
    const company = { team: input.scope.team, company_kod: input.scope.company_kod };
    // In preservation mode both former reads use the exact same company scope.
    // Decode the raw evidence once for validation, retaining every original byte
    // for the existing fingerprint and write claims. Never reuse it across calls.
    const rawByModel = new Map();
    const readCompany = async model => {
        if (!preserveOriginal) return model.find(company).sort({ _id: 1 }).limit(1001).session(session).lean();
        const documents = await model.collection.find(company, { session, raw: true }).sort({ _id: 1 }).limit(1001).toArray();
        if (documents.length > 1000 || documents.some(raw => !Buffer.isBuffer(raw))) throw P.failure('PROTECTION_UNKNOWN');
        rawByModel.set(model, documents);
        return documents.map(raw => mongoose.mongo.BSON.deserialize(raw, model.collection.collection?.bsonOptions));
    };
    const allControls = await readCompany(d.periodControlModel);
    const allSnapshots = await readCompany(d.frozenModel);
    if (allControls.length > 1000 || allSnapshots.length > 1000) throw P.failure('PROTECTION_UNKNOWN');
    let uncertain = false;
    for (const row of [...allControls, ...allSnapshots]) if (row.team !== input.scope.team ||
        row.company_kod !== input.scope.company_kod || typeof row.ypokatasthma !== 'string' ||
        !row.ypokatasthma.trim() || row.ypokatasthma !== row.ypokatasthma.trim() ||
        !(row.period_start instanceof Date) || !(row.period_end instanceof Date) || !Number.isFinite(new Date(row.period_start).getTime()) ||
        !Number.isFinite(new Date(row.period_end).getTime()) || new Date(row.period_start) > new Date(row.period_end)) {
        if (preserveOriginal) uncertain = true; else throw P.failure('PROTECTION_UNKNOWN');
    }
    const overlaps = row => preserveOriginal && (!row.period_start || !row.period_end) || new Date(row.period_start) <= new Date(period.to || '9999-12-31') && new Date(row.period_end) >= new Date(period.from || '0001-01-01');
    const controls = allControls.filter(overlaps), snapshots = allSnapshots.filter(overlaps);
    for (const control of controls) {
        if (control.active_calculation_id != null && typeof control.active_calculation_id !== 'string') {
            if (preserveOriginal) uncertain = true; else throw P.failure('PROTECTION_UNKNOWN');
        }
        if (!preserveOriginal && control.active_calculation_id) throw P.failure('PERIOD_BUSY');
        if (!preserveOriginal && control.status === 'LOCKED') throw P.failure('PERIOD_PROTECTED');
        if (!['OPEN', 'FINALIZED', ...(preserveOriginal ? ['LOCKED'] : [])].includes(control.status)) {
            if (preserveOriginal) uncertain = true; else throw P.failure('PROTECTION_UNKNOWN');
        }
        if (!preserveOriginal && control.status === 'FINALIZED') {
            const snapshot = snapshots.find(row => String(row._id) === String(control.frozen_snapshot_id));
            if (!snapshot || snapshot.frozen_snapshot_fingerprint !== control.frozen_snapshot_fingerprint ||
                snapshot.ypokatasthma !== control.ypokatasthma ||
                new Date(snapshot.period_start).getTime() !== new Date(control.period_start).getTime() ||
                new Date(snapshot.period_end).getTime() !== new Date(control.period_end).getTime()) throw P.failure('REFERENCE');
        }
    }
    if (!preserveOriginal) for (const snapshot of snapshots) verifyStoredFrozenProvenance(snapshot, input.scope, null);
    const wire = [];
    for (const model of [d.periodControlModel, d.frozenModel]) {
        const documents = preserveOriginal ? rawByModel.get(model)
            : await model.collection.find(filter, { session, raw: true }).sort({ _id: 1 }).limit(1001).toArray();
        if (documents.length > 1000 || documents.some(raw => !Buffer.isBuffer(raw))) throw P.failure('PROTECTION_UNKNOWN');
        for (const raw of documents) {
            const document = mongoose.mongo.BSON.deserialize(raw, { promoteValues: false });
            wire.push({ collection: model.collection.name, identityBson: mongoose.mongo.BSON.serialize({ _id: document._id }).toString('base64'), sha256: digest(raw) });
        }
    }
    // The exact original BSON remains bound by wire SHA-256 and is still claimed
    // and reread in the transaction. Audit needs identities/provenance, not another
    // copy of every employee's finalized payroll payload in one BSON document.
    const compact = preserveOriginal && compactEvidence;
    const result = { version: VERSION, ...(preserveOriginal ? { uncertain } : {}), controls,
        snapshots: compact ? snapshots.map(row => Object.fromEntries(snapshotFields.filter(key => Object.hasOwn(row, key))
            .map(key => [key, row[key]]))) : snapshots, wire, absentPeriodsAllowed: true,
        ...(compact ? { evidenceFormat: 'wire-referenced-snapshots:v1' } : {}),
        serialization: 'EXISTING_COMPANY_DOCUMENT', createdPeriodControls: 0 };
    // Reuse only this exact read in this exact transaction attempt. A write
    // conflict on the subsequent claim detects concurrent changes. The post-claim
    // raw reread and byte hash verification remain mandatory.
    if (compact && session?.inTransaction?.() && session.transaction) preparedReads.set(result,
        { session, transaction: session.transaction, wireHash: digest(Buffer.from(JSON.stringify(wire))) });
    return result;
}
async function claimLegacyProtection({ protection, connection, session }) {
    if (protection.version !== VERSION || !session?.inTransaction?.()) throw P.failure('BOUNDARY');
    const cached = preparedReads.get(protection);
    const sameRead = cached?.session === session && cached.transaction === session.transaction &&
        cached.wireHash === digest(Buffer.from(JSON.stringify(protection.wire)));
    const field = '__employee_history_legacy_protection_claim';
    for (const proof of protection.wire) {
        if (!['Apasxoliseis_Period_Controls', 'Apasxoliseis_Period_Frozen_Snapshots'].includes(proof.collection)) throw P.failure('BOUNDARY');
        const identity = mongoose.mongo.BSON.deserialize(Buffer.from(proof.identityBson, 'base64'), { promoteValues: false });
        const collection = connection.collection(proof.collection);
        if (!sameRead) {
            const before = await collection.findOne(identity, { session, raw: true });
            if (!Buffer.isBuffer(before) || digest(before) !== proof.sha256) throw P.failure('STALE');
        }
        if ((await collection.updateOne({ ...identity, [field]: { $exists: false } }, { $set: { [field]: true } }, { session })).matchedCount !== 1 ||
            (await collection.updateOne({ ...identity, [field]: true }, { $unset: { [field]: 1 } }, { session })).matchedCount !== 1) throw P.failure('STALE');
        const after = await collection.findOne(identity, { session, raw: true });
        if (!Buffer.isBuffer(after) || digest(after) !== proof.sha256) throw P.failure('VERIFICATION');
    }
}
module.exports = { VERSION, readLegacyProtection, claimLegacyProtection };
