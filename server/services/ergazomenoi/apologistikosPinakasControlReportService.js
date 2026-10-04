'use strict';

const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ErgazomenoiModel } = require('../../models/ergazomenoi');
const { CompaniesModel } = require('../../models/companies');
const { employeeIsEligibleForProdhlomenaOraria } =
    require('./erganiImportedEmployeeScopeService');
const { belongsToCanonicalApologistikoBook } =
    require('./apasxoliseisPredeclaredRepoBookRuleService');

const PRODHLomena_PROJECTION = Object.freeze([
    '_id', 'ypokatasthma', 'kodikos', 'hmeromhnia', 'apologistiko_biblio',
    'kathgoria_ergasias_apologistika', 'kathgoria_ergasias', 'repo',
    'repo_apologistika', 'orphan_card_resolution',
    'apo_ora_01_apologistika', 'eos_ora_01_apologistika',
    'apo_ora_02_apologistika', 'eos_ora_02_apologistika',
    'apo_ora_03_apologistika', 'eos_ora_03_apologistika'
]);
const EMPLOYEE_PROJECTION = Object.freeze(['kodikos', 'afm', 'eponymo', 'onoma',
    'afora_daneismo_ergazomenoy', 'typos_ergodoth_daneismoy']);
const REPORT_COLUMNS = Object.freeze([
    'Παράρτημα', 'Κωδικός', 'ΑΦΜ', 'Επώνυμο', 'Όνομα', 'Ημερομηνία',
    'Κατηγορία', 'ΑΠΟ-ΕΩΣ ΩΡΑ 1', 'ΑΠΟ-ΕΩΣ ΩΡΑ 2', 'ΑΠΟ-ΕΩΣ ΩΡΑ 3'
]);

function reportError(message) {
    return Object.assign(new Error(message), { status: 400, code: 'INVALID_CONTROL_REPORT_REQUEST' });
}
function clean(value) { return String(value ?? '').trim(); }
function dateKey(value, label = 'ημερομηνία') {
    const normalized = value instanceof Date && !Number.isNaN(value.getTime())
        ? value.toISOString().slice(0, 10) : clean(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw reportError(`Μη έγκυρη τιμή για ${label}.`);
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
        throw reportError(`Μη έγκυρη τιμή για ${label}.`);
    }
    return normalized;
}
function parseDate(value, label) { return new Date(`${dateKey(value, label)}T00:00:00.000Z`); }
function normalizeBranch(value) {
    const branch = clean(value);
    if (!branch || branch.toUpperCase() === 'ALL' || branch.includes(',') || !/^\d{1,4}$/.test(branch)) {
        throw reportError('Απαιτείται ένα συγκεκριμένο παράρτημα.');
    }
    return branch.padStart(4, '0');
}
function validateRequest(input = {}) {
    const ypokatasthma = normalizeBranch(input.ypokatasthma);
    const startDate = parseDate(input.apo_hmeromhnia, 'Από Ημερομηνία');
    const endDate = parseDate(input.eos_hmeromhnia, 'Έως Ημερομηνία');
    if (startDate > endDate) throw reportError('Η Από Ημερομηνία δεν μπορεί να είναι μετά την Έως Ημερομηνία.');
    return { ypokatasthma, startDate, endDate, startIso: dateKey(startDate), endIso: dateKey(endDate) };
}
function textOrDash(value) { return clean(value) || '—'; }
function firstNonBlank(...values) {
    for (const value of values) if (clean(value)) return clean(value);
    return '';
}
function companyDisplayName(company) {
    return textOrDash([company?.eponymia, company?.firstname].map(clean).filter(Boolean).join(' '));
}
async function loadCompanyName({ team, company_kod, model = CompaniesModel }) {
    const company = await model.findOne({ _id: company_kod, team }).select('eponymia firstname').lean();
    return companyDisplayName(company);
}
function sourceRecordId(row = {}) {
    return clean(row._id || row.row_id || row.prodhlomena_oraria_id);
}

function frozenEligibilityError(employeeCode) {
    return Object.assign(new Error(
        'Το frozen snapshot δεν περιέχει authoritative στοιχεία eligibility εργαζομένου.'), {
        code: 'WTODAILY_FROZEN_EMPLOYEE_ELIGIBILITY_MISSING', statusCode: 409,
        details: { employee_code: clean(employeeCode) }
    });
}
function filterEligibleApologistikosSource({ rows = [], employees = [],
    requireFrozenEligibility = false } = {}) {
    const employeesByCode = new Map(employees.map((employee) => [clean(employee?.kodikos), employee]));
    if (requireFrozenEligibility) {
        const relevantCodes = [...new Set(rows.map((row) => clean(row?.kodikos)).filter(Boolean))];
        for (const employeeCode of relevantCodes) {
            const employee = employeesByCode.get(employeeCode);
            if (!employee ||
                !Object.prototype.hasOwnProperty.call(employee, 'afora_daneismo_ergazomenoy') ||
                typeof employee.afora_daneismo_ergazomenoy !== 'boolean' ||
                employee.afora_daneismo_ergazomenoy === true && (
                    !Object.prototype.hasOwnProperty.call(employee, 'typos_ergodoth_daneismoy') ||
                    typeof employee.typos_ergodoth_daneismoy !== 'boolean'
                )) {
                throw frozenEligibilityError(employeeCode);
            }
        }
    }
    const filteredEmployees = employees.filter(employeeIsEligibleForProdhlomenaOraria);
    const excludedCodes = new Set(employees.filter((employee) =>
        !employeeIsEligibleForProdhlomenaOraria(employee)).map((employee) => clean(employee.kodikos)));
    const filteredRows = rows.filter((row) => !excludedCodes.has(clean(row?.kodikos)));
    return Object.freeze({ rows: Object.freeze(filteredRows),
        employees: Object.freeze(filteredEmployees) });
}

function buildCanonicalApologistikosRows({ rows = [], employees = [] } = {}) {
    const employeesByCode = new Map(employees.map((employee) => [clean(employee.kodikos), employee]));
    const canonicalRows = rows.filter(belongsToCanonicalApologistikoBook).map((row) => {
        const employeeCode = clean(row.kodikos);
        const employee = employeesByCode.get(employeeCode) || {};
        const intervals = [];
        for (let index = 1; index <= 3; index += 1) {
            const suffix = String(index).padStart(2, '0');
            const from = clean(row[`apo_ora_${suffix}_apologistika`]);
            const to = clean(row[`eos_ora_${suffix}_apologistika`]);
            if (from || to) intervals.push(Object.freeze({ from, to }));
        }
        return Object.freeze({
            source_record_id: sourceRecordId(row), ypokatasthma: clean(row.ypokatasthma),
            employee_code: employeeCode, afm: clean(employee.afm ?? row.afm),
            eponymo: clean(employee.eponymo ?? row.eponymo).toUpperCase(),
            onoma: clean(employee.onoma ?? row.onoma).toUpperCase(), date: dateKey(row.hmeromhnia),
            category: firstNonBlank(row.kathgoria_ergasias_apologistika,
                row.kathgoria_ergasias).toUpperCase(),
            intervals: Object.freeze(intervals), apologistiko_biblio: true
        });
    }).sort(compareCanonicalRows);
    return Object.freeze(canonicalRows);
}

function pair(interval) {
    return interval ? `${textOrDash(interval.from)} – ${textOrDash(interval.to)}` : '—';
}
function formatDate(value) {
    try { return dateKey(value).split('-').reverse().join('/'); } catch (_error) { return '—'; }
}
function projectCanonicalReportRow(row) {
    return {
        source_record_id: row.source_record_id, ypokatasthma: textOrDash(row.ypokatasthma),
        kodikos: textOrDash(row.employee_code), afm: textOrDash(row.afm),
        eponymo: textOrDash(row.eponymo), onoma: textOrDash(row.onoma),
        hmeromhnia: formatDate(row.date), category: textOrDash(row.category),
        zeugos1: pair(row.intervals?.[0]), zeugos2: pair(row.intervals?.[1]),
        zeugos3: pair(row.intervals?.[2]), _date: row.date
    };
}
function compareCanonicalRows(left, right) {
    const collator = new Intl.Collator('el', { sensitivity: 'base', numeric: true });
    for (const key of ['ypokatasthma', 'eponymo', 'onoma', 'employee_code']) {
        const result = collator.compare(clean(left[key]), clean(right[key]));
        if (result) return result;
    }
    return clean(left.date).localeCompare(clean(right.date));
}
function buildReportFromCanonical({ canonicalRows = [], criteria } = {}) {
    return { criteria, columns: REPORT_COLUMNS, canonicalRows,
        rows: canonicalRows.map(projectCanonicalReportRow) };
}

async function buildReport({ team, company_kod, input, models = {} }) {
    const scopeTeam = clean(team); const scopeCompany = clean(company_kod);
    if (!scopeTeam || !scopeCompany) throw reportError('Δεν βρέθηκε έγκυρο εταιρικό πλαίσιο συνεδρίας.');
    const criteria = validateRequest(input);
    const prodhlomenaModel = models.ProdhlomenaOrariaModel || ProdhlomenaOrariaModel;
    const employeeModel = models.ErgazomenoiModel || ErgazomenoiModel;
    const query = { team: scopeTeam, company_kod: scopeCompany, ypokatasthma: criteria.ypokatasthma,
        apologistiko_biblio: true,
        hmeromhnia: mongoose.trusted({ $gte: criteria.startDate, $lte: criteria.endDate }) };
    const storedRows = await prodhlomenaModel.find(query).select(PRODHLomena_PROJECTION.join(' ')).lean();
    const employeeCodes = [...new Set(storedRows.map((row) => clean(row.kodikos)).filter(Boolean))];
    const employeeQuery = { team: scopeTeam, company_kod: scopeCompany,
        kodikos: mongoose.trusted({ $in: employeeCodes }) };
    const employees = employeeCodes.length
        ? await employeeModel.find(employeeQuery).select(`${EMPLOYEE_PROJECTION.join(' ')} -_id`).lean() : [];
    const eligibleSource = filterEligibleApologistikosSource({ rows: storedRows, employees });
    const canonicalRows = buildCanonicalApologistikosRows(eligibleSource);
    return { ...buildReportFromCanonical({ canonicalRows, criteria }), query, employeeQuery };
}

module.exports = { PRODHLomena_PROJECTION, EMPLOYEE_PROJECTION, REPORT_COLUMNS, validateRequest,
    normalizeBranch, firstNonBlank, companyDisplayName, loadCompanyName, dateKey,
    pair, formatDate, sourceRecordId, filterEligibleApologistikosSource,
    buildCanonicalApologistikosRows, projectCanonicalReportRow,
    compareCanonicalRows, buildReportFromCanonical, buildReport };
