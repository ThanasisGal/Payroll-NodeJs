'use strict';
const { BSON } = require('mongoose').mongo;
const { referenceSummary, claimReferenceEvidence, CONTRACT_KEY } = require('./employeeHistorySettlementReferenceEvidence');
const { partitionHistoryUpdateReferences } = require('./employeeHistoryReferenceSemanticsService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const P = require('./employeeHistoryApprovedProposalContract');

// Registry classification is necessary, never sufficient. Only the current,
// independently reproducible frozen payload is admitted here. Other legacy,
// live, incomplete or unknown shapes retain the reference barrier.
async function inspectApprovedReferences({ connection, historyRows, scope, session, allowLegacySnapshots = false }) {
    const evidence = await referenceSummary(connection, historyRows, session);
    evidence.frozenPeriodProtections = null;
    for (const [historyId, references] of Object.entries(evidence).filter(([, value]) => Array.isArray(value))) {
        let partition;
        try { partition = partitionHistoryUpdateReferences(references); } catch { throw P.failure('REFERENCE'); }
        if (partition.liveDereference.length) throw P.failure('REFERENCE');
        for (const reference of partition.frozenProvenance) {
            if (reference.collection !== 'Apasxoliseis_Period_Frozen_Snapshots') throw P.failure('REFERENCE');
            const identity = BSON.deserialize(Buffer.from(reference.documentIdBson, 'base64'));
            const doc = await connection.collection(reference.collection).findOne(identity, { session });
            if (allowLegacySnapshots) {
                require('./employeeHistoryFrozenProvenanceContract').verifyStoredFrozenProvenance(doc, scope, historyId);
                const controls = await connection.collection('Apasxoliseis_Period_Controls').find({
                    team: doc.team, company_kod: doc.company_kod, ypokatasthma: doc.ypokatasthma,
                    period_start: doc.period_start, period_end: doc.period_end
                }, { session, raw: true }).toArray();
                if (controls.length > 1) throw P.failure('REFERENCE');
                if (controls.length) {
                    const control = BSON.deserialize(controls[0]);
                    if (control.status !== 'FINALIZED' || String(control.frozen_snapshot_id) !== String(doc._id) ||
                        control.frozen_snapshot_fingerprint !== doc.frozen_snapshot_fingerprint) throw P.failure('REFERENCE');
                    evidence.frozenPeriodProtections ||= {};
                    evidence.frozenPeriodProtections[reference.documentId] = { id: control._id,
                        sha256: require('node:crypto').createHash('sha256').update(controls[0]).digest('hex') };
                }
                continue;
            }
            const F = require('./apasxoliseisPeriodFrozenSnapshotService');
            const snapshot = doc?.frozen_snapshot, context = snapshot?.weekly_calculation_context;
            if (!doc || doc.team !== scope.team || String(doc.company_kod) !== scope.company_kod ||
                doc.snapshot_schema_version !== F.SNAPSHOT_SCHEMA_VERSION || !context ||
                snapshot.snapshot_schema_version !== doc.snapshot_schema_version ||
                snapshot.source_calculation_version !== doc.source_calculation_version ||
                snapshot.scope?.team !== scope.team || snapshot.scope?.company_kod !== scope.company_kod ||
                snapshot.scope?.ypokatasthma !== doc.ypokatasthma ||
                !doc.period_start || !doc.period_end || new Date(doc.period_start) > new Date(doc.period_end) ||
                new Date(snapshot.scope.period_start).getTime() !== new Date(doc.period_start).getTime() ||
                new Date(snapshot.scope.period_end).getTime() !== new Date(doc.period_end).getTime() ||
                !Array.isArray(context.profile_history) || !Array.isArray(snapshot.daily_results)) throw P.failure('REFERENCE');
            const control = await connection.collection('Apasxoliseis_Period_Controls').findOne({
                team: scope.team, company_kod: scope.company_kod, ypokatasthma: doc.ypokatasthma,
                period_start: doc.period_start, period_end: doc.period_end, status: 'FINALIZED',
                frozen_snapshot_id: doc._id, frozen_snapshot_fingerprint: doc.frozen_snapshot_fingerprint
            }, { session, raw: true });
            if (!Buffer.isBuffer(control)) throw P.failure('REFERENCE');
            evidence.frozenPeriodProtections ||= {};
            evidence.frozenPeriodProtections[reference.documentId] = {
                id: BSON.deserialize(control)._id, sha256: require('node:crypto').createHash('sha256').update(control).digest('hex') };
            const profiles = context.profile_history.filter(row => String(row._id) === historyId);
            if (profiles.length !== 1 || profiles[0].kodikos !== scope.kodikos ||
                !['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias']
                    .every(field => typeof profiles[0][field] === 'number' && Number.isFinite(profiles[0][field]))) throw P.failure('REFERENCE');
            const rebuilt = F.buildEmploymentPeriodFrozenSnapshot({ scope: snapshot.scope, employees: snapshot.employees,
                dailyResults: snapshot.daily_results, weeklyDailyResults: context.rows, profileHistory: context.profile_history,
                calendarFacts: context.calendar_facts, appliedTransferProtection: context.applied_transfer_protection,
                payrollResults: snapshot.payroll_results, deviations: snapshot.deviations, canonicalDecisions: snapshot.canonical_decisions,
                appliedRepoTransfers: snapshot.applied_repo_transfers, payrollPhaseFacts: snapshot.payroll_phase_facts,
                policyContext: snapshot.policy_context, sourceCalculationVersion: snapshot.source_calculation_version });
            if (!A.equal(rebuilt.snapshot, snapshot) || rebuilt.frozen_snapshot_fingerprint !== doc.frozen_snapshot_fingerprint)
                throw P.failure('REFERENCE');
        }
    }
    return evidence;
}
async function claimApprovedReferences(connection, evidence, session, approvalId) {
    try { await claimReferenceEvidence(connection, evidence, session, approvalId); }
    catch (error) { if (typeof error.code === 'string' && error.code.includes('REFERENCE')) throw P.failure('REFERENCE'); throw error; }
    // Fence the existing FINALIZED control as well. No status/version/amount
    // changes survive this transaction; original BSON is checked after restore.
    const collection = connection.collection('Apasxoliseis_Period_Controls');
    const field = '__employee_history_approved_reference_claim';
    for (const proof of Object.values(evidence.frozenPeriodProtections || {})) {
        const raw = await collection.findOne({ _id: proof.id }, { session, raw: true });
        if (!Buffer.isBuffer(raw) || require('node:crypto').createHash('sha256').update(raw).digest('hex') !== proof.sha256)
            throw P.failure('REFERENCE');
        if ((await collection.updateOne({ _id: proof.id, [field]: { $exists: false } }, { $set: { [field]: approvalId } }, { session })).matchedCount !== 1 ||
            (await collection.updateOne({ _id: proof.id, [field]: approvalId }, { $unset: { [field]: 1 } }, { session })).matchedCount !== 1)
            throw P.failure('REFERENCE');
        const restored = await collection.findOne({ _id: proof.id }, { session, raw: true });
        if (!Buffer.isBuffer(restored) || require('node:crypto').createHash('sha256').update(restored).digest('hex') !== proof.sha256)
            throw P.failure('REFERENCE');
    }
}
function sameReferenceEvidence(before, after) {
    return before?.[CONTRACT_KEY] === after?.[CONTRACT_KEY] && A.equal(before, after);
}
module.exports = { inspectApprovedReferences, claimApprovedReferences, sameReferenceEvidence };
