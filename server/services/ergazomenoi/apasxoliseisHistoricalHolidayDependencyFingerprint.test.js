'use strict';

const assert = require('assert');
const test = require('node:test');
const {
    calculateHolidayDependencies,
    isHistoricalDependencyCurrent
} = require('./apasxoliseisHistoricalPeriodReconstructionService');
const { getPeriodControl } = require('./apasxoliseisPeriodControlService');

const COMPANY_0004_ID = '000000000000000000000004';
const COMPANY_0008_ID = '000000000000000000000008';
const FEB_START = new Date('2026-02-01T00:00:00.000Z');
const FEB_END = new Date('2026-02-28T00:00:00.000Z');
const scope = Object.freeze({ team: 'THA', company_kod: COMPANY_0004_ID,
    ypokatasthma: '0000', period_start: FEB_START, period_end: FEB_END });

function clone(row) { return { ...row }; }
function query(rows) {
    return { select() { return this; }, sort() { return this; },
        session() { return this; }, async lean() { return rows.map(clone); } };
}
function queryOne(row) {
    return { select() { return this; }, session() { return this; },
        async lean() { return row ? clone(row) : null; } };
}
function fixtures({ borrowed = true, borrowingOperation = false,
    borrowingFallback = borrowingOperation,
    lendingOperation = true, borrowingExplicit = true,
    lendingExplicit = true, outsideOperation = false,
    holidayDates = ['2026-02-23'] } = {}) {
    const local = { _id: 'employee-0031', team: 'THA', company_kod: COMPANY_0004_ID,
        ypokatasthma: '0000', kodikos: '0031', hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, kathestos_apasxolhshs: '0',
        ...(borrowed ? { afora_daneismo_ergazomenoy: true,
            typos_ergodoth_daneismoy: false,
            hmnia_enarxhs_daneismoy: new Date('2026-02-18T00:00:00.000Z'),
            hmnia_lhxhs_daneismoy: new Date('2026-02-25T00:00:00.000Z'),
            afm_daneizomenoy_ergodoth: '094259216',
            kodikos_ergazomenoy_alloy_ergodoth: '0031' } : {}) };
    const borrowing = { ...local, _id: 'borrowing-employee-0031',
        company_kod: COMPANY_0008_ID, afora_daneismo_ergazomenoy: false };
    const companies = [
        { _id: COMPANY_0004_ID, team: 'THA', kod: '0004', afm: '0004',
            apasxolhsh_kata_tis_argies: false,
            leitoyrgia_stis_mh_ypoxreotikes_argies: lendingOperation },
        { _id: COMPANY_0008_ID, team: 'THA', kod: '0008', afm: '094259216',
            apasxolhsh_kata_tis_argies: false,
            leitoyrgia_stis_mh_ypoxreotikes_argies: borrowingFallback }
    ];
    const holiday = (company_kod, operation, explicit, date = '2026-02-23') => ({
        team: 'THA', company_kod, etos: '2026', hmeromhnia: new Date(`${date}T00:00:00.000Z`),
        ypoxreotikh_argia: false, perigrafh: 'ΚΑΘΑΡΑ ΔΕΥΤΕΡΑ',
        ...(explicit ? { leitoyrgia_etaireias: operation } : {})
    });
    const argies = holidayDates.flatMap(date => [
        holiday('0004', lendingOperation, lendingExplicit, date),
        holiday('0008', borrowingOperation, borrowingExplicit, date)
    ]).concat([
        holiday('0008', outsideOperation, true, '2026-03-02')
    ]);
    const between = (value, range) => !range ||
        ((!range.$gte || value >= range.$gte) && (!range.$lte || value <= range.$lte));
    return { local, models: {
        employeeModel: { find(filter) {
            return query(filter.company_kod?.$in ? [borrowing] : [local]);
        } },
        historyModel: { find() { return query([]); } },
        companiesModel: {
            find(filter) { return query(companies.filter(row => !filter.afm ||
                filter.afm.$in.includes(row.afm))); },
            findOne(filter) { return queryOne(companies.find(row =>
                (!filter._id || String(row._id) === String(filter._id)) &&
                (!filter.kod || row.kod === filter.kod))); }
        },
        argiesModel: { find(filter) { return query(argies.filter(row =>
            row.company_kod === filter.company_kod &&
            between(row.hmeromhnia, filter.hmeromhnia))); } }
    } };
}
async function fingerprint(options = {}, dates = ['2026-02-23']) {
    const { models } = fixtures(options);
    return calculateHolidayDependencies({ scope, start: FEB_START, end: FEB_END,
        rows: dates.map(date => ({ kodikos: '0031',
            hmeromhnia: new Date(`${date}T00:00:00.000Z`) })),
        models });
}

test('0031 legacy v1 becomes stale and period control enables historical reassessment', async () => {
    const holiday = await fingerprint();
    assert.strictEqual(holiday.legacy_compatible, false);
    const record = { ...scope, status: 'OPEN', version: 1,
        historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 1,
        historical_dependency_fingerprint: 'existing-v1' };
    const fingerprints = { dependency_fingerprint: 'existing-v1',
        legacy_dependency_fingerprint: 'existing-v1',
        holiday_dependency_fingerprint: holiday.fingerprint,
        legacy_holiday_semantics_compatible: holiday.legacy_compatible };
    assert.strictEqual(isHistoricalDependencyCurrent(record, fingerprints), false);
    const state = await getPeriodControl({ scope, now: new Date('2026-09-01T00:00:00.000Z'),
        periodControlModel: { findOne() { return { lean: async () => record }; } },
        historicalFingerprintResolver: async () => fingerprints });
    assert.strictEqual(state.effective_mode, 'HISTORICAL_RECONSTRUCTION_STALE');
    assert.strictEqual(state.can_historical_reassess, true);
});

test('legacy non-borrowed period with unchanged holiday semantics remains current', async () => {
    const holiday = await fingerprint({ borrowed: false, borrowingOperation: false,
        lendingOperation: true });
    assert.strictEqual(holiday.legacy_compatible, true);
    assert.strictEqual(isHistoricalDependencyCurrent({
        historical_dependency_fingerprint: 'existing-v1'
    }, { dependency_fingerprint: 'existing-v1', legacy_dependency_fingerprint: 'existing-v1',
        holiday_dependency_fingerprint: holiday.fingerprint,
        legacy_holiday_semantics_compatible: true }), true);
});

test('effective holiday operation change changes the stored holiday fingerprint', async () => {
    assert.notStrictEqual((await fingerprint({ borrowingOperation: true })).fingerprint,
        (await fingerprint({ borrowingOperation: false })).fingerprint);
});

test('unused company fallback does not change an explicit holiday fingerprint', async () => {
    assert.strictEqual((await fingerprint({ borrowingOperation: false,
        borrowingFallback: false, borrowingExplicit: true })).fingerprint,
    (await fingerprint({ borrowingOperation: false, borrowingFallback: true,
        borrowingExplicit: true })).fingerprint);
});

test('used company fallback changes the holiday fingerprint', async () => {
    assert.notStrictEqual((await fingerprint({ borrowingOperation: false, borrowingFallback: false,
        borrowingExplicit: false })).fingerprint,
    (await fingerprint({ borrowingOperation: false, borrowingFallback: true,
        borrowingExplicit: false })).fingerprint);
});

test('holiday outside the dependency window does not change the fingerprint', async () => {
    assert.strictEqual((await fingerprint({ outsideOperation: false })).fingerprint,
        (await fingerprint({ outsideOperation: true })).fingerprint);
});

test('holiday of a company that is never effective does not change the fingerprint', async () => {
    assert.strictEqual((await fingerprint({ lendingOperation: false })).fingerprint,
        (await fingerprint({ lendingOperation: true })).fingerprint);
});

test('source change inside the window fingerprints the effective company per date', async () => {
    const dates = ['2026-02-17', '2026-02-23'];
    const base = { holidayDates: dates, lendingOperation: true,
        borrowingOperation: false };
    const original = (await fingerprint(base, dates)).fingerprint;
    assert.notStrictEqual((await fingerprint({ ...base, lendingOperation: false }, dates)).fingerprint,
        original);
    assert.notStrictEqual((await fingerprint({ ...base, borrowingOperation: true }, dates)).fingerprint,
        original);
});
