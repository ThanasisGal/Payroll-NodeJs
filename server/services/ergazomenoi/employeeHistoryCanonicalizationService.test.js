'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EVENT_TYPES, ROW_DISPOSITIONS, CANONICAL_STATUSES,
    REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD,
    canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { REAL_0002_IDS, buildReal0002SanitizedHistoryFixture } =
    require('./fixtures/real0002SanitizedHistoryFixture');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');

function normalized(result) {
    return result.canonicalRows.map(row => ({ ...row,
        _id: String(row._id) }));
}

test('legacy copied profile fields on departure do not create another profile period', () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const result = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.history });
    assert.equal(result.status, CANONICAL_STATUSES.AUTO_REPAIRABLE);
    assert.deepEqual(result.canonicalRows.map(row => String(row._id)), [
        REAL_0002_IDS.OLD_PROFILE, REAL_0002_IDS.DEPARTURE, REAL_0002_IDS.CURRENT_PROFILE
    ]);
    assert.deepEqual(result.events.filter(event => event.historyId === REAL_0002_IDS.DEPARTURE)
        .map(event => event.eventType), [EVENT_TYPES.DEPARTURE]);
    assert.deepEqual(result.events.filter(event => event.eventType === EVENT_TYPES.PROFILE_CHANGE)
        .map(event => event.historyId), [REAL_0002_IDS.OLD_PROFILE, REAL_0002_IDS.CURRENT_PROFILE]);
    const oldProfile = result.canonicalRows.find(row => String(row._id) === REAL_0002_IDS.OLD_PROFILE);
    assert.equal(new Date(oldProfile.hmeromhnia_isxyos_oron_ergasias_eos)
        .toISOString().slice(0, 10), '2026-07-31');
    assert.equal(result.rowsToDelete.length, 0);
});

test('canonicalization is idempotent and keeps every survivor id stable', () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const first = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.history });
    const second = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: normalized(first) });
    assert.equal(second.status, CANONICAL_STATUSES.CLEAN);
    assert.deepEqual(normalized(second), normalized(first));
    assert.deepEqual(second.classifications.map(item => item.disposition),
        second.classifications.map(() => ROW_DISPOSITIONS.KEEP));
});

test('durably marked referenced duplicate is physically retained but semantically inert', () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const redundant = { ...fixture.history[2], _id: '000000000000000000000024',
        aa_eggrafhs: '0004', [REDUNDANT_STATUS_FIELD]: 'REDUNDANT_REFERENCED',
        [REDUNDANT_SURVIVOR_FIELD]: REAL_0002_IDS.CURRENT_PROFILE };
    const result = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: [...fixture.history, redundant] });
    assert.ok(!result.canonicalRows.some(row => String(row._id) === String(redundant._id)));
    const classification = result.classifications.find(item => item.historyId === String(redundant._id));
    assert.equal(classification.disposition, ROW_DISPOSITIONS.REDUNDANT);
    assert.equal(classification.referenced, true);
    assert.equal(result.rowsToDelete.some(item => item.historyId === String(redundant._id)), false);
    const poisoned = { ...redundant, ores_ergasias_ebdomadas: 1,
        hmeres_ergasias_ebdomadas: 1, mo_oron_hmerhsias_ergasias: 1 };
    const terms = getOrarioTermsForDate('2026-09-20', [...fixture.history, poisoned],
        fixture.currentEmployee);
    assert.equal(terms.ores_ergasias_ebdomadas, 40);
    assert.notEqual(String(terms.istorikoId), String(poisoned._id));
});

test('normal model reads exclude referenced artifacts while canonical reads can request all rows', async () => {
    const runPreFind = query =>
        IstorikoProslhpseonAllagonModel.schema.s.hooks.execPre('find', query, []);
    const normal = IstorikoProslhpseonAllagonModel.find({ team: 'TEST' });
    await runPreFind(normal);
    assert.deepEqual(normal.getFilter().employment_history_canonical_status,
        { $ne: 'REDUNDANT_REFERENCED' });
    const complete = IstorikoProslhpseonAllagonModel.find({ team: 'TEST' });
    complete.mongooseOptions({ includeRedundantHistoryArtifacts: true });
    await runPreFind(complete);
    assert.equal(complete.getFilter().employment_history_canonical_status, undefined);
});

test('generated valid mutation sequences remain canonical, stable and idempotent', () => {
    let seed = 0x2510069;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
    for (let run = 0; run < 250; run += 1) {
        const scope = { team: 'TEST', company_kod: `C${run}`, kodikos: `E${run}` };
        const hire = new Date(Date.UTC(2020 + (run % 5), 0, 1));
        const rows = [];
        const count = 1 + Math.floor(random() * 12);
        let from = new Date(hire);
        for (let index = 0; index < count; index += 1) {
            const next = index === count - 1 ? null : new Date(from.getTime() +
                (7 + Math.floor(random() * 60)) * 86400000);
            rows.push({ _id: `${run}-${index}`, ...scope,
                aa_eggrafhs: String(index + 1).padStart(4, '0'),
                hmeromhnia_proslhpshs: hire,
                hmeromhnia_isxyos_oron_ergasias_apo: new Date(from),
                hmeromhnia_isxyos_oron_ergasias_eos: next
                    ? new Date(next.getTime() - 86400000) : null,
                afora_allagh_oron_ergasias: true,
                hmeres_ergasias_ebdomadas: 5,
                ores_ergasias_ebdomadas: 20 + index,
                mo_oron_hmerhsias_ergasias: (20 + index) / 5 });
            if (next) from = next;
        }
        const currentEmployee = { ...rows.at(-1), _id: `employee-${run}` };
        const first = canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows: rows });
        assert.notEqual(first.status, CANONICAL_STATUSES.TRUE_AMBIGUITY);
        const second = canonicalizeEmployeeHistory({ scope, currentEmployee,
            historyRows: normalized(first) });
        assert.equal(second.status, CANONICAL_STATUSES.CLEAN);
        assert.deepEqual(normalized(second), normalized(first));
        assert.deepEqual(second.canonicalRows.map(row => String(row._id)),
            rows.map(row => String(row._id)));
    }
});

test('generated hire, profile, departure and rehire sequences never become ambiguous', () => {
    const iso = date => date.toISOString().slice(0, 10);
    for (let run = 0; run < 120; run += 1) {
        const scope = { team: 'GENERATED', company_kod: `CYCLE-${run}`,
            kodikos: String(run).padStart(4, '0') };
        const rows = [];
        const cycleCount = 1 + run % 4;
        let sequence = 0;
        let currentEmployee;
        for (let cycle = 0; cycle < cycleCount; cycle += 1) {
            const hire = new Date(Date.UTC(2018 + cycle * 2, run % 12, 1));
            const secondStart = new Date(hire.getTime() + 60 * 86400000);
            const departure = new Date(hire.getTime() + 180 * 86400000);
            const isCurrent = cycle === cycleCount - 1;
            const base = { ...scope, hmeromhnia_proslhpshs: iso(hire),
                afora_allagh_oron_ergasias: true,
                hmeres_ergasias_ebdomadas: 5,
                ores_ergasias_ebdomadas: 35 + cycle,
                mo_oron_hmerhsias_ergasias: (35 + cycle) / 5,
                hmeromhnia_lhxhs_symbashs: iso(new Date(hire.getTime() + 300 * 86400000)) };
            rows.push({ _id: `${run}-${cycle}-hire`, ...scope,
                aa_eggrafhs: String(++sequence).padStart(4, '0'),
                hmeromhnia_proslhpshs: iso(hire), afora_proslhpsh: true,
                afora_allagh_oron_ergasias: false });
            rows.push({ _id: `${run}-${cycle}-p1`, ...base,
                aa_eggrafhs: String(++sequence).padStart(4, '0'),
                hmeromhnia_isxyos_oron_ergasias_apo: iso(hire),
                hmeromhnia_isxyos_oron_ergasias_eos:
                    iso(new Date(secondStart.getTime() - 86400000)) });
            const latest = { _id: `${run}-${cycle}-p2`, ...base,
                aa_eggrafhs: String(++sequence).padStart(4, '0'),
                hmeromhnia_isxyos_oron_ergasias_apo: iso(secondStart),
                hmeromhnia_isxyos_oron_ergasias_eos: isCurrent ? null : iso(departure),
                ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
            rows.push(latest);
            if (!isCurrent) rows.push({ ...latest, _id: `${run}-${cycle}-departure`,
                aa_eggrafhs: String(++sequence).padStart(4, '0'),
                hmeromhnia_apoxorhshs: iso(departure) });
            else currentEmployee = { ...latest, _id: `employee-${run}` };
        }
        const first = canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows: rows });
        assert.notEqual(first.status, CANONICAL_STATUSES.TRUE_AMBIGUITY,
            `${run}:${first.diagnostics?.reason}`);
        const second = canonicalizeEmployeeHistory({ scope, currentEmployee,
            historyRows: normalized(first) });
        assert.equal(second.status, CANONICAL_STATUSES.CLEAN, `${run}`);
        assert.deepEqual(normalized(second), normalized(first), `${run}`);
        assert.deepEqual(first.canonicalRows.map(row => String(row._id)),
            rows.map(row => String(row._id)), `${run}`);
    }
});

test('materially conflicting same-start profiles remain true ambiguity', () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const first = { ...fixture.history[2], _id: 'conflict-a',
        employment_profile_source: '', employment_profile_schema_version: undefined,
        ores_ergasias_ebdomadas: 30 };
    const second = { ...first, _id: 'conflict-b', aa_eggrafhs: '0004',
        ores_ergasias_ebdomadas: 40 };
    const currentEmployee = { ...first, _id: 'employee', ores_ergasias_ebdomadas: 35 };
    const result = canonicalizeEmployeeHistory({ scope: fixture.scope, currentEmployee,
        historyRows: [first, second] });
    assert.equal(result.status, CANONICAL_STATUSES.TRUE_AMBIGUITY);
    assert.equal(result.diagnostics.reason, 'CONFLICTING_PROFILE_EVENTS');
});

test('mutable contract end never creates a second period identity', () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const current = fixture.currentEmployee;
    const older = { ...fixture.history[2], _id: 'contract-end-older',
        aa_eggrafhs: '0001', hmeromhnia_lhxhs_symbashs: '2027-06-30',
        employment_profile_source: undefined };
    const newer = { ...older, _id: 'contract-end-newer', aa_eggrafhs: '0002',
        hmeromhnia_lhxhs_symbashs: '2027-07-30' };
    const result = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: current, historyRows: [older, newer] });
    assert.equal(result.status, CANONICAL_STATUSES.AUTO_REPAIRABLE);
    assert.equal(result.canonicalRows.length, 1);
    assert.equal(String(result.canonicalRows[0]._id), 'contract-end-newer');
    assert.equal(result.canonicalRows[0].hmeromhnia_lhxhs_symbashs, '2027-07-30');
});
