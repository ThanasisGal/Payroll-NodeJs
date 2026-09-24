'use strict';

const assert = require('assert');
const Module = require('module');
const {
    persistOrphanResolutionWrite
} = require('../../services/ergazomenoi/apasxoliseisOrphanResolutionPersistenceService');

const originalModuleLoad = Module._load;
let erganhController;
try {
    Module._load = function orphanBoundaryModuleLoad(request, parent, isMain) {
        if (request === 'libxmljs2') {
            return {
                parseXml() {
                    throw new Error('Unexpected libxmljs2 use in orphan controller boundary test');
                }
            };
        }
        return originalModuleLoad.call(this, request, parent, isMain);
    };
    erganhController = require('./erganhController');
} finally {
    Module._load = originalModuleLoad;
}

const ID = '6a7c515e6aeaefb3c8764b54';
const oldRecord = Object.freeze({
    _id: ID, team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    kodikos: '0004', hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    cards_apo_ora_01: '14:51', cards_eos_ora_01: '', cards_ores_ergasias: 0,
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    is_locked: false, orphan_card_resolution: null
});

function request(overrides = {}) {
    const value = {
        params: { id: ID },
        body: {
            reason: 'Ρητή επίλυση ορφανού',
            updates: {
                cards_apo_ora_01: '00:00', cards_eos_ora_01: '01:00',
                apo_ora_01_apologistika: '14:51', eos_ora_01_apologistika: '23:21'
            },
            orphan_resolution: { approve: true, apologistiko_start: '14:51',
                apologistiko_end: '23:21', risk_acknowledged: false,
                reuse_scope: 'ONE_TIME' }
        },
        session: { userTeam: 'THA', companyInUse: 'company', userName: 'HR User',
            userRole: 'A', userStatus: 'A', userId: '507f191e810c19729de860ea',
            yearInUse: '2026', periodInUse: '06' }
    };
    return { ...value, ...overrides, body: { ...value.body, ...(overrides.body || {}) } };
}

function response() {
    return {
        statusCode: 200, payload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; }
    };
}

function preparedResolution(orphanType = 'START_ONLY', command = {}) {
    const start = command.apologistiko_start || '14:51';
    const end = command.apologistiko_end || '23:21';
    return {
        approvedOrphanResolution: {
            canApprove: true, requiresRiskAcknowledgement: false,
            orphanType, reuseScope: 'ONE_TIME',
            proposal: { start, end },
            approvedUpdates: { apo_ora_01_apologistika: start,
                eos_ora_01_apologistika: end },
            reusableDecisionRule: null, rest: { hasViolation: false, conflicts: [] }
        },
        dailyDerived: { derivedUpdate: { kathgoria_ergasias_apologistika: 'ΕΡΓ',
            ores_ergasias_apologistika: 8, repo_apologistika: false,
            adeia_apologistika: false, astheneia_apologistika: false,
            apousia_apologistika: false } }
    };
}

function overrides(persist, { record = oldRecord, loadRecord = null,
    orphanType = 'START_ONLY', prepareResolution = null } = {}) {
    return {
        loadOldRecord: async () => structuredClone(loadRecord ? loadRecord() : record),
        prepareOrphanResolution: async (input) => prepareResolution
            ? prepareResolution(input) : preparedResolution(orphanType,
                input.orphanResolutionCommand),
        getPeriodAccess: async () => ({ scope: {}, token: 'token',
            state: { effective_mode: 'NORMAL' } }),
        loadAppliedProtection: async () => ({ entriesByRowId: {}, diagnostics: [],
            hasConflicts: false }),
        periodFence: async ({ work }) => work({ session: { isolated: true } }),
        persistOrphanResolutionWrite: persist
    };
}

async function invoke(persist, options = {}) {
    const req = request(options.requestOverrides);
    const res = response();
    await erganhController.__orphanResolutionBoundaryTestHooks.withOverrides(
        overrides(persist, options),
        () => erganhController.updateProdhlomenaOrariaReviewRecord(req, res)
    );
    return { req, res };
}

async function run() {
    let receivedUpdates;
    const success = await invoke(async (input) => {
        receivedUpdates = input.semanticUpdates;
        return { idempotent: false, updated: true };
    });
    assert.strictEqual(success.res.statusCode, 200);
    assert.strictEqual(success.res.payload.success, true);
    assert.strictEqual(receivedUpdates.cards_apo_ora_01, undefined);
    assert.strictEqual(receivedUpdates.cards_eos_ora_01, undefined);
    assert.strictEqual(receivedUpdates.orphan_card_resolution.status, 'HR_APPROVED');

    for (const orphanType of ['START_ONLY', 'END_ONLY']) {
        const state = { row: structuredClone(oldRecord), audits: [] };
        const persisted = await invoke((input) => persistOrphanResolutionWrite({
            ...input,
            now: new Date('2026-09-23T05:04:06.842Z'),
            schemaPaths: Object.keys(state.row),
            rowModel: { async updateOne(filter, update) {
                assert.strictEqual(String(filter._id), ID);
                Object.assign(state.row, structuredClone(update.$set));
                return { matchedCount: 1 };
            } },
            auditModel: { async create([audit]) { state.audits.push(structuredClone(audit)); } }
        }), { orphanType });
        assert.strictEqual(persisted.res.statusCode, 200);
        assert.strictEqual(state.row.orphan_card_resolution.status, 'HR_APPROVED');
        assert.strictEqual(state.row.orphan_card_resolution.orphan_type, orphanType);
        assert.strictEqual(state.row.apologistiko_biblio, true);
        assert.strictEqual(state.row.is_locked, true);
        assert.strictEqual(state.audits[0].newValues.apologistiko_biblio, true);
    }

    const realRow = { ...oldRecord, kodikos: '0031',
        hmeromhnia: new Date('2026-08-07T00:00:00.000Z'),
        cards_apo_ora_01: '09:32', cards_eos_ora_01: '14:31',
        cards_apo_ora_02: '18:04', cards_eos_ora_02: '',
        apo_ora_01_apologistika: '09:32', eos_ora_01_apologistika: '14:31',
        apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '', eos_ora_03_apologistika: '' };
    const realState = { row: structuredClone(realRow), audits: [] };
    const realResult = await invoke((input) => persistOrphanResolutionWrite({
        ...input, now: new Date('2026-09-23T05:04:06.842Z'),
        schemaPaths: Object.keys(realState.row),
        rowModel: { async updateOne(_filter, update) {
            Object.assign(realState.row, structuredClone(update.$set));
            return { matchedCount: 1 };
        } },
        auditModel: { async create([audit]) { realState.audits.push(structuredClone(audit)); } }
    }), { record: realRow,
        requestOverrides: { body: { updates: {
            apo_ora_01_apologistika: '09:32', eos_ora_01_apologistika: '14:31',
            apo_ora_02_apologistika: '18:04', eos_ora_02_apologistika: '21:04' },
        orphan_resolution: { approve: true, pairs: [
            { pairNumber: 2, start: '18:04', end: '21:04' }
        ], risk_acknowledged: false, reuse_scope: 'ONE_TIME' } } },
        prepareResolution: async () => ({ approvedOrphanResolution: {
            canApprove: true, requiresRiskAcknowledgement: false,
            orphanType: 'START_ONLY', reuseScope: 'ONE_TIME',
            proposal: { start: '18:04', end: '21:04', workDurationMinutes: 479 },
            resolvedPairs: [{ pairNumber: 2, orphanType: 'START_ONLY',
                start: '18:04', end: '21:04' }],
            approvedUpdates: {
                apo_ora_01_apologistika: '09:32', eos_ora_01_apologistika: '14:31',
                apo_ora_02_apologistika: '18:04', eos_ora_02_apologistika: '21:04',
                apo_ora_03_apologistika: '', eos_ora_03_apologistika: '',
                ores_ergasias_apologistika: 7.983333333333333,
                apologistiko_biblio: true },
            reusableDecisionRule: null, rest: { hasViolation: false, conflicts: [] }
        }, dailyDerived: { derivedUpdate: {
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            ores_ergasias_apologistika: 7.98,
            ores_apoysias_apologistika: 0.02 } } }) });
    assert.strictEqual(realResult.res.statusCode, 200);
    assert.strictEqual(realState.row.apo_ora_01_apologistika, '09:32');
    assert.strictEqual(realState.row.eos_ora_01_apologistika, '14:31');
    assert.strictEqual(realState.row.apo_ora_02_apologistika, '18:04');
    assert.strictEqual(realState.row.eos_ora_02_apologistika, '21:04');
    assert.strictEqual(realState.row.ores_ergasias_apologistika, 7.98);
    assert.strictEqual(realState.row.apologistiko_biblio, true);
    assert.strictEqual(realState.row.is_locked, true);
    assert.strictEqual(realState.row.cards_apo_ora_01, '09:32');
    assert.strictEqual(realState.row.cards_eos_ora_01, '14:31');
    assert.strictEqual(realState.row.cards_apo_ora_02, '18:04');
    assert.strictEqual(realState.row.cards_eos_ora_02, '');
    assert.strictEqual(realState.row.orphan_card_resolution.status, 'HR_APPROVED');
    assert.deepStrictEqual(realState.row.orphan_card_resolution.resolved_pairs,
        [{ pairNumber: 2, orphanType: 'START_ONLY', start: '18:04', end: '21:04' }]);
    assert.strictEqual(realState.audits.length, 1);
    assert.strictEqual(realState.audits[0].newValues.apo_ora_01_apologistika, undefined);
    assert.strictEqual(realState.audits[0].newValues.apo_ora_02_apologistika, '18:04');
    assert.strictEqual(realState.audits[0].newValues.eos_ora_02_apologistika, '21:04');
    assert.strictEqual(realState.audits[0].newValues.cards_apo_ora_02, undefined);

    const retryState = { row: structuredClone(oldRecord), audits: [], updateCalls: 0 };
    const retryPersist = (input) => persistOrphanResolutionWrite({
        ...input,
        now: new Date('2026-09-23T05:04:06.842Z'),
        schemaPaths: Object.keys(retryState.row),
        rowModel: { async updateOne(filter, update) {
            retryState.updateCalls++;
            Object.assign(retryState.row, structuredClone(update.$set));
            return { matchedCount: 1 };
        } },
        auditModel: { async create([audit]) { retryState.audits.push(structuredClone(audit)); } }
    });
    const retryOptions = { loadRecord: () => retryState.row, orphanType: 'START_ONLY' };
    const firstApproval = await invoke(retryPersist, retryOptions);
    assert.strictEqual(firstApproval.res.statusCode, 200);
    const approvedAt = retryState.row.orphan_card_resolution.approved_at;
    const lockedAt = retryState.row.locked_at;
    const exactRetry = await invoke(retryPersist, retryOptions);
    assert.strictEqual(exactRetry.res.statusCode, 200);
    assert.strictEqual(exactRetry.res.payload.code, 'ORPHAN_RESOLUTION_ALREADY_APPLIED');
    assert.strictEqual(retryState.updateCalls, 1);
    assert.strictEqual(retryState.audits.length, 1);
    assert.strictEqual(new Date(retryState.row.orphan_card_resolution.approved_at).getTime(),
        new Date(approvedAt).getTime());
    assert.strictEqual(new Date(retryState.row.locked_at).getTime(), new Date(lockedAt).getTime());

    const changedRetry = await invoke(retryPersist, { ...retryOptions,
        requestOverrides: { body: { orphan_resolution: { approve: true,
            apologistiko_start: '14:51', apologistiko_end: '23:30',
            risk_acknowledged: false, reuse_scope: 'ONE_TIME' } } } });
    assert.strictEqual(changedRetry.res.statusCode, 409);
    assert.strictEqual(changedRetry.res.payload.code, 'EMPLOYMENT_REVIEW_RECORD_LOCKED');
    assert.strictEqual(retryState.updateCalls, 1);
    assert.strictEqual(retryState.audits.length, 1);

    let lockedPersistCalled = false;
    const locked = await invoke(async () => { lockedPersistCalled = true; }, {
        record: { ...oldRecord, is_locked: true },
        requestOverrides: { body: { reason: 'Κανονική επεξεργασία',
            updates: { apologistiko_biblio: false }, orphan_resolution: null } }
    });
    assert.strictEqual(locked.res.statusCode, 409);
    assert.strictEqual(locked.res.payload.code, 'EMPLOYMENT_REVIEW_RECORD_LOCKED');
    assert.strictEqual(lockedPersistCalled, false);

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
        const stale = await invoke(async () => { throw Object.assign(new Error(
            'Η εγγραφή άλλαξε από άλλη ενέργεια. Ανανεώστε τα αποτελέσματα και προσπαθήστε ξανά.'
        ), { code: 'EMPLOYMENT_REVIEW_STALE_WRITE', statusCode: 409 }); });
        assert.strictEqual(stale.res.statusCode, 409);
        assert.deepStrictEqual(stale.res.payload, { success: false,
            code: 'EMPLOYMENT_REVIEW_STALE_WRITE',
            message: 'Η εγγραφή άλλαξε από άλλη ενέργεια. Ανανεώστε τα αποτελέσματα και προσπαθήστε ξανά.' });

        const internal = await invoke(async () => {
            throw new Error('MongoServerError internal secret stack');
        });
        assert.strictEqual(internal.res.statusCode, 500);
        assert.deepStrictEqual(internal.res.payload, { success: false,
            code: 'EMPLOYMENT_REVIEW_UPDATE_FAILED',
            message: 'Η ενημέρωση δεν ολοκληρώθηκε. Παρακαλώ δοκιμάστε ξανά.' });
        assert.strictEqual(JSON.stringify(internal.res.payload).includes('MongoServerError'), false);
        assert.strictEqual(Object.hasOwn(internal.res.payload, 'error'), false);
        assert.strictEqual(Object.hasOwn(internal.res.payload, 'stack'), false);
    } finally {
        console.error = originalConsoleError;
    }

    console.log('orphan resolution controller behavioral boundary: PASS');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
