'use strict';

const assert = require('assert');
const {
    removeClientRawCardUpdates,
    canonicalOrphanResolutionMetadata,
    buildReviewCompareAndSetFilter,
    buildEmploymentReviewUpdateErrorResponse,
    persistOrphanResolutionWrite
} = require('./apasxoliseisOrphanResolutionPersistenceService');
const {
    resolveDailyActualWorkFacts,
    WARNING
} = require('./apasxoliseisDailyActualWorkFactsService');

const baseRow = Object.freeze({
    _id: '64b000000000000000000000014', team: 'THA', company_kod: 'company',
    ypokatasthma: '0000', kodikos: '0004', hmeromhnia: new Date('2026-06-14Z'),
    cards_apo_ora_01: '14:51', cards_eos_ora_01: '', cards_ores_ergasias: 0,
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    ores_ergasias: 8, ores_ergasias_apologistika: 0,
    kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
    is_locked: false, orphan_card_resolution: null
});

function metadata(scope = 'ONE_TIME') {
    return {
        status: 'HR_APPROVED', policy_version: 'orphan-card-continuous:v1',
        orphan_type: 'START_ONLY', reuse_scope: scope,
        approved_interval: { start: '14:51', end: '23:21' },
        rest_violation: false, risk_acknowledged: false,
        rest_conflicts: [], raw_cards_preserved: true, approved_by: 'HR', approved_at: null
    };
}

function harness(initial = baseRow) {
    const state = { row: structuredClone(initial), audits: [], reusable: [] };
    const rowModel = {
        async updateOne(filter, update) {
            if (state.forceStale) return { matchedCount: 0 };
            assert.strictEqual(filter._id, state.row._id);
            Object.assign(state.row, structuredClone(update.$set));
            return { matchedCount: 1 };
        }
    };
    const auditModel = { async create([audit]) {
        if (state.failAudit) throw new Error('forced audit failure');
        state.audits.push(structuredClone(audit));
    } };
    async function transaction(work) {
        const before = structuredClone(state);
        try { return await work(); } catch (error) {
            state.row = before.row; state.audits = before.audits;
            state.reusable = before.reusable; throw error;
        }
    }
    return { state, rowModel, auditModel, transaction };
}

async function save(h, scope = 'ONE_TIME', oldRecord = structuredClone(h.state.row)) {
    return h.transaction(() => persistOrphanResolutionWrite({
        oldRecord,
        semanticUpdates: {
            apo_ora_01_apologistika: '14:51', eos_ora_01_apologistika: '23:21',
            ores_ergasias_apologistika: 8, orphan_card_resolution: metadata(scope)
        },
        changedBy: 'HR', reason: 'orphan approval', now: new Date('2026-08-24T18:04:50Z'),
        schemaPaths: Object.keys(baseRow), rowModel: h.rowModel, auditModel: h.auditModel,
        session: {}, createReusableApproval: scope === 'FUTURE_IDENTICAL'
            ? async () => { if (!h.state.reusable.length) h.state.reusable.push('active'); }
            : null
    }));
}

async function run() {
    const malicious = removeClientRawCardUpdates({ cards_apo_ora_01: '00:00',
        cards_eos_ora_01: '01:00', apo_ora_01_apologistika: '14:51' });
    assert.deepStrictEqual(malicious, { apo_ora_01_apologistika: '14:51' });

    const oneTime = harness();
    const saved = await save(oneTime);
    assert.strictEqual(saved.updated, true);
    assert.strictEqual(oneTime.state.row.cards_apo_ora_01, '14:51');
    assert.strictEqual(oneTime.state.audits.length, 1);
    assert.strictEqual(oneTime.state.reusable.length, 0);
    assert.strictEqual(oneTime.state.audits[0].newValues.is_locked, true);
    assert.strictEqual(oneTime.state.audits[0].newValues.locked_by, 'HR');
    assert(oneTime.state.audits[0].newValues.locked_at instanceof Date ||
        typeof oneTime.state.audits[0].newValues.locked_at === 'string');
    assert.strictEqual(oneTime.state.row.orphan_card_resolution.status, 'HR_APPROVED');
    const facts = resolveDailyActualWorkFacts(oneTime.state.row,
        { calculatedWorkHoursAuthoritative: true });
    assert.strictEqual(facts.warnings.includes(WARNING.INCOMPLETE_CARD_INTERVAL), true);
    assert.strictEqual(facts.warnings.includes('HR_APPROVED_ORPHAN_CARD_RESOLUTION'), true);
    assert.strictEqual(facts.reasons.length, 0);

    const repeated = await save(oneTime, 'ONE_TIME', structuredClone(oneTime.state.row));
    assert.strictEqual(repeated.idempotent, true);
    assert.strictEqual(oneTime.state.audits.length, 1);
    assert.strictEqual(new Date(oneTime.state.row.locked_at).toISOString(),
        '2026-08-24T18:04:50.000Z');

    const future = harness();
    await save(future, 'FUTURE_IDENTICAL');
    assert.strictEqual(future.state.reusable.length, 1);
    assert.strictEqual(future.state.audits.length, 1);

    const rollback = harness();
    rollback.state.failAudit = true;
    await assert.rejects(() => save(rollback, 'FUTURE_IDENTICAL'), /forced audit failure/);
    assert.deepStrictEqual(rollback.state.row, structuredClone(baseRow));
    assert.strictEqual(rollback.state.audits.length, 0);
    assert.strictEqual(rollback.state.reusable.length, 0);

    const stale = harness();
    stale.state.forceStale = true;
    await assert.rejects(() => save(stale), (error) =>
        error.code === 'EMPLOYMENT_REVIEW_STALE_WRITE' && error.statusCode === 409);
    assert.strictEqual(stale.state.audits.length, 0);

    const filter = buildReviewCompareAndSetFilter({ oldRecord: baseRow,
        schemaPaths: [...Object.keys(baseRow), 'new_field'] });
    assert(filter.$and.some((part) => part.new_field?.$exists === false));

    assert.strictEqual(canonicalOrphanResolutionMetadata({
        status: 'HR_APPROVED', resolution_scope: 'FUTURE_IDENTICAL',
        rest_risk_acknowledged: true, rest_conflicts: ['risk']
    }).reuse_scope, 'FUTURE_IDENTICAL');
    assert.strictEqual(canonicalOrphanResolutionMetadata({
        rest_risk_acknowledged: true
    }).risk_acknowledged, true);

    assert.deepStrictEqual(buildEmploymentReviewUpdateErrorResponse(Object.assign(
        new Error('safe conflict'), { code: 'SAFE_CONFLICT', statusCode: 409 }
    )), { status: 409, body: { success: false, code: 'SAFE_CONFLICT',
        message: 'safe conflict' } });
    const internal = buildEmploymentReviewUpdateErrorResponse(
        new Error('MongoServerError secret internal detail')
    );
    assert.deepStrictEqual(internal, { status: 500, body: { success: false,
        code: 'EMPLOYMENT_REVIEW_UPDATE_FAILED',
        message: 'Η ενημέρωση δεν ολοκληρώθηκε. Παρακαλώ δοκιμάστε ξανά.' } });
    assert.strictEqual(JSON.stringify(internal).includes('MongoServerError'), false);

    console.log('orphan resolution persistence behavioral tests: PASS');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
