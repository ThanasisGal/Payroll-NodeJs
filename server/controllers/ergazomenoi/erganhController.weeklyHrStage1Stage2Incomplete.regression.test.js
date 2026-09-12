'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildWeeklyHrWorkflowProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowProjectionService');
const { buildWeeklyHrLifecycleProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const bulk = controller.slice(controller.indexOf('static getWeeklyHrWorkflowStage1Bulk ='),
    controller.indexOf('static exportProdhlomenaOrariaReviewAuditDossierPdf ='));

assert.doesNotMatch(bulk,
    /if \(preparedStage2ErrorsByWeek\.has\(key\)\)[\s\S]*?success: false[\s\S]*?continue;/);
assert.match(bulk, /stage2StateDiagnostic:\s*[\s\S]*?preparedStage2ErrorsByWeek\.get\(key\)\?\.reason \|\| null/);
assert.match(bulk, /if \(!weekRows\.length \|\| !lifecycleProjection\) continue;/);
assert.equal((bulk.match(/getWeeklyHrWorkflowIndexState\(\)/g) || []).length, 1);

const rows = Array.from({ length: 7 }, (_, index) => ({
    _id: `row-${index}`, team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: 'employee-0001', kodikos: '0001',
    hmeromhnia: `2026-05-${String(4 + index).padStart(2, '0')}`,
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    kathgoria_ergasias_apologistika: 'ΕΡΓ', ores_ergasias_apologistika: 8,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_ores_ergasias: 8,
    repo: false, repo_apologistika: false, adeia_apologistika: false,
    astheneia_apologistika: false, apousia_apologistika: false,
    kathgoria_adeias_apologistika: ''
}));
rows[1] = { ...rows[1], cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
    ores_ergasias_apologistika: 0, kathgoria_ergasias_apologistika: '',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' };
const effectiveProfile = { hmeres_ergasias_ebdomadas: 5,
    typos_apasxolhshs: '0', pososto_prosayxhshs_6hs_hmeras: 40 };

function payload(indexState, stage2StateDiagnostic = null) {
    const stage1 = buildWeeklyHrWorkflowProjection({ weekRows: rows,
        effectiveProfile, indexState });
    const lifecycle = buildWeeklyHrLifecycleProjection({ weekRows: rows,
        effectiveProfile, stage2StateDiagnostic });
    return { success: true, ...stage1, lifecycle_projection: lifecycle };
}

for (const [ready, expectedEnabled, expectedCode] of [
    [true, true, null],
    [false, false, 'WEEKLY_HR_WORKFLOW_INDEXES_NOT_READY']
]) {
    const result = payload({ ready }, 'INCOMPLETE_EMPLOYEE_WEEK');
    assert.equal(result.success, true);
    assert.equal(result.write_enabled, expectedEnabled);
    assert.equal(result.write_disabled_code, expectedCode);
    assert.equal(result.lifecycle_projection.stages.stage1.business_status, 'OPEN');
    assert.equal(result.lifecycle_projection.stages.stage2.business_status, 'BLOCKED');
    assert.equal(result.lifecycle_projection.stages.stage2.stage2_applicability,
        'NOT_APPLICABLE');
    assert.equal(result.lifecycle_projection.stages.stage2.pending_count, 1);
    assert.deepEqual(result.lifecycle_projection.stages.stage2.blockers,
        ['INCOMPLETE_EMPLOYEE_WEEK']);
}

const normal = payload({ ready: true });
assert.equal(normal.success, true);
assert.equal(normal.lifecycle_projection.stages.stage2.blockers.length, 0);

console.log('Stage 2 incomplete does not suppress Stage 1 controller regression: PASS');
