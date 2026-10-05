'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { STATES, INTENTS, resolveEmployeeHistoryMutation } =
    require('./employeeEmploymentProfileMutationResolverService');
const { REAL_0069_IDS, buildReal0069SanitizedHistoryFixture } =
    require('./fixtures/real0069SanitizedHistoryFixture');

const scope = { team: 'BLG', company_kod: 'company-0004', kodikos: '0068' };
function row(id, from = '2026-05-01', extra = {}) {
    return { _id: id, ...scope, aa_eggrafhs: '0001',
        hmeromhnia_proslhpshs: '2026-05-01',
        hmeromhnia_allaghs_symbashs: '2026-05-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-05-07',
        hmeromhnia_isxyos_oron_ergasias_apo: from,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: null,
        hmeromhnia_apoxorhshs: null,
        ...extra };
}
function resolve(options = {}) {
    const history = options.historyRows || [row('history-1')];
    return resolveEmployeeHistoryMutation({ scope,
        currentEmployee: options.currentEmployee || { ...row('employee'), _id: 'employee' },
        historyRows: history,
        submittedState: options.submittedState || { employeePatch: {}, historyPatch: {} },
        intentHint: options.intentHint || INTENTS.MAINTENANCE,
        historyId: options.historyId === undefined ? 'history-1' : options.historyId,
        expectedRevision: options.expectedRevision });
}

test('0068 sparse row contract-end edit corrects the stable row', () => {
    const plan = resolve({ submittedState: {
        effectiveFrom: '2026-05-01',
        employeePatch: { hmeromhnia_lhxhs_symbashs: '2026-10-31' },
        historyPatch: { hmeromhnia_lhxhs_symbashs: '2026-10-31' }
    } });
    assert.equal(plan.state, STATES.CORRECT_EXISTING);
    assert.equal(plan.targetHistoryId, 'history-1');
    assert.equal(plan.historyPatch.hmeromhnia_lhxhs_symbashs, '2026-10-31');
    assert.equal(plan.appendSnapshot, null);
});

function polluted0069() {
    const fixture = buildReal0069SanitizedHistoryFixture();
    return { historyRows: fixture.history, currentEmployee: fixture.currentEmployee };
}

test('0069 deterministic polluted group always corrects authoritative 0005', () => {
    const { historyRows, currentEmployee } = polluted0069();
    for (const historyId of [...historyRows.map(item => item._id), null]) {
        const plan = resolveEmployeeHistoryMutation({ scope: {
            team: currentEmployee.team,
            company_kod: currentEmployee.company_kod,
            kodikos: currentEmployee.kodikos
        }, historyRows, historyId, submittedState: {
            effectiveFrom: '2026-05-02', employeePatch: {},
            historyPatch: { hmeromhnia_lhxhs_symbashs: '2026-10-31' }
        }, currentEmployee, intentHint: INTENTS.MAINTENANCE });
        assert.equal(plan.state, historyId === null
            ? STATES.NO_HISTORY_CHANGE
            : STATES.CORRECT_EXISTING, historyId);
        assert.equal(plan.targetHistoryId, REAL_0069_IDS['0005'], historyId);
        assert.deepEqual(plan.employeePatch, {}, historyId);
        assert.deepEqual(plan.historyPatch, historyId === null
            ? {}
            : { hmeromhnia_lhxhs_symbashs: '2026-10-31' }, historyId);
        assert.deepEqual(plan.rowsToDelete.map(item => item.historyId),
            [REAL_0069_IDS['0002'], REAL_0069_IDS['0003'], REAL_0069_IDS['0004']], historyId);
    }
});

test('competing genuine hire boundaries remain a closed conflict', () => {
    const first = row('hire-1', '2026-05-01', { afora_proslhpsh: true,
        afora_allagh_oron_ergasias: false });
    const second = { ...first, _id: 'hire-2', aa_eggrafhs: '0002',
        hmeromhnia_allaghs_symbashs: '2026-05-02',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-02' };
    delete first.hmeromhnia_isxyos_oron_ergasias_apo;
    delete second.hmeromhnia_isxyos_oron_ergasias_apo;
    const plan = resolve({ historyRows: [first, second], historyId: 'hire-1',
        currentEmployee: { ...first, _id: 'employee' }, submittedState: {
            effectiveFrom: '2026-05-01', employeePatch: {},
            historyPatch: { hmeromhnia_lhxhs_symbashs: '2026-11-30' }
        } });
    assert.equal(plan.state, STATES.CONFLICT);
    assert.equal(plan.responseCode, 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED');
    assert.deepEqual(plan.employeePatch, {});
    assert.deepEqual(plan.historyPatch, {});
});

test('ordinary non-history edit has no history mutation', () => {
    const plan = resolve({ submittedState: { employeePatch: { email: 'new@example.test' }, historyPatch: {} } });
    assert.equal(plan.state, STATES.NO_HISTORY_CHANGE);
    assert.deepEqual(plan.employeePatch, { email: 'new@example.test' });
    assert.equal(plan.idempotent, false);
});

test('repeated identical maintenance is idempotent', () => {
    const plan = resolve();
    assert.equal(plan.state, STATES.NO_HISTORY_CHANGE);
    assert.equal(plan.idempotent, true);
});

test('schedule-from change is a same-id boundary move', () => {
    const plan = resolve({ submittedState: { effectiveFrom: '2026-05-02', employeePatch: {},
        historyPatch: { hmeromhnia_allaghs_orarioy_apo: '2026-05-02',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-02' } } });
    assert.equal(plan.state, STATES.MOVE_EXISTING_BOUNDARY);
    assert.equal(plan.targetHistoryId, 'history-1');
});

function fullProfileVersion(id, from, type = '0', extra = {}) {
    const input = { kathestos_apasxolhshs: type, typos_apasxolhshs: type,
        typos_ebdomadas: '5HMERH', hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: type === '0' ? 40 : 20,
        mo_oron_hmerhsias_ergasias: type === '0' ? 8 : 4 };
    return { _id: id, ...scope,
        ...buildCompleteProfileSnapshot({ input, current: input, effectiveFrom: from }),
        aa_eggrafhs: '0001', hmeromhnia_proslhpshs: '2026-02-02',
        hmeromhnia_allaghs_symbashs: from,
        hmeromhnia_allaghs_orarioy_apo: from,
        hmeromhnia_allaghs_orarioy_eos: '2026-04-07',
        hmeromhnia_isxyos_oron_ergasias_apo: from,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: '2027-01-31',
        hmeromhnia_apoxorhshs: null, ...extra };
}

function maintenanceTransition({ existing, employee = null, effectiveFrom,
    employeePatch = {}, historyPatch = {}, historyId = existing._id }) {
    return resolveEmployeeHistoryMutation({ scope,
        currentEmployee: employee || { ...existing, _id: 'employee', energos: true, archived: false },
        historyRows: [existing], historyId, intentHint: INTENTS.MAINTENANCE,
        submittedState: { effectiveFrom, employeePatch, historyPatch } });
}

test('current-form transition echoes collapse to NO_HISTORY_CHANGE without a selected history id', () => {
    const existing = fullProfileVersion('existing', '2026-04-01');
    const employee = { ...existing, _id: 'employee', energos: true, archived: false,
        hmeromhnia_allaghs_orarioy_eos: '2026-04-14' };
    const plan = maintenanceTransition({ existing, employee, effectiveFrom: '2026-04-01',
        historyId: null,
        historyPatch: { hmeromhnia_allaghs_orarioy_eos: '2026-04-14' } });
    assert.equal(plan.state, STATES.NO_HISTORY_CHANGE);
    assert.deepEqual(plan.historyPatch, {});
    assert.equal(plan.targetHistoryId, existing._id);
});

test('same-date semantic correction preserves the stable target and never appends', () => {
    const existing = fullProfileVersion('existing-partial', '2026-09-29', '1');
    const plan = maintenanceTransition({ existing, effectiveFrom: '2026-09-29',
        employeePatch: { ores_ergasias_ebdomadas: 24, mo_oron_hmerhsias_ergasias: 4.8 },
        historyPatch: { ores_ergasias_ebdomadas: 24, mo_oron_hmerhsias_ergasias: 4.8 } });
    assert.equal(plan.state, STATES.CORRECT_EXISTING);
    assert.equal(plan.targetHistoryId, existing._id);
});

test('later boundary-only Maintenance remains a stable-id boundary move', () => {
    const existing = fullProfileVersion('existing-full', '2026-04-01');
    const plan = maintenanceTransition({ existing, effectiveFrom: '2026-09-29',
        historyPatch: { hmeromhnia_allaghs_symbashs: '2026-09-29',
            hmeromhnia_allaghs_orarioy_apo: '2026-09-29',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-29' } });
    assert.equal(plan.state, STATES.MOVE_EXISTING_BOUNDARY);
    assert.equal(plan.targetHistoryId, existing._id);
});

test('later semantic Maintenance change is ambiguous and never inferred as append', () => {
    const existing = fullProfileVersion('existing-full', '2026-04-01');
    const plan = maintenanceTransition({ existing, effectiveFrom: '2026-09-29',
        historyId: null,
        employeePatch: { kathestos_apasxolhshs: '1', typos_apasxolhshs: '1' },
        historyPatch: { hmeromhnia_allaghs_symbashs: '2026-09-29',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-29',
            kathestos_apasxolhshs: '1', typos_apasxolhshs: '1' } });
    assert.equal(plan.state, STATES.CONFLICT);
    assert.equal(plan.responseCode, 'CONFLICT_PROFILE_CHANGE_INTENT_REQUIRED');
});

test('retrospective semantic Maintenance change fails closed', () => {
    const existing = fullProfileVersion('latest', '2026-09-29');
    const plan = maintenanceTransition({ existing, effectiveFrom: '2026-09-28',
        historyId: null,
        employeePatch: { kathestos_apasxolhshs: '1', typos_apasxolhshs: '1' },
        historyPatch: { hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-28',
            kathestos_apasxolhshs: '1', typos_apasxolhshs: '1' } });
    assert.equal(plan.state, STATES.CONFLICT);
    assert.equal(plan.responseCode, 'NEW_VERSION_NOT_FUTURE');
});

test('closed relationship semantic Maintenance change fails closed', () => {
    const existing = fullProfileVersion('closed', '2026-04-01', '0', {
        hmeromhnia_apoxorhshs: '2026-09-01' });
    const employee = { ...existing, _id: 'employee', energos: false, archived: false };
    const plan = maintenanceTransition({ existing, employee, effectiveFrom: '2026-09-29',
        historyId: null,
        employeePatch: { kathestos_apasxolhshs: '1', typos_apasxolhshs: '1' },
        historyPatch: { hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-29',
            kathestos_apasxolhshs: '1', typos_apasxolhshs: '1' } });
    assert.equal(plan.state, STATES.CONFLICT);
    assert.equal(plan.responseCode,
        'EMPLOYEE_PROFILE_NEW_VERSION_REQUIRES_OPEN_RELATIONSHIP');
});

test('an older explicitly selected stable id is never promoted to append', () => {
    const older = { ...fullProfileVersion('older', '2026-04-01'),
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-08-31' };
    const latest = { ...fullProfileVersion('latest', '2026-09-01'), aa_eggrafhs: '0002' };
    const employee = { ...latest, _id: 'employee', energos: true, archived: false };
    const plan = resolveEmployeeHistoryMutation({ scope, currentEmployee: employee,
        historyRows: [older, latest], historyId: older._id, intentHint: INTENTS.MAINTENANCE,
        submittedState: { effectiveFrom: '2026-04-01', employeePatch: {},
            historyPatch: { ores_ergasias_ebdomadas: 39 } } });
    assert.equal(plan.state, STATES.CORRECT_EXISTING);
    assert.equal(plan.targetHistoryId, older._id);
});

test('an explicitly selected current row keeps future semantic edits on that stable id', () => {
    const latest = fullProfileVersion('latest', '2026-04-01');
    const employee = { ...latest, _id: 'employee', energos: true, archived: false };
    const plan = resolveEmployeeHistoryMutation({ scope, currentEmployee: employee,
        historyRows: [latest], historyId: latest._id, intentHint: INTENTS.MAINTENANCE,
        submittedState: { effectiveFrom: '2026-09-01', employeePatch: {},
            historyPatch: { ores_ergasias_ebdomadas: 39,
                hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-01' } } });
    assert.equal(plan.state, STATES.MOVE_EXISTING_BOUNDARY);
    assert.equal(plan.targetHistoryId, latest._id);
});

test('schedule-to and work-terms-to corrections stay on the same row', () => {
    for (const [field, value] of [
        ['hmeromhnia_allaghs_orarioy_eos', '2026-05-08'],
        ['hmeromhnia_isxyos_oron_ergasias_eos', '2026-10-31']
    ]) {
        const plan = resolve({ submittedState: { effectiveFrom: '2026-05-01', employeePatch: {},
            historyPatch: { [field]: value } } });
        assert.equal(plan.state, STATES.MOVE_EXISTING_BOUNDARY, field);
        assert.equal(plan.targetHistoryId, 'history-1');
    }
});

test('boundary overlap fails closed', () => {
    const historyRows = [row('history-1', '2026-05-01', { hmeromhnia_isxyos_oron_ergasias_eos: '2026-05-31' }),
        row('history-2', '2026-06-01')];
    const plan = resolve({ historyRows, submittedState: { employeePatch: {},
        historyPatch: { hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-02' } } });
    assert.equal(plan.responseCode, 'CONFLICT_OVERLAP');
});

test('explicit future version appends, and identical replay resolves to existing row', () => {
    const snapshot = { ...row('new', '2026-06-01'), nomimosMisthos: 1200,
        hmeres_ergasias_ebdomadas: 5 };
    const first = resolve({ intentHint: INTENTS.APPEND_NEW_VERSION, historyId: null,
        submittedState: { effectiveFrom: '2026-06-01', historyPatch: snapshot,
            appendSnapshot: snapshot, employeePatch: {} } });
    assert.equal(first.state, STATES.APPEND_NEW_VERSION);
    const second = resolve({ intentHint: INTENTS.APPEND_NEW_VERSION, historyId: null,
        historyRows: [row('history-1', '2026-05-01', {
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-05-31' }), snapshot], submittedState: {
            effectiveFrom: '2026-06-01', historyPatch: snapshot,
            appendSnapshot: { ...snapshot, hmeromhnia_proslhpshs: new Date('2026-05-01T00:00:00.000Z') },
            employeePatch: {} }, currentEmployee: { ...snapshot, _id: 'employee' } });
    assert.equal(second.state, STATES.NO_HISTORY_CHANGE);
    assert.equal(second.targetHistoryId, 'new');
    assert.equal(second.idempotent, true);
});

test('partial append subset is not sufficient evidence for an idempotent replay', () => {
    const existing = { ...row('new', '2026-06-01'), nomimosMisthos: 1200,
        hmeres_ergasias_ebdomadas: 5 };
    const plan = resolve({ intentHint: INTENTS.APPEND_NEW_VERSION, historyId: null,
        historyRows: [row('history-1', '2026-05-01', {
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-05-31' }), existing], submittedState: {
            effectiveFrom: '2026-06-01', historyPatch: { nomimosMisthos: 1200 },
            appendSnapshot: { ...existing, nomimosMisthos: 1300 }, employeePatch: {} },
        currentEmployee: { ...existing, _id: 'employee' } });
    assert.equal(plan.state, STATES.CONFLICT);
    assert.equal(plan.responseCode, 'NEW_VERSION_NOT_FUTURE');
});

test('canonical append replay accepts normalized equivalent date representations', () => {
    const existing = { ...row('new', '2026-06-01'), nomimosMisthos: 1200 };
    const snapshot = { ...existing, hmeromhnia_proslhpshs: new Date('2026-05-01T00:00:00.000Z'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-06-01T00:00:00.000Z') };
    const plan = resolve({ intentHint: INTENTS.APPEND_NEW_VERSION, historyId: null,
        historyRows: [row('history-1', '2026-05-01', {
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-05-31' }), existing], submittedState: {
            effectiveFrom: '2026-06-01', historyPatch: snapshot,
            appendSnapshot: snapshot, employeePatch: {} },
        currentEmployee: { ...existing, _id: 'employee' } });
    assert.equal(plan.state, STATES.NO_HISTORY_CHANGE);
    assert.equal(plan.idempotent, true);
});

test('non-future explicit version is rejected', () => {
    const plan = resolve({ intentHint: INTENTS.APPEND_NEW_VERSION, historyId: null,
        submittedState: { effectiveFrom: '2026-04-30', historyPatch: {}, employeePatch: {} } });
    assert.equal(plan.responseCode, 'NEW_VERSION_NOT_FUTURE');
});

test('stale expected revision is rejected', () => {
    const historyRows = [row('history-1', '2026-05-01', { updatedAt: '2026-09-01T10:00:00.000Z' })];
    const plan = resolve({ historyRows, expectedRevision: '2026-09-01T09:00:00.000Z' });
    assert.equal(plan.responseCode, 'CONFLICT_STALE');
});

test('hire-date change is never inferred as rehire', () => {
    const plan = resolve({ submittedState: { employeePatch: {},
        historyPatch: { hmeromhnia_proslhpshs: '2026-05-02' } } });
    assert.equal(plan.responseCode, 'HIRE_DATE_REQUIRES_CONTROLLED_LIFECYCLE');
});

test('each lifecycle/history date changes only its submitted field', () => {
    const cases = [
        ['hmeromhnia_allaghs_symbashs', '2026-05-02'],
        ['hmeromhnia_allaghs_orarioy_apo', '2026-05-02'],
        ['hmeromhnia_allaghs_orarioy_eos', '2026-05-08'],
        ['hmeromhnia_isxyos_oron_ergasias_apo', '2026-05-02'],
        ['hmeromhnia_isxyos_oron_ergasias_eos', '2026-12-31'],
        ['hmeromhnia_lhxhs_symbashs', '2026-10-31'],
        ['hmeromhnia_apoxorhshs', '2026-11-30']
    ];
    for (const [field, value] of cases) {
        const result = resolve({ submittedState: { effectiveFrom: '2026-05-01',
            employeePatch: {}, historyPatch: { [field]: value } } });
        assert.notEqual(result.state, STATES.CONFLICT, field);
        assert.deepEqual(Object.keys(result.historyPatch), [field], field);
    }
});

test('lifecycle intents are classified explicitly', () => {
    for (const [intent, state] of [[INTENTS.DEPARTURE, STATES.DEPARTURE],
        [INTENTS.CANCEL_DEPARTURE, STATES.CANCEL_DEPARTURE],
        [INTENTS.REHIRE, STATES.REHIRE]]) {
        assert.equal(resolve({ intentHint: intent }).state, state);
    }
});

test('scope mismatch cannot target another team or company', () => {
    for (const changedScope of [
        { ...scope, team: 'OTHER' },
        { ...scope, company_kod: 'OTHER' }
    ]) {
        const plan = resolve({ historyRows: [{ ...row('history-1'), ...changedScope }] });
        assert.equal(plan.responseCode, 'CONFLICT_SCOPE');
    }
});

test('missing history id collapses exact same-period duplicates deterministically', () => {
    const historyRows = [row('first'), row('second')];
    const plan = resolve({ historyRows, historyId: null,
        currentEmployee: { ...row('employee'), _id: 'employee',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-12-31' } });
    assert.equal(plan.state, STATES.NO_HISTORY_CHANGE);
    assert.equal(plan.cleanupRequired, true);
    assert.equal(plan.rowsToDelete.length, 1);
});

test('missing history id infers the only safe current-cycle candidate', () => {
    const plan = resolve({ historyId: null, submittedState: { effectiveFrom: '2026-05-01',
        employeePatch: { hmeromhnia_lhxhs_symbashs: '2026-10-31' },
        historyPatch: { hmeromhnia_lhxhs_symbashs: '2026-10-31' } } });
    assert.equal(plan.state, STATES.CORRECT_EXISTING);
    assert.equal(plan.targetHistoryId, 'history-1');
});

test('unknown stable history id fails closed instead of selecting by date', () => {
    const plan = resolve({ historyId: 'not-in-scope' });
    assert.equal(plan.state, STATES.CONFLICT);
    assert.equal(plan.responseCode, 'CONFLICT_AMBIGUOUS_TARGET');
});

test('older boundary move keeps its id and does not rewrite the newer neighbor', () => {
    const older = row('older', '2026-05-01', { hmeromhnia_isxyos_oron_ergasias_eos: '2026-05-31' });
    const newer = row('newer', '2026-06-01');
    const plan = resolve({ historyRows: [older, newer], historyId: 'older',
        currentEmployee: { ...newer, _id: 'employee' }, submittedState: {
        effectiveFrom: '2026-05-01', employeePatch: {},
        historyPatch: { hmeromhnia_isxyos_oron_ergasias_eos: '2026-05-30' }
    } });
    assert.equal(plan.state, STATES.MOVE_EXISTING_BOUNDARY);
    assert.equal(plan.targetHistoryId, 'older');
    assert.deepEqual(plan.neighborPatches, []);
});
