'use strict';

const assert = require('node:assert/strict');
const { buildWeeklyHrStage2BulkPreview } = require(
    './apasxoliseisWeeklyHrStage2BulkPreviewService');
const { buildWeeklyHrStage2BulkDetails } = require(
    './apasxoliseisWeeklyHrStage2BulkDetailsService');
const { WeeklyHrStage2BulkStateCache } = require(
    './apasxoliseisWeeklyHrStage2BulkStateCacheService');

function context(index) {
    const date = `2026-05-${String(4 + index).padStart(2, '0')}`;
    return { scope: { employee_id: `employee-${index}`, employee_kodikos:
        String(index).padStart(4, '0'), week_start: '2026-05-04', week_end: '2026-05-10' },
    employee: { eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΧΡΗΣΤΗΣ' }, rows: [{ _id: `row-${index}`,
        hmeromhnia: date, updatedAt: date, kathgoria_ergasias: 'ΕΡΓ',
        cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
        apologistiko_biblio: false, repo_apologistika: false,
        kathgoria_ergasias_apologistika: '',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', adeia_apologistika: false,
        astheneia_apologistika: false, apousia_apologistika: false,
        ores_ergasias_apologistika: 8 }],
    effectiveProfilesByDate: { [date]: { typos_apasxolhshs: '0' } },
    workflowState: { stage1: { status: 'COMPLETED' } },
    upstream: { stage1_current_fingerprint: 'a'.repeat(64) }, lifecycle: { stages: {
        stage2: {}, stage3: { pending_dates: [], stage2_automatic_resolution_items: [
            { date, classification: 'REST_REPO' }] } } } };
}

const contexts = Array.from({ length: 7 }, (_, index) => context(index));
const preview = buildWeeklyHrStage2BulkPreview({ contexts });
const details = buildWeeklyHrStage2BulkDetails({ contexts,
    cachedSeeds: preview.safe_scope_ids.map((seed, index) => ({ ...seed,
        row_ids: [`row-${index}`] })), page_size: 50 });
assert.equal(details.length, 7);
assert.deepEqual(Object.keys(details[0]).sort(), ['after', 'before', 'date', 'employee',
    'employee_kodikos', 'safety_reason', 'week_end', 'week_start'].sort());
assert.match(details[0].employee, /0000 — ΔΟΚΙΜΗ ΧΡΗΣΤΗΣ/);
assert.equal(details[0].before, 'Πιθανή άδεια');
assert.equal(details[0].after, 'Ρεπό');
assert.equal(details.length <= 50, true);

// The main search intentionally keeps only the profile fields needed by Stage 2, while the
// targeted loader returns the complete effective profile. Equal business state must therefore
// produce the same guarded fingerprint on the first details request.
const fullProfileContext = context(0);
fullProfileContext.effectiveProfilesByDate['2026-05-04'] = {
    typos_apasxolhshs: '0', employee_id: 'employee-0', valid_from: '2026-01-01',
    unrelated_loader_field: 'not part of the Stage-2 safety decision'
};
const requestScope = { team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
    period_start: '2026-05-01', period_end: '2026-05-31', user_id: 'user-a' };
const cache = new WeeklyHrStage2BulkStateCache();
cache.put({ preview, scope: requestScope, contexts });
const firstPage = cache.detailPageSeeds({ preview_fingerprint: preview.preview_fingerprint,
    scope: requestScope, page: 1, page_size: 50 });
const freshDetails = buildWeeklyHrStage2BulkDetails({ contexts: [fullProfileContext],
    cachedSeeds: [firstPage.cachedSeeds[0]] });
assert.equal(freshDetails.length, 1);
assert.equal(firstPage.page, 1);
assert.equal(firstPage.page_size, 50);

const changedProfileContext = context(0);
changedProfileContext.effectiveProfilesByDate['2026-05-04'] = {
    typos_apasxolhshs: '1', employee_id: 'employee-0', valid_from: '2026-01-01'
};
assert.throws(() => buildWeeklyHrStage2BulkDetails({ contexts: [changedProfileContext],
    cachedSeeds: [firstPage.cachedSeeds[0]] }),
{ code: 'STAGE2_INPUT_CHANGED', statusCode: 409 });

const changed = context(0);
changed.rows[0].kathgoria_ergasias_apologistika = 'ΜΕ';
assert.throws(() => buildWeeklyHrStage2BulkDetails({ contexts: [changed],
    cachedSeeds: [{ ...preview.safe_scope_ids[0], row_ids: ['row-0'] }] }),
{ code: 'STAGE2_INPUT_CHANGED', statusCode: 409 });
console.log('weekly HR Stage-2 bounded read-only detail tests passed');
