'use strict';

const mongoose = require('mongoose');
const { finalizedEmployeeFilter } = require('../../utils/ergazomenoi/finalizedEmployeeFilter');
const { preloadEmployeeEmploymentCycleContexts, distinctHireDates } = require('./employeeEmploymentCycleContextLoaderService');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const capabilities = new WeakMap();
const fields = 'kodikos ypokatasthma hmeromhnia_proslhpshs hmeromhnia_apoxorhshs ' +
    'afora_daneismo_ergazomenoy typos_ergodoth_daneismoy hmnia_enarxhs_daneismoy hmnia_lhxhs_daneismoy';
const start = key => new Date(`${key}T00:00:00.000Z`);
const end = key => new Date(`${key}T23:59:59.999Z`);

// Only this database reader issues a capability. Neither request $nor clauses
// nor a serialized/caller-created object can authorize an exclusion.
async function loadEmploymentReviewLifecycleScope({ team, companyId, ypokatasthma = '', kodikos = '' }, dependencies = {}) {
    const models = require('../../models/ergazomenoi');
    const employeeModel = dependencies.employeeModel || models.ErgazomenoiModel;
    const historyModel = dependencies.historyModel || models.IstorikoProslhpseonAllagonModel;
    const identity = { team, company_kod: companyId };
    if (ypokatasthma) identity.ypokatasthma = String(ypokatasthma).trim().padStart(4, '0');
    if (kodikos) identity.kodikos = String(kodikos).trim();
    const employees = await employeeModel.find(finalizedEmployeeFilter(identity)).select(fields).lean();
    const lifecycleEmployees = await preloadEmployeeEmploymentCycleContexts({ team, company_kod: companyId,
        employees, historyModel, includeAllHistory: true });
    const counts = new Map();
    for (const employee of lifecycleEmployees) counts.set(employee.kodikos, (counts.get(employee.kodikos) || 0) + 1);
    const exclusions = [], descriptors = [];
    for (const employee of lifecycleEmployees) {
        // Ambiguous masters, missing hires, contradictory cycles and unknown
        // loan facts retain ALL pending days in the preflight (fail closed).
        if (counts.get(employee.kodikos) !== 1 || !employee.kodikos || !employee.ypokatasthma ||
            !dateKeyUtc(employee.hmeromhnia_proslhpshs)) continue;
        let cycles;
        try { cycles = buildEmploymentCycles({ currentEmployee: employee, history: employee.employment_history }); }
        catch { continue; }
        const sourceRows = [employee, ...(employee.employment_history || [])];
        if (sourceRows.some(row => !dateKeyUtc(row.hmeromhnia_proslhpshs) ||
            row.hmeromhnia_apoxorhshs && !dateKeyUtc(row.hmeromhnia_apoxorhshs))) continue;
        // A disagreement within the current cycle is not proof of departure.
        if (sourceRows.some(row => dateKeyUtc(row.hmeromhnia_proslhpshs) === dateKeyUtc(employee.hmeromhnia_proslhpshs) &&
            dateKeyUtc(row.hmeromhnia_apoxorhshs) &&
            dateKeyUtc(row.hmeromhnia_apoxorhshs) !== dateKeyUtc(employee.hmeromhnia_apoxorhshs))) continue;
        const rowIdentity = { kodikos: employee.kodikos, ypokatasthma: employee.ypokatasthma };
        exclusions.push({ ...rowIdentity, hmeromhnia: mongoose.trusted({ $lt: start(cycles[0].hire_date) }) });
        cycles.forEach((cycle, index) => {
            if (!cycle.departure_date) return;
            const next = cycles[index + 1];
            const descriptor = { ...rowIdentity, departureEnd: end(cycle.departure_date),
                ...(next ? { nextHireStart: start(next.hire_date) } : {}) };
            descriptors.push(descriptor);
            exclusions.push({ ...rowIdentity, hmeromhnia: mongoose.trusted({ $gt: descriptor.departureEnd,
                ...(next ? { $lt: descriptor.nextHireStart } : {}) }) });
        });
        if (employee.afora_daneismo_ergazomenoy !== true) continue;
        const from = dateKeyUtc(employee.hmnia_enarxhs_daneismoy), to = dateKeyUtc(employee.hmnia_lhxhs_daneismoy);
        if (!from || employee.hmnia_lhxhs_daneismoy && !to || to && to < from ||
            typeof employee.typos_ergodoth_daneismoy !== 'boolean') continue;
        if (employee.typos_ergodoth_daneismoy === false) {
            exclusions.push({ ...rowIdentity, hmeromhnia: mongoose.trusted({ $gte: start(from), ...(to ? { $lte: end(to) } : {}) }) });
        } else {
            exclusions.push({ ...rowIdentity, hmeromhnia: mongoose.trusted({ $lt: start(from) }) });
            if (to) exclusions.push({ ...rowIdentity, hmeromhnia: mongoose.trusted({ $gt: end(to) }) });
        }
    }
    const employmentScope = Object.freeze({});
    capabilities.set(employmentScope, { identity, exclusions });
    // Keep the established display/calculation context contract: only actual
    // multiple hires opt a master into the cycle-aware presentation path.
    const displayEmployees = lifecycleEmployees.map(employee => {
        if (!Array.isArray(employee.employment_history) || distinctHireDates(employee, employee.employment_history).size > 1) return employee;
        const { employment_history, ...master } = employee; return master;
    });
    return { employees: displayEmployees, descriptors, employmentScope };
}

function verifiedEmploymentExclusions(employmentScope, filter) {
    if (employmentScope == null) return [];
    const verified = capabilities.get(employmentScope);
    if (!verified || Object.entries(verified.identity).some(([key, value]) => filter[key] !== value))
        throw new TypeError('EMPLOYMENT_REVIEW_SCOPE_CAPABILITY_INVALID');
    // Clone to prevent filter mutation from changing the capability's proof.
    return verified.exclusions.map(row => ({ ...row, hmeromhnia: mongoose.trusted({ ...row.hmeromhnia }) }));
}

function applyEmploymentReviewLifecycleScope(filter, employmentScope) {
    const exclusions = verifiedEmploymentExclusions(employmentScope, filter);
    if (exclusions.length) filter.$nor = mongoose.trusted([...(Array.isArray(filter.$nor) ? filter.$nor : []), ...exclusions]);
    return filter;
}
module.exports = { loadEmploymentReviewLifecycleScope, verifiedEmploymentExclusions, applyEmploymentReviewLifecycleScope };
