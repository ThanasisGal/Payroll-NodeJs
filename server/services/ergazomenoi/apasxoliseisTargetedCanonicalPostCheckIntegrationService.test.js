'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./fixtures/targetedCanonicalIntegrationFixture');
const service = require('./apasxoliseisTargetedCanonicalPostCheckIntegrationService');
const mongoose = require('mongoose');
const { CALCULATION_SOURCE_VERSION } = require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');
const dryRun = (h) => service.loadAndBuildTargetedCanonicalPostCheckDryRun({ target: h.target, models: h.models });
const load = (h, session) => service.loadAuthoritativeContext({ target: h.target, models: h.models, session });

test('real production builder: exact two-field regression, target-only, 106 sentinels untouched, clipped bounds', async () => {
    const h = harness();
    const sentinels = Array.from({ length: 106 }, (_, index) => ({ ...h.storedRow,
        _id: String(index + 1000).padStart(24, '0'), kodikos: 'sentinel-' + index, hmeromhnia: new Date('2026-04-12') }));
    h.data.rowModel.push(...sentinels);
    await h.makeHistoricalCurrent();
    const before = JSON.stringify(h.data);
    const context = await load(h);
    assert.equal(context.builderInput.rows.length, 1);
    assert.equal(context.builderInput.employees.length, 1);
    assert.equal(context.builderInput.weeklyContextRows.length, 7);
    assert.equal(context.builderInput.apoDate.toISOString().slice(0, 10), '2026-04-01');
    assert.equal(context.builderInput.eosDate.toISOString().slice(0, 10), '2026-04-05');
    assert.equal(context.builderInput.sameRunDailyCalculatedRowIds.size, 0);
    const { summary } = await dryRun(h);
    assert.equal(summary.changedFieldCount, 2);
    assert.deepEqual(summary.changedFields, ['compensation_breakdown_apologistika', 'ores_paranomhs_yperorias_argion_apologistika']);
    assert.equal(summary.minimalCanonicalDiff.ores_paranomhs_yperorias_argion_apologistika, 4.98);
    const breakdown = summary.minimalCanonicalDiff.compensation_breakdown_apologistika;
    assert.equal(breakdown.status, 'NEEDS_HR_DECISION');
    const premium = breakdown.components.find((item) => item.code === 'ILLEGAL_OVERTIME_PREMIUM');
    assert.equal(premium.hours, 4.98); assert.equal(premium.premiumAmount, 42.88);
    assert.equal(h.storedRow.apo_ora_01_apologistika, '12:30');
    assert.equal(h.storedRow.eos_ora_01_apologistika, '19:10');
    assert.equal(h.storedRow.cards_apo_ora_01, '12:30'); assert.equal(h.storedRow.cards_eos_ora_01, '17:59');
    assert.equal(h.storedRow.is_locked, false);
    assert.equal(JSON.stringify(h.data), before);
});

test('no diff is idempotent and performs no writes', async () => {
    const h = harness(); await h.makeHistoricalCurrent();
    const first = await dryRun(h);
    Object.assign(h.storedRow, first.summary.minimalCanonicalDiff);
    assert.equal((await dryRun(h)).summary.changedFieldCount, 0);
});

for (const [name, mutate, code] of [
    ['duplicate target', (h) => h.data.rowModel.push({ ...h.storedRow }), 'TARGET_ROW_NOT_UNIQUE'],
    ['duplicate employee/date', (h) => h.data.rowModel.push({ ...h.weeklyContextRows[0] }), 'WEEKLY_ROW_AMBIGUOUS'],
    ['duplicate employee', (h) => h.data.employeeModel.push({ ...h.employee }), 'EMPLOYEE_IDENTITY_AMBIGUOUS'],
    ['wrong id', (h) => { h.target._id = 'f'.repeat(24); }, 'TARGET_ROW_NOT_UNIQUE'],
    ['unsupported BSON', (h) => { h.storedRow.extra = mongoose.mongo.BSON.Long.fromNumber(1); }, 'CONTEXT_UNSUPPORTED_TYPE'],
    ['holiday duplicate', (h) => {
        const holiday = { _id: 'f'.repeat(24), team: 'THA', company_kod: '0004', etos: '2026', hmeromhnia: new Date('2026-04-02') };
        h.data.argiesModel.push(holiday, { ...holiday });
    }, 'HOLIDAY_AMBIGUOUS'],
    ['borrowed company ambiguity', (h) => {
        Object.assign(h.employee, { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
            afm_daneizomenoy_ergodoth: '987654321', kodikos_ergazomenoy_alloy_ergodoth: '0031' });
        h.data.companiesModel.push(...['a', 'b'].map((x) => ({ _id: x.repeat(24), team: 'THA', afm: '987654321' })));
    }, 'BORROWING_COMPANY_AMBIGUOUS']
]) test(`fail closed: ${name}`, async () => {
    const h = harness(); mutate(h); await assert.rejects(() => load(h), { code });
});

test('exact-break calculation semantics invalidate the previous canonical context fingerprint', async () => {
    const h = harness();
    const { snapshot } = await load(h);
    assert.equal(CALCULATION_SOURCE_VERSION, 'weekly-illegal-overtime:45b046b:v2');
    assert.equal(snapshot.semantics.illegalOvertimeSourceVersion, CALCULATION_SOURCE_VERSION);
    const previousSnapshot = { ...snapshot, semantics: { ...snapshot.semantics,
        illegalOvertimeSourceVersion: 'weekly-illegal-overtime:45b046b:v1' } };
    const previousFingerprint = service.fingerprintContext(previousSnapshot);
    const currentFingerprint = service.fingerprintContext(snapshot);
    assert.notEqual(currentFingerprint, previousFingerprint);
    const resolve = service.createCurrentContextFingerprintResolver({ models: h.models });
    const freshFingerprint = await resolve({ target: h.target, periodScope: h.scope, session: {} });
    assert.equal(freshFingerprint, currentFingerprint);
    assert.notEqual(freshFingerprint, previousFingerprint);
});

test('fingerprint deterministic across query/object order and Date/ObjectId representations', async () => {
    const h = harness(); const a = await load(h); h.reverse();
    const b = await load(h);
    assert.equal(service.fingerprintContext(a.snapshot), service.fingerprintContext(b.snapshot));
    const equivalent = JSON.parse(JSON.stringify(a.snapshot));
    const reorder = (value) => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).reverse().map(([key, v]) => [key, reorder(v)])) : value;
    // JSON omits own undefined, which must remain distinct. Test representation
    // normalization separately while keeping explicit undefined in the snapshot.
    assert.equal(service.fingerprintContext({ weeklyRows: [{ hmeromhnia: new Date('2026-04-05'), _id: new mongoose.Types.ObjectId(h.target._id) }] }),
        service.fingerprintContext({ weeklyRows: [{ _id: h.target._id, hmeromhnia: '2026-04-05' }] }));
    assert.equal(service.fingerprintContext(equivalent), service.fingerprintContext(reorder(equivalent)));
    assert.match(service.fingerprintContext(a.snapshot), /^[a-f\d]{64}$/);
    for (const key of Object.keys(a.snapshot)) {
        assert.notEqual(service.fingerprintContext(a.snapshot), service.fingerprintContext({ ...a.snapshot, [key]: null }), key);
    }
    assert.notEqual(service.fingerprintContext({}), service.fingerprintContext({ x: undefined }));
    assert.notEqual(service.fingerprintContext({ x: null }), service.fingerprintContext({ x: undefined }));
});
for (const value of [new Map(), new Set(), NaN, Infinity, Buffer.from('x'), /x/]) test(`unsupported context ${String(value)}`, () => {
    assert.throws(() => service.fingerprintContext({ value }), { code: 'CONTEXT_UNSUPPORTED_TYPE' });
});

test('resolver requires a session and reloads every category sequentially on exactly that session', async () => {
    const h = harness(); const resolver = service.createCurrentContextFingerprintResolver({ models: h.models });
    await assert.rejects(() => resolver({ target: h.target, periodScope: h.scope }), { code: 'CONTEXT_TRANSACTION_SESSION_REQUIRED' });
    const first = service.fingerprintContext((await load(h)).snapshot);
    h.reads.length = 0;
    const session = { transaction: true };
    assert.equal(await resolver({ target: h.target, periodScope: h.scope, session }), first);
    assert.ok(h.reads.length > 8);
    assert.ok(h.reads.every((read) => read.session === session));
    h.data.periodModel[0].write_fence_version++;
    assert.equal(await resolver({ target: h.target, periodScope: h.scope, session }), first);
});

for (const [name, change] of [
    ['profile', (h) => { h.employee.pragmatikoOromisthio += 1; }],
    ['history', (h) => { h.data.historyModel.push({ _id: '2'.repeat(24), team: 'THA', company_kod: h.scope.company_kod,
        kodikos: '0031', hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01'), hmeres_ergasias_ebdomadas: 5 }); }],
    ['policy', (h) => { h.data.policyModel.push({ _id: '3'.repeat(24), team: 'THA', company_kod: h.scope.company_kod,
        status: 'ACTIVE', policy_code: 'ILLEGAL_OVERTIME_PREMIUM', effective_from: new Date('2026-01-01'), rate_percent: 130 }); }],
    ['decision', (h) => { h.data.decisionModel.push({ _id: '4'.repeat(24), team: 'THA', company_kod: h.scope.company_kod,
        ypokatasthma: '0000', employee_kodikos: '0031', week_start: new Date('2026-03-30'), week_end: new Date('2026-04-05'),
        decision_status: 'RECORDED', snapshot_fingerprint: 'a'.repeat(64) }); }],
    ['holiday company policy', (h) => { h.data.companiesModel[0].apasxolhsh_kata_tis_argies = true; }],
    ['holiday', (h) => { h.data.argiesModel.push({ _id: '5'.repeat(24), team: 'THA', company_kod: '0004', etos: '2026',
        hmeromhnia: new Date('2026-04-02'), ypoxreotikh_argia: true }); }],
    ['date-level flag from another employee', (h) => {
        h.data.employeeModel.push({ ...h.employee, _id: '6'.repeat(24), kodikos: '0099' });
        h.data.rowModel.push({ ...h.weeklyContextRows[0], _id: '7'.repeat(24), kodikos: '0099', argia: true });
    }]
]) test(`fresh resolver detects changed ${name}`, async () => {
    const h = harness(); const first = service.fingerprintContext((await load(h)).snapshot);
    change(h); h.reads.length = 0;
    const session = {};
    const next = await service.createCurrentContextFingerprintResolver({ models: h.models })({ target: h.target, periodScope: h.scope, session });
    assert.notEqual(next, first);
    assert.ok(h.reads.every((read) => read.session === session));
});

test('diff token binds old/new values, identity, and field names, with deterministic ordering', () => {
    const h = harness();
    const input = { target: h.target, storedRow: { a: 1, b: 2 }, minimalCanonicalDiff: { b: 3, a: 4 } };
    const first = service.buildDiffDigest(input);
    assert.equal(first, service.buildDiffDigest({ ...input, minimalCanonicalDiff: { a: 4, b: 3 } }));
    assert.notEqual(first, service.buildDiffDigest({ ...input, storedRow: { a: 0, b: 2 } }));
    assert.notEqual(first, service.buildDiffDigest({ ...input, minimalCanonicalDiff: { a: 4, b: 5 } }));
});

function addBorrowing(h) {
    Object.assign(h.employee, { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
        afm_daneizomenoy_ergodoth: '987654321', kodikos_ergazomenoy_alloy_ergodoth: '0088',
        hmnia_enarxhs_daneismoy: new Date('2026-04-02') });
    h.data.companiesModel.push({ ...h.data.companiesModel[0], _id: '8'.repeat(24), kod: '0008', afm: '987654321' });
    h.data.employeeModel.push({ ...h.employee, _id: '9'.repeat(24), kodikos: '0088', company_kod: '8'.repeat(24) });
}
test('borrowed resolution preserves production precedence, facts and sequential same-session reload', async () => {
    const h = harness(); addBorrowing(h);
    const before = await load(h);
    const resolutions = before.snapshot.holidayAndNoCardFacts.resolutions;
    assert.equal(resolutions[0].effectiveProfile.profile_company_id, h.scope.company_kod);
    assert.equal(resolutions[3].effectiveProfile.profile_company_id, '8'.repeat(24));
    const first = service.fingerprintContext(before.snapshot);
    h.data.employeeModel[1].pragmatikoOromisthio++;
    h.reads.length = 0;
    const session = {};
    const hash = await service.createCurrentContextFingerprintResolver({ models: h.models })({ target: h.target, periodScope: h.scope, session });
    assert.notEqual(hash, first);
    assert.ok(h.reads.every((r) => r.session === session));
});
test('borrowed employee ambiguity and overlapping borrowed histories fail closed', async () => {
    const h = harness(); addBorrowing(h);
    h.data.employeeModel.push({ ...h.data.employeeModel[1], _id: 'a'.repeat(24) });
    await assert.rejects(() => load(h), { code: 'BORROWING_EMPLOYEE_AMBIGUOUS' });
    h.data.employeeModel.pop();
    const history = { _id: 'b'.repeat(24), team: 'THA', company_kod: '8'.repeat(24), kodikos: '0088',
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01'), hmeres_ergasias_ebdomadas: 6 };
    h.data.historyModel.push(history, { ...history, _id: 'c'.repeat(24) });
    await assert.rejects(() => load(h), { code: 'BORROWING_HISTORY_OVERLAP' });
});
test('history fingerprint and builder preserve production projection and sort across query order', async () => {
    const h = harness();
    h.data.historyModel.push(...[2, 1].map((month) => ({ _id: String(month).repeat(24), team: 'THA',
        company_kod: h.scope.company_kod, kodikos: '0031', hmeromhnia_isxyos_oron_ergasias_apo: new Date(`2026-0${month}-01`),
        hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 40 })));
    const a = await load(h); h.reverse(); const b = await load(h);
    assert.equal(service.fingerprintContext(a.snapshot), service.fingerprintContext(b.snapshot));
    const history = a.builderInput.istorikoRowsByKodikos.get('0031');
    assert.equal(history[0]._id, '1'.repeat(24));
    assert.equal(Object.hasOwn(history[0], 'team'), false);
    assert.equal(Object.hasOwn(history[0], 'company_kod'), false);
});
function appliedExecution(h) {
    const snapshot = (repo) => ({ kathgoria_ergasias_apologistika: repo ? 'ΑΝ' : 'ΕΡΓ', repo_apologistika: repo,
        apologistiko_biblio: true, adeia_apologistika: false, kathgoria_adeias_apologistika: '', ores_apoysias_apologistika: 0,
        apo_ora_01_apologistika: '', eos_ora_01_apologistika: '', apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '', eos_ora_03_apologistika: '', ores_ergasias_apologistika: 0,
        ores_pragmatikhs_ergasias_apologistika: 0, ores_adeias_pistomenes_apologistika: 0,
        ores_argias_pistomenes_apologistika: 0, compensation_breakdown_apologistika: null });
    return { _id: 'a'.repeat(24), decision_id: 'b'.repeat(24), employee_id: h.employee._id,
        source_prodhlomena_oraria_id: String(h.weeklyContextRows[0]._id), target_prodhlomena_oraria_id: String(h.weeklyContextRows[1]._id),
        team: 'THA', company_kod: h.scope.company_kod, ypokatasthma: '0000', employee_kodikos: '0031',
        decision_fingerprint: 'a'.repeat(64), proposal_id: 'proposal', request_id: 'request', command_identity: 'c'.repeat(64),
        created_by_user_id: h.employee._id, created_by_user_name: 'operator', created_by_user_role: 'A',
        execution_status: 'APPLIED', week_start: new Date('2026-03-30'), week_end: new Date('2026-04-05'),
        applied_at: new Date('2026-04-01'), created_at: new Date('2026-04-01'),
        before_snapshot: { source: snapshot(true), target: snapshot(false), source_locked: false, target_locked: false },
        after_snapshot: { source: snapshot(false), target: snapshot(true), source_locked: false, target_locked: false } };
}
test('fresh applied protection changes fingerprint; duplicate execution is fail closed', async () => {
    const h = harness();
    const first = service.fingerprintContext((await load(h)).snapshot);
    h.data.executionModel.push(appliedExecution(h));
    const session = {};
    const next = await service.createCurrentContextFingerprintResolver({ models: h.models })({ target: h.target, periodScope: h.scope, session });
    assert.notEqual(next, first);
    h.data.executionModel.push({ ...h.data.executionModel[0], _id: 'd'.repeat(24) });
    await assert.rejects(() => load(h), { code: 'APPLIED_PROTECTION_CONFLICT' });
});
test('argia date facts exclude rows outside employment while preserving other employee dates', async () => {
    const h = harness();
    h.data.employeeModel.push({ ...h.employee, _id: 'a'.repeat(24), kodikos: '0099', hmeromhnia_proslhpshs: new Date('2026-04-01') });
    h.data.rowModel.push({ ...h.weeklyContextRows[0], _id: 'b'.repeat(24), kodikos: '0099', argia: true },
        { ...h.weeklyContextRows[3], _id: 'c'.repeat(24), kodikos: '0099', argia: true });
    const context = await load(h);
    assert.deepEqual([...context.builderInput.postCheckArgiesDateSet], ['2026-04-02']);
    assert.equal(context.builderInput.rows.length, 1);
    assert.ok(context.builderInput.weeklyContextRows.every((row) => row.kodikos === '0031'));
});
test('full snapshot fingerprint is invariant to BSON/UTC date representation and object order', async () => {
    const snapshot = (await load(harness())).snapshot;
    function equivalent(value) {
        if (value instanceof Date) return value.toISOString();
        if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
        if (Array.isArray(value)) return value.map(equivalent);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse()
            .map(([key, v]) => [key, equivalent(v)]));
        return value;
    }
    assert.equal(service.fingerprintContext(snapshot), service.fingerprintContext(equivalent(snapshot)));
});
test('policy conflicts and stale historical eligibility fail closed before issuing a plan', async () => {
    const h = harness(); await h.makeHistoricalCurrent();
    h.data.periodModel[0].historical_dependency_fingerprint = 'stale';
    await assert.rejects(() => dryRun(h), { code: 'TARGET_PERIOD_NOT_WRITABLE' });
    h.data.policyModel.push(...['a', 'b'].map((id) => ({ _id: id.repeat(24), team: 'THA', company_kod: h.scope.company_kod,
        policy_code: 'ILLEGAL_OVERTIME_PREMIUM', status: 'ACTIVE', effective_from: new Date('2026-01-01'), rate_percent: 120 })));
    await assert.rejects(() => load(h), { code: 'POLICY_AMBIGUOUS' });
});

test('opaque strings never acquire identity/date semantics in context or old/new diff values', () => {
    const h = harness();
    for (const [left, right] of [
        ['AAAAAAAAAAAAAAAAAAAAAAAA', 'aaaaaaaaaaaaaaaaaaaaaaaa'],
        ['2026-04-05', new Date('2026-04-05')],
        ['2026-04-05', '2026-04-05T00:00:00.000Z'],
        [h.target._id, new mongoose.Types.ObjectId(h.target._id)]
    ]) {
        for (const section of [
            (value) => ({ companyPolicyRules: [{ justification: value, policy_code: value }] }),
            (value) => ({ canonicalDecisions: [{ decision_payload: { reason: value } }] }),
            (value) => ({ employeeProfileFacts: { onoma: value, company_kod: value } })
        ]) assert.notEqual(service.fingerprintContext(section(left)), service.fingerprintContext(section(right)));
        for (const side of ['old', 'new']) {
            const token = (value) => service.buildDiffDigest({ target: h.target,
                storedRow: { field: side === 'old' ? value : 'before' },
                minimalCanonicalDiff: { field: side === 'new' ? value : 'after' } });
            assert.notEqual(token(left), token(right), side);
        }
        if (typeof left === 'string') assert.deepEqual(service.normalize(left), ['string', left]);
    }
});

test('explicit schema identities/dates normalize equivalently across every authoritative section', () => {
    const id = new mongoose.Types.ObjectId('abcdefabcdefabcdefabcdef');
    const date = new Date('2026-04-05');
    const snapshot = {
        scope: { target: { _id: id, hmeromhnia: date }, periodScope: { period_start: date }, naturalStart: date },
        weeklyRows: [{ _id: id, hmeromhnia: date }], targetCompensationInputs: { _id: id, hmeromhnia: date },
        employeeProfileFacts: { _id: id, hmeromhnia_proslhpshs: date },
        employmentHistoryFacts: [{ _id: id, hmeromhnia_isxyos_oron_ergasias_apo: date }],
        borrowedProfileFacts: { reads: [{ name: 'employeeModel', facts: [{ _id: id, hmnia_enarxhs_daneismoy: date }] }] },
        companyPolicyRules: [{ _id: id, effective_from: date }],
        holidayAndNoCardFacts: { reads: [{ name: 'argiesModel', facts: [{ _id: id, hmeromhnia: date }] }],
            resolutions: [{ date, effectiveProfile: { profile_employee_id: id, review_date: date, loan_interval: { from: date } }, holidays: [[date, {}]] }] },
        postCheckArgiesDateSet: { dates: [date], eligibility: [{ _id: id, hmeromhnia_proslhpshs: date }], rows: [{ _id: id, hmeromhnia: date }] },
        canonicalDecisions: [{ _id: id, employee_id: id, week_start: date, created_at: date }],
        appliedRepoProtectionFacts: [{ _id: id, decision_id: id, applied_at: date, authorization_metadata: { original_approval_timestamp: date } }]
    };
    const serialized = JSON.parse(JSON.stringify(snapshot));
    serialized.weeklyRows[0]._id = serialized.weeklyRows[0]._id.toUpperCase();
    serialized.weeklyRows[0].hmeromhnia = '2026-04-05';
    assert.equal(service.fingerprintContext(snapshot), service.fingerprintContext(serialized));
    assert.throws(() => service.fingerprintContext({ weeklyRows: [{ hmeromhnia: '2026-02-30' }] }), { code: 'CONTEXT_INVALID_DATE' });
    assert.throws(() => service.fingerprintContext({ weeklyRows: [{ _id: 'not-an-id' }] }), { code: 'CONTEXT_INVALID_OBJECTID' });
    for (const value of [mongoose.mongo.BSON.Long.fromNumber(1), Object.create({ x: 1 }), { get value() { return 1; } }]) {
        assert.throws(() => service.fingerprintContext({ value }), { code: 'CONTEXT_UNSUPPORTED_TYPE' });
    }
});

async function reusableDecisionCase({ clipped, count }) {
    const h = harness();
    h.employee.hmeres_ergasias_ebdomadas = 5;
    if (!clipped) {
        for (const row of h.weeklyContextRows) row.hmeromhnia = new Date(new Date(row.hmeromhnia).getTime() + 7 * 86400000);
        h.target.hmeromhnia = '2026-04-12';
    }
    const context = await load(h), b = context.builderInput;
    const week = { weekStart: context.snapshot.scope.naturalStart, weekEnd: context.snapshot.scope.naturalEnd,
        naturalWeekStart: context.snapshot.scope.naturalStart, naturalWeekEnd: context.snapshot.scope.naturalEnd };
    const { effectiveProfile } = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService').getWeeklyRepoProfileInfo({
        week, istorikoRows: [], ergazomenos: h.employee,
        resolveProfileForDate: (reviewDate) => b.resolveProfileForDate({ employee: h.employee, reviewDate, history: [] }) });
    const automaticAnalysis = require('./apasxoliseisWeeklySixthSeventhDayPolicyService').analyzeWeeklySixthSeventhDay({
        weekRows: b.weeklyContextRows, effectiveProfile, hourlyRate: effectiveProfile.pragmatikoOromisthio,
        calculatedWorkHoursAuthoritative: true, allowDeclaredRepoIdentityOverride: true, canonicalRepoDayIdentitiesOverride: null });
    const snapshotInput = require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService').buildWeeklyCanonicalDecisionSnapshotInput({
        team: h.target.team, company_kod: h.target.company_kod, employee: h.employee, week, weekRows: b.weeklyContextRows,
        effectiveProfile, profileHistory: [], automaticAnalysis, appliedProtectionContext: b.appliedProtectionContext,
        calculatedWorkHoursAuthoritative: true });
    const current = require('./apasxoliseisWeeklyCanonicalDecisionService').buildCanonicalWeeklyDecisionSnapshot(snapshotInput);
    const reusable = require('./apasxoliseisReusablePolicyDecisionService');
    const type = 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC';
    const fingerprint = reusable.buildReusableDecisionFingerprint(reusable.buildWeeklyReusableCaseCriteria(current, type));
    h.data.decisionModel.push(...['a', 'b'].slice(0, count).map((letter, index) => ({
        _id: letter.repeat(24), team: h.target.team, company_kod: h.target.company_kod, ypokatasthma: '0000',
        employee_kodikos: '009' + index, week_start: new Date('2026-03-16'), week_end: new Date('2026-03-22'),
        snapshot_fingerprint: letter.repeat(64), decision_status: 'RECORDED', decision_type: type,
        reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE', reuse_effective_from: new Date('2026-03-23'),
        reuse_fingerprint: fingerprint, reusable_decision_payload: { repo_day_positions: [5, 6] }
    })));
    const resolution = require('./apasxoliseisWeeklyCanonicalDecisionResolutionService').resolveWeeklyCanonicalDecisionAnalysis({
        automaticAnalysis, snapshotInput, decisionRecords: h.data.decisionModel, weekRows: b.weeklyContextRows,
        effectiveProfile, employee: h.employee, profileHistory: [] });
    assert.equal(resolution.applicability, count === 1 ? 'APPLICABLE' : 'CONFLICT', 'production authority establishes applicability');
    return { h, context };
}

for (const clipped of [false, true]) {
    test(`one production-applicable reusable decision permits plan (clipped=${clipped})`, async () => {
        const { h } = await reusableDecisionCase({ clipped, count: 1 });
        await h.makeHistoricalCurrent();
        assert.ok((await dryRun(h)).plan);
    });
    test(`production reusable conflict aborts before plan or any write (clipped=${clipped})`, async () => {
        const { h, context } = await reusableDecisionCase({ clipped, count: 2 });
        if (clipped) {
            assert.equal(context.snapshot.scope.naturalStart.toISOString().slice(0, 10), '2026-03-30');
            assert.equal(context.builderInput.apoDate.toISOString().slice(0, 10), '2026-04-01');
            assert.equal(context.builderInput.eosDate.toISOString().slice(0, 10), '2026-04-05');
        }
        // Isolated module instance observes issuance and write boundaries without
        // changing production dependencies or exposing a caller-supplied plan.
        const Module = require('node:module'), fs = require('node:fs');
        const filename = require.resolve('./apasxoliseisTargetedCanonicalPostCheckIntegrationService');
        const isolated = new Module(filename, module); isolated.filename = filename; isolated.paths = module.paths;
        const calls = { plan: 0, persist: 0, fence: 0, row: 0, audit: 0 };
        isolated.require = (name) => {
            const actual = require(name);
            if (name === './apasxoliseisTargetedCanonicalPostCheckCorrectionService') return { ...actual,
                buildTargetedCanonicalPostCheckCorrectionPlan() { calls.plan++; assert.fail('plan issued'); },
                persistTargetedCanonicalPostCheckCorrection() { calls.persist++; assert.fail('persist'); } };
            if (name === './apasxoliseisPeriodControlService') return { ...actual,
                runWithPeriodWriteFence() { calls.fence++; assert.fail('fence'); } };
            return actual;
        };
        isolated._compile(fs.readFileSync(filename, 'utf8'), filename);
        for (const model of Object.values(h.models)) for (const method of ['updateOne', 'updateMany', 'bulkWrite', 'create', 'insertMany', 'deleteMany', 'findOneAndUpdate']) {
            model[method] = () => { calls[method === 'create' || method === 'insertMany' ? 'audit' : 'row']++; assert.fail('write'); };
        }
        const before = JSON.stringify(h.data); h.reads.length = 0;
        await assert.rejects(() => isolated.exports.loadAndBuildTargetedCanonicalPostCheckDryRun({ target: h.target, models: h.models }),
            { code: 'TARGETED_CANONICAL_DECISION_CONFLICT' });
        assert.deepEqual(calls, { plan: 0, persist: 0, fence: 0, row: 0, audit: 0 });
        assert.equal(JSON.stringify(h.data), before);
        assert.ok(h.reads.every((read) => read.name !== 'periodModel'), 'conflict aborts even before period token read');
        const session = {}; h.reads.length = 0;
        await assert.rejects(() => service.createCurrentContextFingerprintResolver({ models: h.models })({ target: h.target, periodScope: h.scope, session }),
            { code: 'TARGETED_CANONICAL_DECISION_CONFLICT' });
        assert.ok(h.reads.every((read) => read.session === session));
    });
}
