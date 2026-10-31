'use strict';

// Test-only capability registry. The writer never accepts caller-supplied
// connections/models; only these closed-over instances of the existing store.
const { store, deferred } = require('./employeeProfileTransactionStore');
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { real0006BoundaryStructure } = require('../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const contexts = new WeakMap();

function createSyntheticSettlementStore({ actor, permission, enriched = true, recordedCoverage = false, fixture, executionMode } = {}) {
    const input = fixture ? S.clone(fixture) : real0006BoundaryStructure();
    if (enriched) for (const row of input.completeHistoryRows) {
        Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
    }
    // The current main permits Supervisor repair only within an already covered
    // cycle. Keep the original gap fixture separate from this explicit variant.
    if (recordedCoverage) for (const row of [input.currentEmployee, ...input.completeHistoryRows]) {
        Object.assign(row, { hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
            hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-15') });
    }
    const db = store([{ employee: input.currentEmployee, history: input.completeHistoryRows }], { cloneFn: S.clone });
    let failure = null, writeCount = 0, insertCount = 0, paused = null;
    const references = fixture ? Object.entries(input.protectedReferenceSummary).flatMap(([historyId, refs]) =>
        refs.map(reference => ({ ...S.clone(reference), historyId }))) : input.completeHistoryRows.slice(0, 2).map((row, index) => ({
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: `synthetic-frozen-${index}`,
        historyId: String(row._id), frozen_snapshot: { finalized: true, amount: 123.45, hours: 8 }
    }));
    const rawStart = db.deps.connection.startSession;
    const unknownCommit = withMethod => {
        const error = Error('SYNTHETIC_COMMIT_RESULT_UNKNOWN');
        error.errorLabels = ['UnknownTransactionCommitResult'];
        if (withMethod) error.hasErrorLabel = label => error.errorLabels.includes(label);
        return error;
    };
    const connection = Object.freeze({ async startSession() {
        const session = await rawStart();
        const run = session.withTransaction.bind(session);
        session.withTransaction = async work => {
            await run(async () => {
                // Refresh auxiliary snapshots on every attempt, using the same
                // transaction/retry implementation; no second commit engine exists.
                session.syntheticReferences = S.clone(references);
                session.syntheticActor = S.clone(actor);
                session.syntheticPermission = S.clone(permission);
                const result = await work();
                if (failure === 'COMMIT_UNKNOWN_BEFORE') {
                    failure = null;
                    throw unknownCommit(false);
                }
                return result;
            });
            // Lose only the acknowledgement, after the existing store has committed.
            if (failure === 'COMMIT_ACK_LOST') {
                failure = null;
                throw unknownCommit(true);
            }
        };
        return session;
    } });
    const query = read => ({ select() { return this; }, session(value) { this.s = value; return this; },
        async lean() { return S.clone(read(this.s)); } });
    const userModel = Object.freeze({ findById(id) { return query(session =>
        session.syntheticActor && String(session.syntheticActor._id) === String(id) ? session.syntheticActor : null); } });
    const privilegeModel = Object.freeze({ findOne(filter) { return query(session =>
        session.syntheticActor && filter.userId === String(session.syntheticActor._id) && filter.form === 'Ergazomenoi'
            ? { privileges: session.syntheticPermission } : null); } });
    const rawUpdate = db.deps.historyModel.updateOne;
    db.deps.historyModel.updateOne = async (...args) => {
        const result = await rawUpdate(...args);
        if (failure === 'WRITE' && ++writeCount === 2) throw Error('SYNTHETIC_HISTORY_WRITE_FAILED');
        return result;
    };
    const rawAudit = db.deps.auditModel.create;
    const rawInsert = db.deps.historyModel.create;
    db.deps.historyModel.create = async (...args) => {
        const created = await rawInsert(...args);
        db.events.push({ type: 'syntheticInsert', historyId: String(created[0]._id) });
        if (failure === 'INSERT' && ++insertCount === 2) throw Error('SYNTHETIC_INSERT_FAILED');
        if (failure === 'INSERT_EMPTY') return [];
        if (failure === 'INSERT_TAMPER') args[1].session.draft.history.at(-1).ores_ergasias_ebdomadas = 99;
        return created;
    };
    db.deps.auditModel.create = async (records, options) => {
        const created = await rawAudit(records, options);
        if (failure === 'AUDIT') throw Error('SYNTHETIC_AUDIT_FAILED');
        if (failure === 'AUDIT_EMPTY') return [];
        if (failure === 'FINAL') options.session.draft.history[0].history_reference_fence++;
        if (failure === 'AUDIT_TAMPER') options.session.draft.audits.at(-1).diagnostics.approvalFingerprint = 'tampered';
        return created;
    };
    db.hooks.read = async (_session, kind) => {
        if (kind === 'history' && paused) {
            const barrier = paused; paused = null;
            barrier.reached.resolve(); await barrier.resume.promise;
        }
    };
    const referenceChecker = async ({ historyIds, session }) => {
        if (failure === 'REFERENCES') throw Error('SYNTHETIC_REFERENCE_CHECK_FAILED');
        return S.clone(session.syntheticReferences.filter(item => historyIds.includes(item.historyId)));
    };
    const companyModel = Object.freeze({ findOne(filter) { return query(() =>
        String(filter._id) === String(input.scope.company_kod) && filter.team === input.scope.team
            ? { _id: input.scope.company_kod, team: input.scope.team } : null); } });
    const deps = Object.freeze({ ...db.deps, connection, userModel, privilegeModel, companyModel,
        referenceChecker, auditCollectionChecker: async () => failure !== 'AUDIT_MISSING' });
    Object.freeze(deps.employeeModel); Object.freeze(deps.historyModel); Object.freeze(deps.auditModel);
    const handle = Object.freeze({});
    contexts.set(handle, Object.freeze({ deps, ...(executionMode === 'CONTROLLED_DEV' ? { mode: 'CONTROLLED_DEV' } : {}),
        // Detached, memory-only snapshot for the isolated HTTP integration harness.
        readHttpSnapshot: actorUserId => {
            const state = db.state();
            return { actor: S.clone(actor), permission: S.clone(permission), audits: state.audits,
                input: { scope: S.clone(input.scope), actorUserId, employeeId: String(input.currentEmployee._id),
                    currentEmployee: state.employees[0], completeHistoryRows: state.history,
                    protectedReferenceSummary: Object.fromEntries(state.history.map(row =>
                        [String(row._id), S.clone(references.filter(item => item.historyId === String(row._id)))])) } };
        },
        readAudits: session => S.clone(session.draft.audits),
        referenceSummary: async (rows, session) => Object.fromEntries(await Promise.all(rows.map(async row =>
            [String(row._id), await referenceChecker({ historyIds: [String(row._id)], session })]))) }));
    return Object.freeze({ handle, events: db.events,
        state: () => ({ ...db.state(), references: S.clone(references) }),
        approvalInput(actorUserId) {
            const state = db.state();
            return { scope: S.clone(input.scope), actorUserId, employeeId: String(input.currentEmployee._id),
                currentEmployee: state.employees[0], completeHistoryRows: state.history,
                protectedReferenceSummary: Object.fromEntries(state.history.map(row =>
                    [String(row._id), S.clone(references.filter(item => item.historyId === String(row._id)))])) };
        },
        failAt(value) { failure = value; writeCount = 0; insertCount = 0; },
        pauseNextHistoryRead() {
            const barrier = { reached: deferred(), resume: deferred() }; paused = barrier;
            return { reached: barrier.reached.promise, resume: barrier.resume.resolve };
        },
        changeEmployee(patch) { db.changeCommittedEmployee(input.currentEmployee._id, patch); },
        changeHistory(historyId, patch) { db.changeCommittedHistory(historyId, patch); },
        addReference(historyId) {
            references.push({ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
                documentId: 'synthetic-new-reference', historyId: String(historyId), frozen_snapshot: { finalized: true, amount: 99 } });
            const row = db.state().history.find(item => String(item._id) === String(historyId));
            db.changeCommittedHistory(historyId, { history_reference_fence: (row.history_reference_fence || 0) + 1 });
        }
    });
}

function syntheticSettlementContext(handle) {
    if (handle && contexts.has(handle)) return contexts.get(handle);
    // Same internal writer and transaction engine; only a guarded CI fixture
    // can issue the additional capability. No HTTP/production caller does so.
    return require('./employeeHistorySettlementMongoStore').mongoSettlementContext(handle);
}

// Unlike syntheticSettlementContext, this has NO MongoDB fixture fallback.
function memorySettlementContext(handle) {
    if (!handle || !contexts.has(handle)) S.fail('SYNTHETIC_STORE_REQUIRED');
    return contexts.get(handle);
}
module.exports = { createSyntheticSettlementStore, syntheticSettlementContext, memorySettlementContext };
