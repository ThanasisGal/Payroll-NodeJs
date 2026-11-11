'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareWeeklyHrStage2LifecycleRow, weeklyHrStage2LifecycleProfileFromRow,
    resolveWeeklyHrSearchDailyProfile } = require('./erganhController').__stage3DailyEmploymentProfileTestHooks;
const { buildWeeklyHrWorkflowProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrWorkflowProjectionService');

function fixture(dailyType = '') {
    const employee = { _id: 'synthetic-0015', kodikos: '0015', kathestos_apasxolhshs: '0',
        typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    const history = [1, 2].map(id => ({ ...employee, _id: `synthetic-history-${id}`,
        afora_allagh_oron_ergasias: true, hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01' }));
    const rows = Array.from({ length: 7 }, (_, i) => {
        const rest = [2, 4].includes(i);
        return { _id: `synthetic-day-${i}`, kodikos: '0015',
            hmeromhnia: `2026-09-${String(7 + i).padStart(2, '0')}`,
            kathestos_apasxolhshs_hmeras: dailyType,
            kathgoria_ergasias: rest ? 'ΑΝ' : 'ΕΡΓ', repo: rest,
            kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : 'ΕΡΓ', repo_apologistika: rest,
            apo_ora_01: rest ? '' : '08:00', eos_ora_01: rest ? '' : '16:00',
            cards_apo_ora_01: rest ? '' : '08:00', cards_eos_ora_01: rest ? '' : '16:00',
            ores_ergasias: rest ? 0 : 8, cards_ores_ergasias: rest ? 0 : 8,
            ores_ergasias_apologistika: rest ? 0 : 8,
            ores_pragmatikhs_ergasias_apologistika: rest ? 0 : 8 };
    });
    return { employee, history, rows };
}

function project(data) {
    const rows = data.rows.map(row => prepareWeeklyHrStage2LifecycleRow({ row,
        effectiveProfile: resolveWeeklyHrSearchDailyProfile({ row, employee: data.employee,
            istorikoRows: data.history }) }));
    const profiles = Object.fromEntries(rows.map(row => [row.hmeromhnia,
        weeklyHrStage2LifecycleProfileFromRow(row)]));
    return { rows, workflow: buildWeeklyHrWorkflowProjection({ weekRows: rows,
        effectiveProfilesByDate: profiles, indexState: { ready: true } }).workflow };
}

test('0015 / 07–13 September: empty daily type must not create a false rest conflict', () => {
    const data = fixture();
    const before = structuredClone(data);
    const result = project(data);
    assert.ok(!result.workflow.blocking_reasons.includes('CATEGORY_REPO_CONFLICT'),
        JSON.stringify(result.workflow.blocking_reasons));
    for (const row of result.rows) {
        assert.equal(row.effective_typos_apasxolhshs, '0');
        assert.equal(row.effective_kathestos_apasxolhshs, '0');
        assert.equal(row.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
        assert.equal(row.history_terms_unavailable, true);
        assert.equal(row.all_financial_results_documented, false);
        assert.equal(row.effective_hourly_rate, null);
        assert.equal(row.effective_is_full_time, null);
        assert.ok(row.unavailable_financial_fields.includes('pragmatikoOromisthio'));
        assert.ok(row.history_warning);
        assert.equal(row.assumed_work_terms.typos_apasxolhshs, '0');
    }
    assert.deepEqual(data, before, 'cards, classifications and history remain unchanged');
});

test('real retrospective work plus repo remains blocking', () => {
    const data = fixture();
    data.rows[2].kathgoria_ergasias_apologistika = 'ΕΡΓ';
    assert.ok(project(data).workflow.blocking_reasons.includes('CATEGORY_REPO_CONFLICT'));
});

for (const type of ['', '   ', null, undefined, '0', '1', '2', 0, 'ΜΕΡΙΚΗ', 'invalid']) {
    test(`legacy daily type precedence: ${JSON.stringify(type)}`, () => {
        const data = fixture();
        const row = { ...data.rows[2], kathestos_apasxolhshs_hmeras: type };
        const profile = resolveWeeklyHrSearchDailyProfile({ row, employee: data.employee,
            istorikoRows: data.history });
        const prepared = prepareWeeklyHrStage2LifecycleRow({ row, effectiveProfile: profile });
        const expected = String(type ?? '').trim() ? type : profile.typos_apasxolhshs;
        assert.equal(prepared.effective_typos_apasxolhshs, expected);
        assert.equal(prepared.effective_kathestos_apasxolhshs, expected);
        assert.equal(prepared.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
        assert.equal(prepared.effective_hourly_rate, null);
    });
}

test('verified history keeps its existing authoritative daily selection', () => {
    const data = fixture('2');
    const profile = { ...data.employee, source: 'DATE_EFFECTIVE_HISTORY', pragmatikoOromisthio: 12 };
    const row = prepareWeeklyHrStage2LifecycleRow({ row: data.rows[2], effectiveProfile: profile });
    assert.equal(row.effective_typos_apasxolhshs, '0');
    assert.equal(row.effective_hourly_rate, 12);
    assert.equal(row.effective_profile_source, 'DATE_EFFECTIVE_HISTORY');
});
