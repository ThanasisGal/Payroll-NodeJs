'use strict';
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
mongoose.connect = mongoose.createConnection = () => { throw new Error('REAL_DB_FORBIDDEN'); };
const { buildDailyCompensationBreakdown } = require('../apasxoliseisDailyCompensationBreakdownService');
const targetId = '6a92b46e5de956f225bd3a4f';
const scope = { team: 'THA', company_kod: '69e8e92fb198b803164b824a', ypokatasthma: '0000',
    period_start: new Date('2026-04-01'), period_end: new Date('2026-04-30') };
const contextFingerprint = 'a'.repeat(64);
const zeroBuckets = Object.fromEntries(['yperergasias', 'nominhs_yperorias', 'paranomhs_yperorias']
    .flatMap((kind) => ['', '_nyxtas', '_argion', '_argion_nyxtas']
        .map((suffix) => [`ores_${kind}${suffix}_apologistika`, 0])));

function regressionFixture() {
    const employee = { kodikos: '0031', ypokatasthma: '0000', hmeres_ergasias_ebdomadas: 6,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 6.67,
        typos_apasxolhshs: '0', typos_ergazomenon: 'Μ',
        nomimoOromisthio: 6.072, pragmatikoOromisthio: 7.176 };
    const weeklyContextRows = Array.from({ length: 7 }, (_, index) => {
        const date = new Date('2026-03-30'); date.setUTCDate(date.getUTCDate() + index);
        const seventh = index === 6;
        return { _id: seventh ? new mongoose.Types.ObjectId(targetId)
            : new mongoose.Types.ObjectId(String(index + 1).padStart(24, '0')),
        team: scope.team, company_kod: scope.company_kod, ypokatasthma: '0000', kodikos: '0031',
        hmeromhnia: date, __v: 0, is_locked: false, repo: seventh,
        kathgoria_ergasias: seventh ? 'ΑΝ' : 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false, apologistiko_biblio: true,
        ores_ergasias: seventh ? 0 : 6.67, ores_ergasias_apologistika: seventh ? 4.98 : 6.67,
        ores_pragmatikhs_ergasias_apologistika: seventh ? 4.98 : 6.67,
        cards_ores_ergasias: seventh ? 5.483333333333333 : 6.67,
        cards_apo_ora_01: '12:30', cards_eos_ora_01: seventh ? '17:59' : '19:10',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '',
        apo_ora_01_apologistika: '12:30', eos_ora_01_apologistika: '19:10',
        apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '', eos_ora_03_apologistika: '',
        argia: false, kyriakes_apologistika: seventh, adeia: false, astheneia: false,
        ores_argion_ergasia_apologistika: seventh ? 5.48 : 0,
        ores_argion_prosayxhsh_apologistika: 0, ores_nyxtas_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0, ores_argias_pistomenes_apologistika: 0,
        ...zeroBuckets };
    });
    const storedRow = weeklyContextRows[6];
    storedRow.compensation_breakdown_apologistika = buildDailyCompensationBreakdown({
        row: storedRow, paidHourlyRate: employee.pragmatikoOromisthio,
        legalHourlyRate: employee.nomimoOromisthio, calculatedWorkHoursAuthoritative: true });
    Object.assign(employee, { _id: '111111111111111111111111', team: scope.team, company_kod: scope.company_kod });
    return { employee, weeklyContextRows, target: { _id: targetId, team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: '0000', kodikos: '0031', hmeromhnia: '2026-04-05' }, storedRow, scope };
}
function equal(a, b) {
    if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
    return String(a) === String(b);
}
function matches(row, filter) {
    return Object.entries(filter).every(([key, value]) => {
        if (key === '$and') return value.every((part) => matches(row, part));
        if (key === '$or') return value.some((part) => matches(row, part));
        if (value === null) return row[key] == null;
        if (value && Object.getPrototypeOf(value) === Object.prototype) {
            return Object.entries(value).every(([op, expected]) => {
                if (op === '$in') return expected.some((x) => equal(row[key], x));
                if (op === '$gte') return row[key] >= expected;
                if (op === '$lte') return row[key] <= expected;
                throw new Error('Unsupported fake operator ' + op);
            });
        }
        return equal(row[key], value);
    });
}
function harness() {
    const fixture = regressionFixture();
    const data = { rowModel: [...fixture.weeklyContextRows], employeeModel: [fixture.employee],
        historyModel: [], policyModel: [], decisionModel: [], executionModel: [], argiesModel: [],
        companiesModel: [{ _id: fixture.scope.company_kod, team: 'THA', kod: '0004', afm: '123456789',
            apasxolhsh_kata_tis_argies: false, leitoyrgia_stis_mh_ypoxreotikes_argies: false }],
        periodModel: [{ ...fixture.scope, status: 'OPEN', version: 3, write_fence_version: 6,
            historical_reconstruction_status: 'COMPLETED', historical_reconstruction_version: 1 }] };
    const reads = [];
    let activeSessionReads = 0;
    let reverse = false;
    const forbidden = () => assert.fail('WRITE_FORBIDDEN');
    const models = Object.fromEntries(Object.keys(data).map((name) => [name, {
        bulkWrite: forbidden, updateOne: forbidden, updateMany: forbidden, create: forbidden,
        insertMany: forbidden, deleteMany: forbidden, findOneAndUpdate: forbidden,
        find(filter) { return query(name, filter, false); },
        findOne(filter) { return query(name, filter, true); }
    }]));
    function query(name, filter, one) {
        let fields, session;
        return { select(value) { fields = value.split(/\s+/); return this; }, sort() { return this; },
            session(value) { session = value; return this; },
            async lean() {
                if (session) { assert.equal(activeSessionReads, 0, 'parallel session read'); activeSessionReads++; }
                reads.push({ name, filter, fields, session });
                await new Promise((resolve) => setImmediate(resolve));
                let rows = data[name].filter((row) => matches(row, filter));
                if (reverse) rows = [...rows].reverse();
                rows = rows.map((row) => fields ? Object.fromEntries(['_id', ...fields].filter((key) =>
                    Object.hasOwn(row, key)).map((key) => [key, row[key]])) : { ...row });
                if (session) activeSessionReads--;
                return one ? rows[0] || null : rows;
            } };
    }
    async function makeHistoricalCurrent() {
        const f = await require('../apasxoliseisHistoricalPeriodReconstructionService').calculateHistoricalFingerprints({
            scope: fixture.scope, prodhlomenaModel: models.rowModel, models });
        Object.assign(data.periodModel[0], { historical_dependency_fingerprint: f.dependency_fingerprint,
            historical_holiday_dependency_fingerprint: f.holiday_dependency_fingerprint });
        reads.length = 0;
    }
    return { ...fixture, data, models, reads, makeHistoricalCurrent, reverse() { reverse = !reverse; } };
}
module.exports = { regressionFixture, harness };
