'use strict';

const assert = require('assert');
const fs = require('fs');
const { finalizeEmploymentPeriod, openCorrectiveCase } = require('./apasxoliseisPeriodLifecycleService');

const scope = { team: 'T', company_kod: '507f1f77bcf86cd799439099', ypokatasthma: '0001',
    period_start: '2026-06-01', period_end: '2026-06-30' };
const session = { userRole: 'HR', userId: '507f1f77bcf86cd799439011', userName: 'HR' };
const transactionRunner = async (work) => work({ id: 'tx' });
const indexGuard = async () => ({ ready: true });
const snapshotInput = { dailyResults: [{ kodikos: '1', hmeromhnia: '2026-06-01',
    ores_ergasias_apologistika: 8 }] };
const query = (value) => ({ session() { return this; }, async lean() { return value; } });
const sameScope = (row, filter) => ['team', 'company_kod', 'ypokatasthma'].every((field) =>
    String(row[field]) === String(filter[field])) && ['period_start', 'period_end'].every((field) =>
    new Date(row[field]).toISOString() === new Date(filter[field]).toISOString());

function versionedStore({ reconstructionVersion, existingSnapshots = [] }) {
    let control = { ...scope, status: 'LOCKED', version: 4, active_calculation_id: '',
        frozen_snapshot_id: null, frozen_snapshot_fingerprint: '',
        historical_reconstruction_status: reconstructionVersion > 0 ? 'COMPLETED' : '',
        historical_reconstruction_version: reconstructionVersion,
        historical_dependency_fingerprint: reconstructionVersion > 0 ? 'd'.repeat(64) : '' };
    const snapshots = existingSnapshots.map((item) => ({ ...item }));
    const audits = [];
    return {
        period: {
            findOne() { return query({ ...control }); },
            async findOneAndUpdate(filter, update) {
                if (control.status !== filter.status || control.version !== filter.version) return null;
                control = { ...control, ...update.$set }; return { ...control };
            }
        },
        frozen: {
            findOne(filter) {
                const found = snapshots.find((row) => {
                    if (filter.request_id !== undefined) return row.team === filter.team &&
                        row.company_kod === filter.company_kod && row.request_id === filter.request_id;
                    return sameScope(row, filter) && row.historical_reconstruction_version ===
                        filter.historical_reconstruction_version;
                });
                return query(found ? { ...found } : null);
            },
            async create(documents) {
                const document = { _id: `507f1f77bcf86cd7994390${12 + snapshots.length}`, ...documents[0] };
                if (snapshots.some((row) => sameScope(row, document) &&
                    row.historical_reconstruction_version === document.historical_reconstruction_version)) {
                    const error = new Error('duplicate scope version'); error.code = 11000; throw error;
                }
                snapshots.push(document); return [{ ...document }];
            }
        },
        audit: { async create(documents) { audits.push(...documents); return documents; } },
        snapshots, audits,
        get control() { return control; }
    };
}

async function finalize(store, requestId) {
    return finalizeEmploymentPeriod({ session, scope, reason: 'Οριστικοποίηση', requestId, snapshotInput,
        periodControlModel: store.period, frozenModel: store.frozen, auditModel: store.audit,
        indexGuard, transactionRunner,
        historicalFingerprintResolver: async () => ({ dependency_fingerprint: 'd'.repeat(64) }) });
}

(async () => {
    const versionOne = { _id: '507f1f77bcf86cd799439001', ...scope,
        historical_reconstruction_version: 1, request_id: 'version-one-request',
        frozen_snapshot_fingerprint: '1'.repeat(64), frozen_snapshot: { version: 1 } };
    const immutableVersionOne = JSON.stringify(versionOne);
    const versioned = versionedStore({ reconstructionVersion: 2, existingSnapshots: [versionOne] });
    const result = await finalize(versioned, 'version-two-request');
    assert.strictEqual(result.idempotent, false);
    assert.strictEqual(versioned.snapshots.length, 2);
    assert.strictEqual(JSON.stringify(versioned.snapshots[0]), immutableVersionOne);
    assert.strictEqual(versioned.snapshots[1].historical_reconstruction_version, 2);
    assert.strictEqual(versioned.control.status, 'FINALIZED');
    assert.strictEqual(String(versioned.control.frozen_snapshot_id), String(versioned.snapshots[1]._id));
    assert.strictEqual(versioned.audits[0].event_type, 'FINALIZE');
    assert.strictEqual(versioned.audits[0].reference_id, String(versioned.snapshots[1]._id));

    const retry = await finalize(versioned, 'version-two-request');
    assert.strictEqual(retry.idempotent, true);
    assert.strictEqual(versioned.snapshots.length, 2);

    const sameVersion = versionedStore({ reconstructionVersion: 2, existingSnapshots: [{ ...versionOne,
        historical_reconstruction_version: 2, request_id: 'different-version-two-request' }] });
    await assert.rejects(() => finalize(sameVersion, 'new-version-two-request'),
        (error) => error.code === 'PERIOD_FROZEN_SNAPSHOT_VERSION_CONFLICT' && error.statusCode === 409);
    assert.strictEqual(sameVersion.snapshots.length, 1);
    assert.strictEqual(sameVersion.control.status, 'LOCKED');

    const normal = versionedStore({ reconstructionVersion: 0, existingSnapshots: [{ ...versionOne,
        historical_reconstruction_version: 0, request_id: 'normal-existing-request' }] });
    await assert.rejects(() => finalize(normal, 'normal-second-request'),
        (error) => error.code === 'PERIOD_FROZEN_SNAPSHOT_VERSION_CONFLICT' && error.statusCode === 409);
    assert.strictEqual(normal.snapshots.length, 1);

    const correctiveCreates = [];
    const controlSnapshotId = '507f1f77bcf86cd799439022';
    const corrective = await openCorrectiveCase({ session, scope, reason: 'Διόρθωση', caseId: 'case-versioned',
        periodControlModel: { findOne() { return query({ ...scope, status: 'FINALIZED',
            frozen_snapshot_id: controlSnapshotId, frozen_snapshot_fingerprint: '2'.repeat(64) }); } },
        correctiveModel: { async create(documents) { correctiveCreates.push(...documents); return documents; } },
        auditModel: { async create(documents) { return documents; } }, indexGuard, transactionRunner });
    assert.strictEqual(String(corrective.baseline_snapshot_reference), controlSnapshotId);
    assert.strictEqual(corrective.baseline_fingerprint, '2'.repeat(64));
    assert.strictEqual(String(correctiveCreates[0].baseline_snapshot_reference), controlSnapshotId);

    const correctivePostingSource = fs.readFileSync(require.resolve('./apasxoliseisCorrectivePayrollPostingService'), 'utf8');
    assert.match(correctivePostingSource,
        /frozenModel\.findOne\(\{ _id: corrective\.baseline_snapshot_reference, \.\.\.scope,[\s\S]*?frozen_snapshot_fingerprint: corrective\.baseline_fingerprint/);

    console.log('versioned employment period frozen snapshot contracts: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
