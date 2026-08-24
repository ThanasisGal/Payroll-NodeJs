'use strict';

const assert = require('assert');
const erganhController = require('./erganhController');

const ID = '6a7c515e6aeaefb3c8764b54';
const oldRecord = Object.freeze({
    _id: ID, team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    kodikos: '0004', hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    cards_apo_ora_01: '14:51', cards_eos_ora_01: '', cards_ores_ergasias: 0,
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    is_locked: false, orphan_card_resolution: null
});

function request() {
    return {
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
}

function response() {
    return {
        statusCode: 200, payload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; }
    };
}

function preparedResolution() {
    return {
        approvedOrphanResolution: {
            canApprove: true, requiresRiskAcknowledgement: false,
            orphanType: 'START_ONLY', reuseScope: 'ONE_TIME',
            proposal: { start: '14:51', end: '23:21' },
            approvedUpdates: { apo_ora_01_apologistika: '14:51',
                eos_ora_01_apologistika: '23:21' },
            reusableDecisionRule: null, rest: { hasViolation: false, conflicts: [] }
        },
        dailyDerived: { derivedUpdate: { kathgoria_ergasias_apologistika: 'ΕΡΓ',
            ores_ergasias_apologistika: 8, repo_apologistika: false,
            adeia_apologistika: false, astheneia_apologistika: false,
            apousia_apologistika: false } }
    };
}

function overrides(persist) {
    return {
        loadOldRecord: async () => structuredClone(oldRecord),
        prepareOrphanResolution: async () => preparedResolution(),
        getPeriodAccess: async () => ({ scope: {}, token: 'token',
            state: { effective_mode: 'NORMAL' } }),
        loadAppliedProtection: async () => ({ entriesByRowId: {}, diagnostics: [],
            hasConflicts: false }),
        periodFence: async ({ work }) => work({ session: { isolated: true } }),
        persistOrphanResolutionWrite: persist
    };
}

async function invoke(persist) {
    const req = request();
    const res = response();
    await erganhController.__orphanResolutionBoundaryTestHooks.withOverrides(
        overrides(persist),
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
