'use strict';

const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ErgazomenoiModel } = require('../../models/ergazomenoi');
const { CompaniesModel } = require('../../models/companies');

const PRODHLomena_PROJECTION = Object.freeze([
    'ypokatasthma', 'kodikos', 'hmeromhnia', 'apologistiko_biblio', 'kathgoria_ergasias_apologistika',
    'kathgoria_ergasias',
    'apo_ora_01_apologistika', 'eos_ora_01_apologistika',
    'apo_ora_02_apologistika', 'eos_ora_02_apologistika',
    'apo_ora_03_apologistika', 'eos_ora_03_apologistika'
]);
const EMPLOYEE_PROJECTION = Object.freeze(['kodikos', 'afm', 'eponymo', 'onoma']);
const REPORT_COLUMNS = Object.freeze([
    'Παράρτημα', 'Κωδικός', 'ΑΦΜ', 'Επώνυμο', 'Όνομα', 'Ημερομηνία',
    'Κατηγορία', 'ΑΠΟ-ΕΩΣ ΩΡΑ 1', 'ΑΠΟ-ΕΩΣ ΩΡΑ 2', 'ΑΠΟ-ΕΩΣ ΩΡΑ 3'
]);

function reportError(message) {
    return Object.assign(new Error(message), { status: 400, code: 'INVALID_CONTROL_REPORT_REQUEST' });
}

function parseDate(value, label) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw reportError(`Μη έγκυρη τιμή για ${label}.`);
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
        throw reportError(`Μη έγκυρη τιμή για ${label}.`);
    }
    return date;
}

function normalizeBranch(value) {
    const branch = typeof value === 'string' ? value.trim() : '';
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
    return { ypokatasthma, startDate, endDate,
        startIso: startDate.toISOString().slice(0, 10), endIso: endDate.toISOString().slice(0, 10) };
}

function textOrDash(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return text.trim() ? text : '—';
}

function firstNonBlank(...values) {
    for (const value of values) {
        if (value !== null && value !== undefined && String(value).trim() !== '') return String(value).trim();
    }
    return '';
}

function companyDisplayName(company) {
    return textOrDash([company?.eponymia, company?.firstname]
        .map((value) => String(value || '').trim()).filter(Boolean).join(' '));
}

async function loadCompanyName({ team, company_kod, model = CompaniesModel }) {
    const company = await model.findOne({ _id: company_kod, team }).select('eponymia firstname').lean();
    return companyDisplayName(company);
}

function pair(start, end) {
    return `${textOrDash(start)} – ${textOrDash(end)}`;
}

function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

function projectRow(row, employee) {
    return {
        ypokatasthma: textOrDash(row.ypokatasthma), kodikos: textOrDash(row.kodikos),
        afm: textOrDash(employee?.afm), eponymo: textOrDash(employee?.eponymo),
        onoma: textOrDash(employee?.onoma), hmeromhnia: formatDate(row.hmeromhnia),
        category: textOrDash(firstNonBlank(
            row.kathgoria_ergasias_apologistika,
            row.kathgoria_ergasias
        )),
        zeugos1: pair(row.apo_ora_01_apologistika, row.eos_ora_01_apologistika),
        zeugos2: pair(row.apo_ora_02_apologistika, row.eos_ora_02_apologistika),
        zeugos3: pair(row.apo_ora_03_apologistika, row.eos_ora_03_apologistika),
        _date: row.hmeromhnia
    };
}

function compareRows(left, right) {
    const collator = new Intl.Collator('el', { sensitivity: 'base', numeric: true });
    for (const key of ['ypokatasthma', 'eponymo', 'onoma', 'kodikos']) {
        const result = collator.compare(left[key], right[key]);
        if (result) return result;
    }
    return new Date(left._date) - new Date(right._date);
}

async function buildReport({ team, company_kod, input, models = {} }) {
    const scopeTeam = typeof team === 'string' ? team.trim() : '';
    const scopeCompany = typeof company_kod === 'string' ? company_kod.trim() : '';
    if (!scopeTeam || !scopeCompany) throw reportError('Δεν βρέθηκε έγκυρο εταιρικό πλαίσιο συνεδρίας.');
    const criteria = validateRequest(input);
    const prodhlomenaModel = models.ProdhlomenaOrariaModel || ProdhlomenaOrariaModel;
    const employeeModel = models.ErgazomenoiModel || ErgazomenoiModel;
    const query = { team: scopeTeam, company_kod: scopeCompany, ypokatasthma: criteria.ypokatasthma,
        apologistiko_biblio: true,
        hmeromhnia: mongoose.trusted({ $gte: criteria.startDate, $lte: criteria.endDate }) };
    const storedRows = await prodhlomenaModel.find(query).select(`${PRODHLomena_PROJECTION.join(' ')} -_id`).lean();
    const employeeCodes = [...new Set(storedRows.map((row) => String(row.kodikos || '').trim()).filter(Boolean))];
    const employeeQuery = { team: scopeTeam, company_kod: scopeCompany,
        kodikos: mongoose.trusted({ $in: employeeCodes }) };
    const employees = employeeCodes.length
        ? await employeeModel.find(employeeQuery).select(`${EMPLOYEE_PROJECTION.join(' ')} -_id`).lean()
        : [];
    const employeesByCode = new Map(employees.map((employee) => [String(employee.kodikos || '').trim(), employee]));
    const rows = storedRows.map((row) => projectRow(row, employeesByCode.get(String(row.kodikos || '').trim())))
        .sort(compareRows);
    return { criteria, query, employeeQuery, columns: REPORT_COLUMNS, rows };
}

module.exports = { PRODHLomena_PROJECTION, EMPLOYEE_PROJECTION, REPORT_COLUMNS, validateRequest,
    normalizeBranch, firstNonBlank, companyDisplayName, loadCompanyName,
    pair, formatDate, projectRow, compareRows, buildReport };
