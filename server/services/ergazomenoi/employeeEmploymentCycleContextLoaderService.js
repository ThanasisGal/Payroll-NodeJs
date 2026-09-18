'use strict';

const mongoose = require('mongoose');
const {
    IstorikoProslhpseonAllagonModel
} = require('../../models/ergazomenoi');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

const LIFECYCLE_HISTORY_FIELDS = Object.freeze([
    '_id',
    'kodikos',
    'aa_eggrafhs',
    'hmeromhnia_proslhpshs',
    'hmeromhnia_apoxorhshs',
    'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_isxyos_oron_ergasias_apo',
    'createdAt'
]);

function cleanEmployeeCode(value) {
    return String(value || '').trim();
}

function distinctHireDates(employee = {}, history = []) {
    const dates = new Set();
    const currentHire = dateKeyUtc(employee.hmeromhnia_proslhpshs);
    if (currentHire) dates.add(currentHire);

    for (const row of history) {
        const hire = dateKeyUtc(row?.hmeromhnia_proslhpshs);
        if (hire) dates.add(hire);
    }

    return dates;
}

async function preloadEmployeeEmploymentCycleContexts({
    team,
    company_kod,
    employees = [],
    historyModel = IstorikoProslhpseonAllagonModel
} = {}) {
    if (!Array.isArray(employees) || employees.length === 0) return [];

    const employeeCountsByCode = new Map();
    for (const employee of employees) {
        const code = cleanEmployeeCode(employee?.kodikos);
        if (!code) continue;
        employeeCountsByCode.set(code, (employeeCountsByCode.get(code) || 0) + 1);
    }

    const uniqueMasterCodes = [...employeeCountsByCode.entries()]
        .filter(([, count]) => count === 1)
        .map(([code]) => code)
        .sort();

    if (uniqueMasterCodes.length === 0) {
        return employees.map((employee) => ({ ...employee }));
    }

    const historyRows = await historyModel.find({
        team,
        company_kod,
        kodikos: mongoose.trusted({ $in: uniqueMasterCodes })
    })
        .select(LIFECYCLE_HISTORY_FIELDS.join(' '))
        .sort({
            kodikos: 1,
            hmeromhnia_proslhpshs: 1,
            hmeromhnia_isxyos_oron_ergasias_apo: 1,
            aa_eggrafhs: 1,
            createdAt: 1,
            _id: 1
        })
        .lean();

    const historyByCode = new Map();
    for (const row of historyRows || []) {
        const code = cleanEmployeeCode(row?.kodikos);
        if (!code || !employeeCountsByCode.has(code)) continue;
        if (!historyByCode.has(code)) historyByCode.set(code, []);
        historyByCode.get(code).push(row);
    }

    return employees.map((employee) => {
        const code = cleanEmployeeCode(employee?.kodikos);

        // Preserve exact legacy behavior when duplicate physical employee records
        // still exist for one business code. The single-master lifecycle path is
        // intentionally opt-in only for an unambiguous master record.
        if (!code || employeeCountsByCode.get(code) !== 1) {
            return { ...employee };
        }

        const history = historyByCode.get(code) || [];

        // Ordinary employees with only one distinct hire date stay on the exact
        // legacy interval logic. Only actual multi-hire evidence opts into cycles.
        if (distinctHireDates(employee, history).size <= 1) {
            return { ...employee };
        }

        return {
            ...employee,
            employment_history: history
        };
    });
}

module.exports = {
    LIFECYCLE_HISTORY_FIELDS,
    distinctHireDates,
    preloadEmployeeEmploymentCycleContexts
};
