'use strict';

const assert = require('node:assert/strict');
const {
    naturalWeek,
    buildProfileCandidates,
    loadWeeklyCanonicalDecisionContext,
    assertBoundedDecisionCommand,
    validateCommandForCurrentContext,
    projectCurrentContext
} = require('./apasxoliseisWeeklyCanonicalDecisionContextService');
const {
    recordWeeklyCanonicalDecision
} = require('./apasxoliseisWeeklyCanonicalDecisionService');
const {
    buildWeeklyCanonicalDecisionSnapshotInput
} = require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService');
const {
    buildCanonicalWeeklyDecisionSnapshot
} = require('./apasxoliseisWeeklyCanonicalDecisionService');

function query(value) {
    return {
        sort() { return this; },
        limit() { return this; },
        lean: async () => value
    };
}

function model({ one = null, many = [] } = {}) {
    return {
        findOne: () => query(one),
        find: () => query(many)
    };
}

function decisionStore() {
    const records = [];
    const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
        if (['week_start', 'week_end'].includes(key)) {
            return new Date(row[key]).getTime() === new Date(value).getTime();
        }
        return row[key] === value;
    });
    return {
        records,
        findOne(filter) { return query(records.find((row) => matches(row, filter)) || null); },
        find() { return query([...records]); },
        async create(record) { const saved = { _id: `decision-${records.length + 1}`, ...record };
            records.push(saved); return saved; }
    };
}

const employee = {
    _id: '507f191e810c19729de860eb', team: 'THA', company_kod: 'company',
    ypokatasthma: '0000', kodikos: 'E2', eponymo: 'TEST', onoma: 'USER',
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0', typos_ergazomenon: 'Μ',
    pososto_prosayxhshs_6hs_hmeras: 40, nomimoOromisthio: 8, pragmatikoOromisthio: 10
};
const rows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date('2026-08-03T00:00:00.000Z'); date.setUTCDate(date.getUTCDate() + index);
    return {
        _id: `row-${index}`, team: 'THA', company_kod: 'company', ypokatasthma: '0000',
        kodikos: 'E2', hmeromhnia: date, kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: index >= 5 ? 'ΑΝ' : 'ΕΡΓ', repo: index >= 5,
        repo_apologistika: index >= 5, ores_ergasias: index === 5 ? 7 : 8,
        ores_ergasias_apologistika: index === 5 ? 7 : 8,
        cards_ores_ergasias: index === 6 ? 0 : index === 5 ? 7 : 8,
        cards_apo_ora_01: index === 6 ? '' : '09:00',
        cards_eos_ora_01: index === 5 ? '' : index === 6 ? '' : '17:00'
    };
});
const session = { userTeam: 'THA', companyInUse: 'company', userStatus: 'A', userRole: 'HR',
    userId: '507f191e810c19729de860ea', userName: 'HR Test' };

(async () => {
    assert.equal(naturalWeek('2026-08-03').week_end, '2026-08-09');
    assert.throws(() => naturalWeek('2026-08-04'));

    const store = decisionStore();
    const models = {
        employeeModel: model({ one: employee }),
        rowModel: model({ many: rows }),
        historyModel: null,
        executionModel: model(),
        decisionModel: store
    };
    const context = await loadWeeklyCanonicalDecisionContext({ session, ypokatasthma: '0000',
        employee_kodikos: 'E2', week_start: '2026-08-03', models });
    assert.equal(context.rows.length, 7);
    assert.equal(context.automaticAnalysis.status, 'NEEDS_HR_DECISION');
    assert.ok(context.automaticAnalysis.reasons.includes('CARD_VERIFICATION_PENDING'));
    assert.equal(context.snapshotInput.team, 'THA');
    assert.match(context.snapshot.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(context.resolution.applicability, 'NOT_FOUND');
    assert.equal(context.supportedActions.card_documentary, true);
    assert.equal(context.profileCandidates.length, 1);
    assert.equal(buildProfileCandidates(employee, []).length, 1);
    const irrelevantHistory = { _id: 'old', hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01',
        hmeromhnia_isxyos_oron_ergasias_eos: '2025-01-31' };
    const withPeriodNoise = buildWeeklyCanonicalDecisionSnapshotInput({
        team: 'THA', company_kod: 'company', employee, week: context.week, weekRows: rows,
        effectiveProfile: context.effectiveProfile, profileHistory: [irrelevantHistory],
        automaticAnalysis: context.automaticAnalysis, appliedProtectionContext: { entriesByRowId: {} }
    });
    assert.deepEqual(withPeriodNoise.profile_history, []);
    assert.equal(buildCanonicalWeeklyDecisionSnapshot(withPeriodNoise).fingerprint,
        context.snapshot.fingerprint);

    const cardBody = { ypokatasthma: '0000', employee_kodikos: 'E2', week_start: '2026-08-03',
        request_id: 'canonical:test:0001', decision_type: 'CARD_VERIFICATION_PENDING',
        decision_payload: { verified: true, evidence_reference: 'ticket-1', corrected_row_ids: [] },
        notes: 'documentary only' };
    assert.equal(assertBoundedDecisionCommand(cardBody).decision_type, 'CARD_VERIFICATION_PENDING');
    assert.equal(validateCommandForCurrentContext({ session, body: cardBody, context }).request_id,
        'canonical:test:0001');
    const recorded = await recordWeeklyCanonicalDecision({ session,
        command: validateCommandForCurrentContext({ session, body: cardBody, context }),
        currentInput: context.snapshotInput, decisionModel: store,
        indexReadinessGuard: async () => ({ ready: true }) });
    assert.equal(recorded.idempotent, false);
    const afterRecord = await loadWeeklyCanonicalDecisionContext({ session, ypokatasthma: '0000',
        employee_kodikos: 'E2', week_start: '2026-08-03', models });
    assert.equal(afterRecord.decisionRecords.length, 1);
    assert.equal(afterRecord.resolution.applicability, 'APPLICABLE');
    assert.equal(afterRecord.resolution.documentaryOnly, true);
    assert.equal(afterRecord.resolution.analysis.status, 'NEEDS_HR_DECISION');
    assert.ok(afterRecord.resolution.analysis.reasons.includes('CARD_VERIFICATION_PENDING'));
    assert.equal(store.records.length, 1);
    for (const forged of ['snapshot_fingerprint', 'canonical_status', 'canonical_reasons',
        'effective_profile', 'actual_work_facts', 'applied_atomic_repo_transfer']) {
        assert.throws(() => assertBoundedDecisionCommand({ ...cardBody, [forged]: 'forged' }),
            (error) => error.code === 'CLIENT_CANONICAL_FIELDS_NOT_ALLOWED');
    }
    assert.throws(() => assertBoundedDecisionCommand({ ...cardBody,
        decision_payload: { constructor: { prototype: { polluted: true } } } }));

    const projection = projectCurrentContext(context, { ready: false,
        code: 'CANONICAL_DECISION_INDEXES_NOT_READY' });
    assert.equal(projection.index_readiness.ready, false);
    assert.equal(projection.week_rows.length, 7);
    assert.equal(projection.snapshot_fingerprint, context.snapshot.fingerprint);
    assert.equal(Object.hasOwn(projection, 'histories'), false);

    const crossScope = await assert.rejects(() => loadWeeklyCanonicalDecisionContext({
        session, ypokatasthma: '9999', employee_kodikos: 'E2', week_start: '2026-08-03',
        models: { ...models, employeeModel: model({ one: null }) }
    }));
    void crossScope;
    console.log('weekly canonical decision context tests passed (32 contracts)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
