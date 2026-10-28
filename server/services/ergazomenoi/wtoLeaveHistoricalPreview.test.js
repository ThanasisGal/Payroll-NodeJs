'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { resolveWtoLeaveEmploymentTerms: resolve } = require('./wtoLeaveEmploymentTermsService');
const { buildWtoLeaveCanonicalDataset: build } = require('./wtoLeaveSubmissionService');
const { loadWtoLeaveDataset } = require('./wtoLeaveDatasetService');
const { createWtoLeaveController } = require('../../controllers/ergazomenoi/wtoLeaveController').__testHooks;
const C = require('../../utils/ergazomenoi/employmentProfileContract');

const companyA = '507f1f77bcf86cd799439011';
const companyB = '507f1f77bcf86cd799439012';
const employee = (extra = {}) => ({ team: 'SYNTHETIC', company_kod: companyA,
    ypokatasthma: '0000', kodikos: '0002', afm: '123456789',
    eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΑΝΝΑ', hmeromhnia_proslhpshs: '2024-01-01',
    hmeromhnia_isxyos_oron_ergasias_apo: '2024-01-01',
    hmeres_ergasias_ebdomadas: 5, kathestos_apasxolhshs: '0',
    proyphresia_adeias_se_eth: 0, ...extra });
const history = (extra = {}) => ({ ...employee(), _id: 'synthetic-history',
    afora_allagh_oron_ergasias: true, ...extra });
const leave = (date = '2026-09-16', extra = {}) => ({ team: 'SYNTHETIC',
    company_kod: companyA, ypokatasthma: '0000', kodikos: '0002',
    _id: `synthetic-${date}`, hmeromhnia: new Date(`${date}T00:00:00Z`),
    adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ', ...extra });

test('five/six days and documented legacy week labels; unsupported or conflicting values stay blocked', () => {
    for (const days of [5, 6]) {
        const result = build({ employees: [employee()], sourceRows: [leave()],
            historyRows: [history({ hmeres_ergasias_ebdomadas: days })] });
        assert.equal(result.blockers.length, 0);
        assert.equal(result.rows[0].entitlement_debug.weeklyDays, days);
        assert.equal(result.rows[0].required_days, days === 5 ? '022' : '026');
    }
    for (const label of ['5HMERH', '6ΗΜΕΡΟ']) {
        assert.equal(resolve(employee(), '2026-09-16', [history({
            hmeres_ergasias_ebdomadas: 0, typos_ebdomadas: label })]).weeklyDays,
        label.startsWith('5') ? 5 : 6);
    }
    for (const value of [undefined, null, '', 0, 3, 7, 'invalid', false, true]) {
        assert.throws(() => resolve(employee(), '2026-09-16', [history({
            hmeres_ergasias_ebdomadas: value })]), { code: 'WTOLEAVE_INVALID_WEEKLY_DAYS' });
    }
    assert.equal(resolve(employee(), '2026-09-16', [history({
        hmeres_ergasias_ebdomadas: 3, typos_ebdomadas: '5HMERH' })]).weeklyDays, 5);
    assert.throws(() => resolve(employee(), '2026-09-16', [history({
        typos_ebdomadas: '6HMERH' })]), { code: 'WTOLEAVE_INVALID_WEEKLY_DAYS' });
});

const completeProfile = extra => ({ ...C.readEmploymentProfile().facts,
    employment_profile_schema_version: 1, ...extra });

test('every hire weekday keeps its documented contract, including one actual first-week day', () => {
    for (const [date, scheduled] of [['2026-09-14', 5], ['2026-09-15', 4],
        ['2026-09-16', 3], ['2026-09-17', 2], ['2026-09-18', 1],
        ['2026-09-19', 1], ['2026-09-20', 1]]) {
        const terms = { hmeromhnia_proslhpshs: date,
            hmeromhnia_isxyos_oron_ergasias_apo: date,
            hmeres_ergasias_ebdomadas: scheduled, kathestos_apasxolhshs: '1' };
        const current = employee(completeProfile({ ...terms, apasxolhsh_basei_symbashs: '5' }));
        const snapshot = history(completeProfile({ ...terms, typos_ebdomadas: '' }));
        const before = JSON.stringify({ current, snapshot });
        const result = build({ employees: [current], historyRows: [snapshot],
            sourceRows: [leave(date)], actualWorkRows: [leave(date, {
                adeia_apologistika: false, kathgoria_adeias_apologistika: '',
                kathgoria_ergasias_apologistika: 'ΕΡΓ', cards_ores_ergasias: 5,
                cards_apo_ora_01: '16:00', cards_eos_ora_01: '21:00',
                ores_ergasias: 5, ores_ergasias_apologistika: 5 })] });
        assert.equal(result.blockers.length, 0, date);
        assert.equal(result.rows[0].entitlement_debug.weeklyDays, 5, date);
        assert.equal(result.rows[0].entitlement_debug.employmentType, '1');
        assert.equal(result.rows[0].entitlement_debug.segments[0].from, date);
        assert.equal(JSON.stringify({ current, snapshot }), before);
        const previous = new Date(`${date}T00:00:00Z`);
        previous.setUTCDate(previous.getUTCDate() - 1);
        const invalid = build({ employees: [current], historyRows: [snapshot],
            sourceRows: [leave(previous.toISOString().slice(0, 10))] });
        assert.equal(invalid.rows.length, 0);
        assert.equal(invalid.blockers[0].code, 'WTOLEAVE_EMPLOYMENT_CYCLE_UNKNOWN');
    }
});

test('partial first/last weeks retain six-day agreements and historical five/six changes', () => {
    const current = employee({ hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-16',
        hmeromhnia_apoxorhshs: '2026-09-18', hmeres_ergasias_ebdomadas: 3 });
    const old = history({ ...current, typos_ebdomadas: '6HMERH',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-16' });
    const changed = history({ ...current, _id: 'changed-five',
        typos_ebdomadas: '5HMERH', hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-17' });
    const result = build({ employees: [current], historyRows: [old, changed],
        sourceRows: [leave('2026-09-16'), leave('2026-09-17'), leave('2026-09-18')] });
    assert.equal(result.blockers.length, 0);
    assert.deepEqual(result.rows.map(row => row.entitlement_debug.weeklyDays), [6, 5, 5]);
    assert.deepEqual(result.rows.map(row => row.entitlement_debug.annualBasisDays), [24, 20, 20]);
    assert.ok(result.rows.every(row => row.entitlement_debug.segments[0].from === '2026-09-16'));
});

test('rehire uses only its dated profile; the employment gap needs no terms or leave coverage', () => {
    const old = history({ hmeromhnia_proslhpshs: '2026-09-01',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-01',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-09',
        hmeromhnia_apoxorhshs: '2026-09-09', hmeres_ergasias_ebdomadas: 3,
        typos_ebdomadas: '6HMERH' });
    const current = employee(completeProfile({ hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-16',
        hmeres_ergasias_ebdomadas: 3, apasxolhsh_basei_symbashs: '5' }));
    const snapshot = history(completeProfile({ ...current,
        _id: 'rehire', apasxolhsh_basei_symbashs: undefined, typos_ebdomadas: '' }));
    assert.equal(resolve(current, '2026-09-09', [old, snapshot]).weeklyDays, 6);
    assert.throws(() => resolve(current, '2026-09-10', [old, snapshot]),
        { code: 'WTOLEAVE_EMPLOYMENT_CYCLE_UNKNOWN' });
    assert.equal(resolve(current, '2026-09-16', [old, snapshot]).weeklyDays, 5);
    assert.equal(resolve(current, '2026-09-16', [old, snapshot]).hireDate, '2026-09-16');
    assert.throws(() => resolve(current, '2026-09-09', [{ ...old, typos_ebdomadas: '' }, snapshot]),
        { code: 'WTOLEAVE_INVALID_WEEKLY_DAYS' });
});

test('unknown, invalid, conflicting and later current agreements remain blocked', () => {
    const current = employee(completeProfile({ hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-16',
        hmeres_ergasias_ebdomadas: 3, apasxolhsh_basei_symbashs: '5' }));
    const snapshot = history(completeProfile({ ...current,
        apasxolhsh_basei_symbashs: undefined, typos_ebdomadas: '' }));
    for (const changedCurrent of [
        { apasxolhsh_basei_symbashs: undefined },
        { hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-17' },
        { hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-15' },
        { kathestos_apasxolhshs: '2' }, { hmeres_ergasias_ebdomadas: 4 }
    ]) assert.throws(() => resolve({ ...current, ...changedCurrent }, '2026-09-16', [snapshot]),
        { code: 'WTOLEAVE_INVALID_WEEKLY_DAYS' });
    for (const changedSnapshot of [
        { typos_ebdomadas: '6HMERH' }, { hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '5HMERH' },
        { typos_ebdomadas: 'unknown' }, { hmeres_ergasias_ebdomadas: 7 },
        { apasxolhsh_basei_symbashs: '3' }
    ]) assert.throws(() => resolve(current, '2026-09-16', [{ ...snapshot, ...changedSnapshot }]),
        { code: 'WTOLEAVE_INVALID_WEEKLY_DAYS' });
});

test('documented rotational work preserves actual-day calculation and excludes pre-hire work', () => {
    const current = employee({ hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-16',
        hmeres_ergasias_ebdomadas: 2, kathestos_apasxolhshs: '2', typos_ebdomadas: '5HMERH' });
    const actualWorkRows = ['2026-09-15', '2026-09-16', '2026-09-18'].map(date => leave(date, {
        adeia_apologistika: false, kathgoria_adeias_apologistika: '',
        kathgoria_ergasias_apologistika: 'ΕΡΓ', cards_ores_ergasias: 5,
        cards_apo_ora_01: '16:00', cards_eos_ora_01: '21:00',
        ores_ergasias: 5, ores_ergasias_apologistika: 5 }));
    const result = build({ employees: [current], sourceRows: [leave('2026-09-18')], actualWorkRows });
    assert.equal(result.blockers.length, 0);
    const debug = result.rows[0].entitlement_debug;
    assert.equal(debug.employmentType, '2');
    assert.equal(debug.calculationMode, 'ROTATIONAL_INTERMITTENT_ACTUAL_DAYS');
    assert.deepEqual(debug.segments[0].actual_work_dates, ['2026-09-16', '2026-09-18']);
    assert.equal(debug.entitledDaysRaw, 2 / 25 * 20 / 12);
    assert.throws(() => resolve({ ...current, typos_ebdomadas: '' }, '2026-09-18'),
        { code: 'WTOLEAVE_INVALID_WEEKLY_DAYS' });
});

test('historical change overrides current zero; gaps, overlaps and undated current facts fail closed', () => {
    const rows = [history({ _id: 'old-six', hmeres_ergasias_ebdomadas: 6,
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-14' }),
    history({ _id: 'new-five', hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' })];
    const current = employee({ hmeres_ergasias_ebdomadas: 0 });
    assert.equal(resolve(current, '2026-09-14', rows).weeklyDays, 6);
    assert.equal(resolve(current, '2026-09-16', rows).weeklyDays, 5);
    assert.throws(() => resolve(employee({ hmeromhnia_isxyos_oron_ergasias_apo: null }),
        '2026-09-16'), { code: 'WTOLEAVE_HISTORICAL_WORK_TERMS_UNKNOWN' });
    assert.throws(() => resolve(current, '2026-09-16', [history(), history({ _id: 'overlap' })]),
        { code: 'WTOLEAVE_AMBIGUOUS_WORK_TERMS' });
    assert.throws(() => resolve(employee(), '2026-09-16', [history({
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-14' })]),
    { code: 'WTOLEAVE_HISTORICAL_WORK_TERMS_UNKNOWN' });
    const v1 = { ...C.readEmploymentProfile().facts, employment_profile_schema_version: 1 };
    assert.throws(() => resolve(employee({ ...v1,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-10-01' }), '2026-09-16', [history({
        ...v1, hmeromhnia_isxyos_oron_ergasias_apo: '2026-10-01' })]),
    { code: 'WTOLEAVE_HISTORICAL_WORK_TERMS_UNKNOWN' });
});

test('new hire, departure and rehire keep reference dates and employment cycles distinct', () => {
    const newHire = employee({ hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-16' });
    assert.equal(resolve(newHire, '2026-09-16').hireDate, '2026-09-16');
    assert.throws(() => resolve(newHire, '2026-09-15'),
        { code: 'WTOLEAVE_EMPLOYMENT_CYCLE_UNKNOWN' });
    const old = history({ hmeromhnia_apoxorhshs: '2026-08-31',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-08-31', hmeres_ergasias_ebdomadas: 6 });
    const rehired = employee({ hmeromhnia_proslhpshs: '2026-09-15',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' });
    assert.equal(resolve(rehired, '2026-08-20', [old]).hireDate, '2024-01-01');
    assert.equal(resolve(rehired, '2026-08-20', [old]).weeklyDays, 6);
    assert.equal(resolve(rehired, '2026-09-16', [old]).hireDate, '2026-09-15');
    assert.throws(() => resolve(rehired, '2026-09-10', [old]),
        { code: 'WTOLEAVE_EMPLOYMENT_CYCLE_UNKNOWN' });
    const departed = employee({ hmeromhnia_apoxorhshs: '2026-09-01' });
    const result = build({ employees: [departed], sourceRows: [leave()] });
    assert.equal(result.rows[0].date, '2026-09-16');
    assert.equal(result.rows[0].entitlement_debug.segments[0].to, '2026-09-16');
});

test('historical service credit is never borrowed from today; documented current credit is preserved', () => {
    const current = employee({ proyphresia_adeias_se_eth: 12 });
    assert.equal(build({ employees: [current], sourceRows: [leave()] }).rows[0].required_days, '025');
    const old = history();
    delete old.proyphresia_adeias_se_eth;
    assert.throws(() => resolve(current, '2026-09-16', [old]),
        { code: 'WTOLEAVE_HISTORICAL_PREVIOUS_SERVICE_UNKNOWN' });
    assert.equal(resolve(current, '2026-09-16', [history({ proyphresia_adeias_se_eth: 0 })])
        .previousLeaveServiceYears, 0);
});

function matches(row, query) {
    return Object.entries(query).every(([key, value]) => {
        if (key === '$or') return value.some(item => matches(row, item));
        if (value && typeof value === 'object') {
            if ('$in' in value) return value.$in.includes(row[key]);
            if ('$ne' in value) return row[key] !== value.$ne;
            if ('$gte' in value) return new Date(row[key]) >= value.$gte && new Date(row[key]) <= value.$lte;
        }
        return row[key] === value;
    });
}
function modelsFor({ employees, histories = [], schedules = [] }) {
    const queries = [];
    const model = (name, data) => ({ find(query) {
        queries.push({ name, query });
        const result = data.filter(row => matches(row, query));
        return { sort: () => ({ lean: async () => result }), select(fields) {
            return { lean: async () => result.map(row => Object.fromEntries(fields.split(/\s+/)
                .filter(field => field in row).map(field => [field, row[field]]))) };
        } };
    } });
    return { queries, models: {
        YpokatasthmataModel: { findOne(query) { queries.push({ name: 'branch', query });
            return { lean: async () => ({ kodikos: '0000' }) }; } },
        ErgazomenoiModel: model('employee', employees),
        IstorikoProslhpseonAllagonModel: model('history', histories),
        ProdhlomenaOrariaModel: model('schedule', schedules)
    } };
}
const input = { ypokatasthma: '0000', from_date: '2026-09-01', to_date: '2026-09-30' };
const scope = companyId => ({ effectiveTeam: 'SYNTHETIC', companyId });

test('partial-week dataset projections retain dated contract evidence and company/branch isolation', async () => {
    const current = employee(completeProfile({ hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-16',
        hmeres_ergasias_ebdomadas: 3, apasxolhsh_basei_symbashs: '5' }));
    const other = { ...current, company_kod: companyB, apasxolhsh_basei_symbashs: '6' };
    const data = { employees: [current, other],
        histories: [current, other].map(row => history({ ...row,
            apasxolhsh_basei_symbashs: undefined, typos_ebdomadas: '' })),
        schedules: [leave(), leave('2026-09-18'),
            leave('2026-09-17', { ypokatasthma: '0001' }), leave('2026-09-16', { company_kod: companyB })] };
    const before = JSON.stringify(data);
    const { models, queries } = modelsFor(data);
    const result = await loadWtoLeaveDataset({ scope: scope(companyA), input, models });
    assert.equal(result.response.blockers.length, 0);
    assert.deepEqual(result.response.rows.map(row => row.date), ['2026-09-16', '2026-09-18']);
    assert.ok(result.response.rows.every(row => row.entitlement_debug.weeklyDays === 5));
    assert.equal(result.response.submission_eligible, true);
    assert.equal(result.parity.exact, true);
    assert.equal(queries.find(item => item.name === 'history').query.company_kod, companyA);
    assert.equal(queries.find(item => item.name === 'schedule').query.ypokatasthma, '0000');
    assert.equal(JSON.stringify(data), before);
    assert.equal(mongoose.connection.readyState, 0);
});

test('same employee codes across companies: actual scoped projections, partial and empty previews; no mutations', async () => {
    const data = { employees: [employee({ hmeres_ergasias_ebdomadas: 0 }),
        employee({ kodikos: '0001', afm: '987654321' }), employee({ company_kod: companyB })],
    histories: [history({ hmeres_ergasias_ebdomadas: 0 }), history({ company_kod: companyB,
        hmeres_ergasias_ebdomadas: 6 })],
    schedules: [leave(), leave('2026-09-17', { kodikos: '0001' }), leave('2026-09-16', { company_kod: companyB })] };
    const before = JSON.stringify(data);
    const { models, queries } = modelsFor(data);
    const partial = await loadWtoLeaveDataset({ scope: scope(companyA), input, models });
    assert.equal(partial.response.rows.length, 1);
    assert.equal(partial.response.rows[0].employee_code, '0001');
    assert.equal(partial.response.blockers[0].employee_code, '0002');
    assert.equal(partial.response.blockers[0].date, '2026-09-16');
    assert.equal(partial.response.blockers[0].code, 'WTOLEAVE_INVALID_WEEKLY_DAYS');
    assert.equal(partial.response.submission_eligible, false);
    assert.equal(partial.payload, null);
    const other = await loadWtoLeaveDataset({ scope: scope(companyB), input, models });
    assert.equal(other.response.rows.length, 1);
    assert.equal(other.response.rows[0].entitlement_debug.weeklyDays, 6);
    assert.equal(other.response.submission_eligible, true);
    assert.equal(other.parity.exact, true);
    const validModels = modelsFor({ ...data, histories: data.histories.map(row => ({
        ...row, hmeres_ergasias_ebdomadas: 5 })) }).models;
    const allValid = await loadWtoLeaveDataset({ scope: scope(companyA), input, models: validModels });
    assert.equal(allValid.response.employee_count, 2);
    assert.equal(allValid.response.employee_day_count, 2);
    assert.equal(allValid.response.submission_eligible, true);
    assert.equal(allValid.parity.canonical_facts.length, 2);
    assert.deepEqual(allValid.parity.canonical_facts, allValid.parity.payload_facts);
    for (const { name, query } of queries) {
        assert.equal(query.team, 'SYNTHETIC');
        assert.ok([companyA, companyB].includes(query[name === 'branch' ? 'companykod_object' : 'company_kod']));
        if (name !== 'history') assert.equal(query[name === 'branch' ? 'kodikos' : 'ypokatasthma'], '0000');
    }
    const empty = await loadWtoLeaveDataset({ scope: scope(companyA),
        input: { ...input, from_date: '2026-10-01', to_date: '2026-10-31' }, models });
    assert.equal(empty.response.rows.length, 0);
    assert.equal(empty.response.blockers.length, 0);
    assert.equal(empty.response.submission_eligible, false);
    assert.equal(JSON.stringify(data), before);
    assert.equal(mongoose.connection.readyState, 0);

    let uploads = 0, writes = 0;
    const controller = createWtoLeaveController({ loadWtoLeaveDataset: async () => partial,
        uploadJsonDocumentToErgani: async () => { uploads++; throw Error('forbidden'); },
        ErgazomenoiErganhModel: { create: async () => { writes++; throw Error('forbidden'); },
            findOne: () => { throw Error('must stop before submission lookups'); } } });
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; } };
    await controller.preview({ body: input, programmataAccessScope: scope(companyA) }, response);
    assert.equal(response.body.rows.length, 1);
    await controller.submit({ body: { ...input, request_id: 'synthetic-preview-blocked' },
        programmataAccessScope: scope(companyA) }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(uploads, 0);
    assert.equal(writes, 0);
});

test('historical rotational work loads actual days even when current type is full time; rehire excludes previous work', async () => {
    const rotationalHistory = history({ kathestos_apasxolhshs: '2',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-20' });
    const work = leave('2026-09-10', { adeia_apologistika: false,
        kathgoria_adeias_apologistika: '', apo_ora_01_apologistika: '08:00',
        eos_ora_01_apologistika: '16:00', kathgoria_ergasias_apologistika: 'ΕΡΓ',
        cards_ores_ergasias: 8, cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
        ores_ergasias: 8, ores_ergasias_apologistika: 8 });
    const { models, queries } = modelsFor({ employees: [employee()],
        histories: [rotationalHistory], schedules: [work, leave()] });
    const result = await loadWtoLeaveDataset({ scope: scope(companyA), input, models });
    assert.equal(result.response.blockers.length, 0);
    assert.equal(result.response.rows[0].entitlement_debug.employmentType, '2');
    assert.deepEqual(result.response.rows[0].entitlement_debug.segments[0].actual_work_dates, ['2026-09-10']);
    assert.equal(queries.filter(item => item.name === 'schedule').length, 2);
    const rehired = employee({ hmeromhnia_proslhpshs: '2026-09-15',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15', kathestos_apasxolhshs: '2' });
    const old = history({ hmeromhnia_apoxorhshs: '2026-08-31',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-08-31' });
    const built = build({ employees: [rehired], historyRows: [old], sourceRows: [leave()],
        actualWorkRows: [work] });
    assert.equal(built.blockers.length, 0);
    assert.equal(built.rows[0].entitlement_debug.entitledDaysRaw, 0);
});
