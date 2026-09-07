'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const originalLoad = Module._load;
let hooks;
try {
    Module._load = function (request, parent, isMain) {
        if (request === 'libxmljs2') return { parseXml() { throw new Error('No XML in payroll test'); } };
        return originalLoad.call(this, request, parent, isMain);
    };
    hooks = require('./erganhController').__orphanDailyCalculationTestHooks;
} finally { Module._load = originalLoad; }
const employee = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0',
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30,
    dialleima_apo_ora_01: '03:00', dialleima_eos_ora_01: '03:30' };
const row = { hmeromhnia: '2026-09-06', kathgoria_ergasias: 'ΕΡΓ',
    apo_ora_01: '23:00', eos_ora_01: '07:00', ores_ergasias: 8,
    cards_apo_ora_01: '23:00', cards_eos_ora_01: '07:30', cards_ores_ergasias: 8.5 };

test('controller counts only exact worked minutes; no second subtraction for HR-approved intervals', () => {
    assert.equal(hooks.getPayrollDailyWorkMinutes(row, employee), 480);
    const approved = { ...row, cards_eos_ora_01: '',
        apo_ora_01_apologistika: '23:00', eos_ora_01_apologistika: '07:30',
        orphan_card_resolution: { status: 'HR_APPROVED' } };
    assert.equal(hooks.getPayrollDailyWorkMinutes(approved, employee), 480);
    const result = hooks.buildApprovedOrphanDailyDerivedUpdate({ row: approved,
        effectiveEmployee: employee, argiesDateSet: new Set(),
        approvedOrphanResolution: { approvedUpdates: {
            apo_ora_01_apologistika: '23:00', eos_ora_01_apologistika: '07:30'
        } } }).derivedUpdate;
    assert.equal(result.ores_ergasias_apologistika, 8);
    assert.equal(result.ores_nyxtas_apologistika, 6.5);
    assert.equal(result.ores_argion_prosayxhsh_apologistika, 1);
});
test('overwork and overtime advance over worked minutes, never over a break', () => {
    const context = { rec: { ...row, hmeromhnia: '2026-09-03', cards_eos_ora_01: '09:30' },
        ergazomenos: employee, argiesDateSet: new Set() };
    const result = hooks.calculateAdditionalAndOverworkForDay(context, { processedRegularMinutes: 0, weeklyRegularCardsMinutes: 3000 });
    assert.equal(result.ores_yperergasias_apologistika, 1);
    assert.equal(result.ores_nominhs_yperorias_apologistika, 1);
    assert.equal(result.ores_yperergasias_nyxtas_apologistika, 0);
    // Exact timestamps already include the break: do not add a second offset.
    assert.equal(result.apo_ora_yperories, '08:30');
    assert.equal(result.eos_ora_yperories, '09:30');
});
test('break intersecting overtime removes its night/day minutes from overtime classification', () => {
    const rec = { ...row, hmeromhnia: '2026-09-03', apo_ora_01: '20:00', eos_ora_01: '04:00',
        cards_apo_ora_01: '20:00', cards_eos_ora_01: '06:30' };
    const result = hooks.calculateAdditionalAndOverworkForDay({ rec,
        ergazomenos: { ...employee, dialleima_apo_ora_01: '05:45', dialleima_eos_ora_01: '06:15' },
        argiesDateSet: new Set() }, { processedRegularMinutes: 0, weeklyRegularCardsMinutes: 3000 });
    assert.equal(result.ores_yperergasias_nyxtas_apologistika, 1);
    assert.equal(result.ores_nominhs_yperorias_nyxtas_apologistika, 0.75);
    assert.equal(result.ores_nominhs_yperorias_apologistika, 0.25);
    assert.equal(result.apo_ora_yperories, '05:00');
    assert.equal(result.eos_ora_yperories, '06:30');
});
