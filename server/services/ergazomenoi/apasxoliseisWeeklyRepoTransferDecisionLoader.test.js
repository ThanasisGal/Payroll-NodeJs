const assert = require('assert');
const mongoose = require('mongoose');
const {
    ROW_FIELDS,
    defaultContextLoader,
    reconstructWeeklyRepoTransferDecision
} = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');

const sourceId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const targetId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
function row(id, date) { return { _id: id, team: 'THA', company_kod: 'company-id', ypokatasthma: '0000', kodikos: '0001', hmeromhnia: new Date(`${date}T00:00:00Z`), kathgoria_ergasias: 'ΕΡΓ', cards_ores_ergasias: 0, is_locked: false }; }
const weekRows = Array.from({ length: 7 }, (_, index) => row(index === 1 ? sourceId : index === 5 ? targetId : new mongoose.Types.ObjectId(), `2026-06-${String(14 + index).padStart(2, '0')}`));

function query(result, log) {
    return {
        select(value) { log.selects.push(value); return this; },
        sort() { return this; },
        lean: async () => result
    };
}
function models({ employees, audits = [], history = [] }) {
    const log = { prodFilters: [], employeeFilters: [], selects: [] };
    let prodCall = 0;
    return {
        log,
        value: {
            prodhlomenaModel: { find(filter) { log.prodFilters.push(filter); return query(prodCall++ === 0 ? [weekRows[1], weekRows[5]] : weekRows, log); } },
            employeeModel: { find(filter) { log.employeeFilters.push(filter); return query(employees, log); } },
            historyModel: { find() { return query(history, log); } },
            auditModel: { find() { return query(audits, log); } }
        }
    };
}
const employee = { _id: new mongoose.Types.ObjectId(), kodikos: '0001', ypokatasthma: '0000', energos: true, archived: false, kathestos_apasxolhshs: '0', mhniaia_repo: 2, hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
const holidayContextBuilder = async () => ({ companyFlags: { apasxolhsh_kata_tis_argies: false, leitoyrgia_stis_mh_ypoxreotikes_argies: false }, company_kodikos: '0004', argiesByDateKey: new Map() });
const scope = { team: 'THA', company_kod: 'company-id', company_kodikos: '0004', year: '2026' };

async function run() {
    const configured = models({ employees: [employee], audits: [{ prodhlomena_oraria_id: sourceId }] });
    const context = await defaultContextLoader({ scope, sourceId: String(sourceId), targetId: String(targetId), models: configured.value, holidayContextBuilder });
    assert.strictEqual(context.weekRows.length, 7);
    assert.strictEqual(context.employee, employee);
    assert.strictEqual(context.employmentProfile.profile_source, 'ERG_AKTUAL');
    assert.strictEqual(String(context.audits[0].prodhlomena_oraria_id), String(sourceId));
    assert.strictEqual(configured.log.prodFilters[0].team, 'THA');
    assert.strictEqual(configured.log.prodFilters[1].ypokatasthma, '0000');
    assert.ok(configured.log.selects.includes(ROW_FIELDS.join(' ')));

    for (const employees of [[], [employee, { ...employee, _id: new mongoose.Types.ObjectId() }], [{ ...employee, ypokatasthma: '0001' }]]) {
        await assert.rejects(() => defaultContextLoader({ scope, sourceId: String(sourceId), targetId: String(targetId), models: models({ employees }).value, holidayContextBuilder }), (error) => error.statusCode === 409);
    }
    await assert.rejects(() => defaultContextLoader({ scope, sourceId: String(sourceId), targetId: String(targetId), models: models({ employees: [employee] }).value, holidayContextBuilder: async () => null }), (error) => error.statusCode === 409);

    let auditMap;
    await assert.rejects(() => reconstructWeeklyRepoTransferDecision({
        scope,
        command: { proposal_id: 'not-ready', expected_source_id: String(sourceId), expected_target_id: String(targetId), expected_proposal_version: 'v', expected_choice_code: 'c' },
        contextLoader: async () => context,
        projectionBuilder: (input) => { auditMap = input.existingAuditCountByRowKey; return { projection_status: 'NOT_AVAILABLE', groups: [] }; }
    }), (error) => error.statusCode === 409);
    assert.strictEqual(auditMap.get(String(sourceId)), 1);
    console.log('weekly repo transfer decision loader tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
