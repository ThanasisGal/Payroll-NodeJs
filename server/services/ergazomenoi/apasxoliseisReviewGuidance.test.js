'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const guidance = require('../../../public/js/ergazomenoi/programmata/employmentReviewGuidance');
const ui = require('../../../public/js/ergazomenoi/programmata/employmentReviewGuidanceUi');
const { REASON } = require('./apasxoliseisDailyActualWorkFactsService');
const { DIAGNOSTIC } = require('./apasxoliseisEffectiveRepoStateService');
const { BLOCK_REASON } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { resolveWeeklyHrWorkflow } = require('./apasxoliseisWeeklyHrWorkflowResolverService');
const { buildWeeklyHrLifecycleProjection, buildFinalizedWeeklyHrLifecyclePresentation } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { reviewErrorResponse } = require('./apasxoliseisReviewErrorPresentationService');
const { analysisDiagnostics } = require('./apasxoliseisReviewDiagnosticService');
const { buildWeeklyHrStage2BulkPreview } = require('./apasxoliseisWeeklyHrStage2BulkPreviewService');

const profile = { typos_apasxolhshs: '0', typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40 };
function week() {
    return Array.from({ length: 7 }, (_, i) => ({ _id: String(i), kodikos: '0001',
        hmeromhnia: new Date(Date.UTC(2026, 7, 31 + i)).toISOString().slice(0, 10),
        kathgoria_ergasias: i === 2 ? 'ΑΝ' : 'ΕΡΓ', repo: i === 2,
        kathgoria_ergasias_apologistika: '', repo_apologistika: false,
        ores_ergasias: i === 2 ? 0 : 8, cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '' }));
}
function payload(rows = week(), terms = profile) {
    return { employee_name: 'ΣΥΝΘΕΤΙΚΟΣ ΕΡΓΑΖΟΜΕΝΟΣ', scope: {
        employee_kodikos: '0001', week_start: '2026-08-31', week_end: '2026-09-06' },
    lifecycle_projection: buildWeeklyHrLifecycleProjection({ weekRows: rows, effectiveProfile: terms }) };
}

test('all documented producers and enums have reviewed Greek descriptions and practical instructions', () => {
    const audit = fs.readFileSync(require.resolve('../../../docs/reviews/employment-review-guidance.md'), 'utf8');
    const documentedCodes = [...audit.matchAll(/^\| `([A-Z][A-Z0-9_]+)` \|/gm)].map(match => match[1]);
    const codes = new Set([...Object.values(REASON), ...Object.values(DIAGNOSTIC), ...Object.values(BLOCK_REASON), ...documentedCodes]);
    for (const code of codes) {
        if (['SAME_BATCH_DETERMINISTIC_STAGE2_RESOLUTION', 'UNCLASSIFIED_POSSIBLE_LEAVE_CAN_FILL_REPO_REQUIREMENT'].includes(code)) continue;
        assert.ok(Object.hasOwn(guidance.catalog, code), code);
        const item = guidance.describe(code);
        assert.match(item.message, /[Α-Ωα-ω]/, code);
        assert.doesNotMatch(item.message, /[A-Za-z_]/, code);
        assert.ok(item.steps.length >= 2, code);
        assert.ok(item.next && item.why && item.category_label, code);
        assert.ok(Object.isFrozen(item), code);
    }
    assert.ok(codes.size > 250);
});

test('visible rest day, month boundary and blank calculated label alone do not prove BLOCKED', () => {
    const result = payload();
    assert.notEqual(result.lifecycle_projection.stages.stage1.business_status, 'BLOCKED');
    const blocked = payload(week(), { ...profile, hmeres_ergasias_ebdomadas: null });
    assert.equal(blocked.lifecycle_projection.stages.stage1.business_status, 'BLOCKED');
    const issues = ui.issues(blocked);
    assert.equal(issues[0].code, 'INVALID_EFFECTIVE_WEEKLY_WORKDAYS');
    assert.match(issues[0].message, /συμβατικών ημερών/);
    assert.doesNotMatch(issues[0].message, /πενθήμερη|εξαήμερη/); // Resolver accepts 1..6.
});

test('missing, repeated and unexpected dates retain exact structural evidence', () => {
    const rows = week(); rows[1] = { ...rows[1], hmeromhnia: '2026-09-02' };
    rows[6] = { ...rows[6], hmeromhnia: '2026-09-07' };
    const result = resolveWeeklyHrWorkflow({ weekRows: rows, effectiveProfile: profile });
    const detail = result.blocking_details.find(item => item.code === 'INCOMPLETE_NATURAL_WEEK');
    assert.deepEqual(detail.evidence.missing_dates, ['2026-09-01', '2026-09-06']);
    assert.deepEqual(detail.evidence.duplicate_dates, ['2026-09-02']);
    assert.deepEqual(detail.evidence.unexpected_dates, ['2026-09-07']);
});

test('multiple independent reasons keep employees, exact days and safe facts without sensitive fields', () => {
    const rows = week();
    rows[0].ores_ergasias = -5;
    Object.assign(rows[1], { cards_apo_ora_01: '09:00', cards_eos_ora_01: '09:00', afm: 'SECRET-AFM', amka: 'SECRET-AMKA' });
    Object.assign(rows[2], { kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: false });
    const result = payload(rows);
    const issues = ui.issues(result);
    assert.ok(issues.length >= 3);
    assert.deepEqual(issues.find(item => item.code === 'INVALID_DECLARED_HOURS').dates, ['2026-08-31']);
    assert.deepEqual(issues.find(item => item.code === 'ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION').dates, ['2026-09-01']);
    assert.deepEqual(issues.find(item => item.code === 'CATEGORY_REPO_CONFLICT').dates, ['2026-09-02']);
    const html = ui.detailHtml(ui.targets([result])[0]);
    assert.match(html, /0001/); assert.match(html, /ΣΥΝΘΕΤΙΚΟΣ ΕΡΓΑΖΟΜΕΝΟΣ/);
    assert.match(html, /31\/08\/2026–06\/09\/2026/);
    assert.match(html, /01\/09\/2026/); assert.match(html, /02\/09\/2026/);
    assert.doesNotMatch(html, /SECRET|INVALID_DECLARED_HOURS|CATEGORY_REPO_CONFLICT|afm|amka/);
    const safe = JSON.stringify(result.lifecycle_projection.stages.stage1.diagnostics);
    assert.doesNotMatch(safe, /SECRET|afm|amka/);
    assert.deepEqual(ui.targets([result]).map(item => item.date), ['2026-08-31','2026-09-01','2026-09-02']);
});

test('unknown diagnosis stays technical, is escaped and never becomes an invented business cause', () => {
    const result = payload();
    result.employee_name = '<img src=x onerror=alert(1)>';
    result.lifecycle_projection = { stages: { stage1: { business_status: 'BLOCKED', blockers: ['INTERNAL_SECRET_TOKEN'], diagnostics: [{ code: 'INTERNAL_SECRET_TOKEN', evidence: { afm: 'SECRET' } }] } } };
    const html = ui.detailHtml(ui.targets([result])[0]);
    assert.match(html, /Δεν προσδιορίστηκε συγκεκριμένη ασφαλής διάγνωση/);
    assert.match(html, /Δεν επιστράφηκαν συγκεκριμένες ημερομηνίες/);
    assert.match(html, /HR-[A-F0-9]{8}/);
    assert.doesNotMatch(html, /<img|INTERNAL_SECRET_TOKEN|SECRET/);
    assert.match(html, /&lt;img/);
    assert.equal(guidance.dateKey(new Date(NaN)), null);
    assert.equal(guidance.dateKey('2026-02-30'), null);
});

test('error responses preserve all reasons and never copy arbitrary error or request data', () => {
    const response = reviewErrorResponse({ code: 'STAGE1_COMPLETION_BLOCKED', message: 'PASSWORD SECRET',
        blocking_reasons: ['INVALID_DECLARED_HOURS','CATEGORY_REPO_CONFLICT'],
        diagnostics: [{ code: 'INVALID_DECLARED_HOURS', dates: ['2026-09-01'], afm: 'SECRET' }] });
    assert.equal(response.guidance.length, 3);
    assert.deepEqual(response.guidance[1].dates, ['2026-09-01']);
    assert.match(response.message, /1\./); assert.match(response.message, /Αναφορά τεχνικής υποστήριξης/);
    assert.doesNotMatch(response.message, /PASSWORD|SECRET|STAGE1_COMPLETION_BLOCKED/);
    assert.equal(response.save_state, 'NOT_CONFIRMED');
    assert.doesNotMatch(response.message, /Καμία αλλαγή δεν αποθηκεύτηκε/);
    assert.equal(reviewErrorResponse({}, 'UNKNOWN', { readOnly: true }).save_state, 'READ_ONLY');
});

test('decision validation retains exact machine causes with unchanged rejection status', () => {
    const { validateCommand } = require('./apasxoliseisWeeklyRepoTransferDecisionService');
    const { validateDecisionPayload, scopeFromInput } = require('./apasxoliseisWeeklyCanonicalDecisionService');
    for (const [run, code, status] of [
        [() => validateCommand(null), 'INVALID_REPO_DECISION_COMMAND', 400],
        [() => validateCommand({ $where: 'SECRET' }), 'REPO_DECISION_FIELDS_NOT_ALLOWED', 400],
        [() => validateCommand({}), 'REPO_DECISION_FIELDS_REQUIRED', 400],
        [() => scopeFromInput({ week_start: '2026-09-14', week_end: '2026-09-20' }), 'CANONICAL_DECISION_SCOPE_REQUIRED', 400],
        [() => validateDecisionPayload('CARD_VERIFICATION_PENDING', {}, { scope: {} }), 'CANONICAL_DECISION_CARD_REFERENCE_REQUIRED', 400]
    ]) {
        assert.throws(run, error => {
            assert.equal(error.code, code); assert.equal(error.statusCode, status);
            const response = reviewErrorResponse(error);
            assert.equal(response.guidance[0].message, guidance.describe(code).message);
            assert.doesNotMatch(response.message, /SECRET|\$where|scope|card evidence/);
            return true;
        });
    }
    for (const [code, category] of [['INVALID_DECLARED_HOURS', 'DATA'],
        ['EMPLOYMENT_PROFILE_BLOCKED', 'PROFILE'], ['SOURCE_LOCKED', 'LOCKED'],
        ['CRITICAL_EMPLOYMENT_DECISION_NOT_AUTHORIZED', 'ACCESS'], ['UNKNOWN', 'TECHNICAL']])
        assert.equal(guidance.describe(code).category, category);
});

test('stage-2 bulk diagnostics preserve all causes without changing classification counts', () => {
    const context = { scope: { employee_id: 'employee', employee_kodikos: '0001', week_start: '2026-08-31', week_end: '2026-09-06' }, rows: [],
        lifecycle: { stages: { stage2: { business_status: 'BLOCKED', blockers: ['TARGET_LOCKED','SOURCE_MANUAL_OVERRIDE'], pending_reasons: ['REPO_TRANSFER_DECISION_REQUIRED'] } } } };
    const preview = buildWeeklyHrStage2BulkPreview({ contexts: [context] });
    assert.equal(preview.safe_bulk_count, 0);
    assert.equal(preview.technical_conflict_count, 1);
    const exception = preview.technical_conflicts[0];
    assert.deepEqual(exception.reasons, ['TARGET_LOCKED','SOURCE_MANUAL_OVERRIDE','REPO_TRANSFER_DECISION_REQUIRED']);
});

test('completed and finalized stages do not retain obsolete diagnostic guidance', () => {
    const rows = week(); rows[0].ores_ergasias = -1;
    const finalized = buildFinalizedWeeklyHrLifecyclePresentation(payload(rows).lifecycle_projection);
    assert.deepEqual(finalized.stages.stage1.diagnostics, []);
    assert.deepEqual(ui.targets([{ ...payload(rows), lifecycle_projection: finalized }]), []);
});

test('final-stage diagnostics use the analyzer sixth day and worked rest identities', () => {
    const details = analysisDiagnostics(['MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE',
        'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION'], {
        sixthDayIdentity: '2026-09-19', canonicalRepoDayIdentities: ['2026-09-19', '2026-09-20']
    });
    assert.deepEqual(details[0].dates, ['2026-09-19']);
    assert.deepEqual(details[1].dates, ['2026-09-19','2026-09-20']);
});

test('bounded presentation for 2000 employees and five weeks uses existing payloads, without reads or writes', () => {
    const base = payload(week(), { ...profile, hmeres_ergasias_ebdomadas: null });
    const payloads = Array.from({ length: 10000 }, (_, index) => ({ ...base, scope: { ...base.scope, employee_kodikos: String(Math.floor(index / 5)).padStart(4,'0') } }));
    const before = JSON.stringify(payloads);
    const start = performance.now();
    const targets = ui.targets(payloads);
    const html = ui.stageHtml('STAGE1', targets[0], 0, targets.length);
    const elapsed = performance.now() - start;
    assert.equal(targets.length, 10000);
    assert.ok(html.length < 15000); // Render only the selected week's evidence.
    assert.equal(JSON.stringify(payloads), before);
    assert.ok(elapsed < 3000, `${elapsed} ms`);
    console.log(`guidance: 2000 employees / 10000 weeks in ${elapsed.toFixed(1)} ms, ${html.length} rendered characters`);
});
