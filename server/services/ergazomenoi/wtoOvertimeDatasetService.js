'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel, ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const { YpokatasthmataModel } = require('../../models/companies');
const {
    buildWtoOvertimeCanonicalDataset,
    buildWtoOvertimePayload,
    validateWtoOvertimeParity,
    formatDate
} = require('./wtoOvertimeSubmissionService');

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function datasetError(code, message, statusCode = 400) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}
function parseIsoDate(value, field) {
    const normalized = String(value || '').trim();
    if (!ISO_DATE.test(normalized)) {
        throw datasetError('WTOOVA_INVALID_SEARCH_DATE', `Το πεδίο ${field} δεν είναι έγκυρη ημερομηνία.`);
    }
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
        throw datasetError('WTOOVA_INVALID_SEARCH_DATE', `Το πεδίο ${field} δεν είναι έγκυρη ημερομηνία.`);
    }
    return date;
}
function normalizeSearchInput(input = {}) {
    const branchRaw = String(input.ypokatasthma || '').trim();
    if (!/^\d{1,4}$/.test(branchRaw)) {
        throw datasetError('WTOOVA_INVALID_BRANCH', 'Το υποκατάστημα πρέπει να έχει 1 έως 4 ψηφία.');
    }
    const fromDate = parseIsoDate(input.from_date, 'Από ημερομηνία');
    const toDate = parseIsoDate(input.to_date, 'Έως ημερομηνία');
    const days = Math.floor((toDate - fromDate) / DAY_MS);
    if (days < 0 || days > 366) {
        throw datasetError('WTOOVA_INVALID_SEARCH_RANGE',
            'Το διάστημα αναζήτησης πρέπει να είναι από 1 έως 367 ημερολογιακές ημέρες.');
    }
    return Object.freeze({ branch: branchRaw.padStart(4, '0'), fromDate, toDate,
        from: String(input.from_date), to: String(input.to_date) });
}
function assertScope(scope = {}) {
    const team = String(scope.effectiveTeam || scope.team || '').trim();
    const company = String(scope.companyId || scope.company_kod || '').trim();
    if (!team || !mongoose.isValidObjectId(company)) {
        throw datasetError('WTOOVA_INVALID_SESSION_SCOPE',
            'Δεν υπάρχει έγκυρο εταιρικό πλαίσιο συνεδρίας.', 403);
    }
    return Object.freeze({ team, company });
}
function publicRow(row) {
    return { source_record_id: row.source_record_id, employee_code: row.employee_code,
        afm: row.afm, eponymo: row.eponymo, onoma: row.onoma, date: row.date,
        legal_overwork_minutes: row.legal_overwork_minutes,
        legal_overtime_minutes: row.legal_overtime_minutes,
        submitted_overtime_minutes: row.submitted_overtime_minutes,
        excess_minutes: row.excess_minutes, f_type: row.f_type,
        f_from: row.f_from, f_to: row.f_to, warnings: row.warnings };
}

async function loadWtoOvertimeDataset({ scope, input, models = {} } = {}) {
    const authorized = assertScope(scope);
    const search = normalizeSearchInput(input);
    const Employee = models.ErgazomenoiModel || ErgazomenoiModel;
    const Schedule = models.ProdhlomenaOrariaModel || ProdhlomenaOrariaModel;
    const Branch = models.YpokatasthmataModel || YpokatasthmataModel;
    const branch = await Branch.findOne({ team: authorized.team,
        companykod_object: authorized.company, kodikos: search.branch }).lean();
    if (!branch) throw datasetError('WTOOVA_BRANCH_NOT_FOUND',
        'Το υποκατάστημα δεν ανήκει στην ενεργή εταιρεία.', 404);

    const sourceRows = await Schedule.find({ team: authorized.team,
        company_kod: authorized.company, ypokatasthma: search.branch,
        hmeromhnia: mongoose.trusted({ $gte: search.fromDate, $lte: search.toDate })
    }).sort({ hmeromhnia: 1, kodikos: 1 }).lean();
    const codes = [...new Set(sourceRows.map((row) => String(row.kodikos || '').trim()).filter(Boolean))];
    const employees = codes.length ? await Employee.find({ team: authorized.team,
        company_kod: authorized.company, ypokatasthma: search.branch,
        kodikos: mongoose.trusted({ $in: codes })
    }).select('_id kodikos afm eponymo onoma karta_ergasias afora_daneismo_ergazomenoy typos_ergodoth_daneismoy').lean() : [];

    const canonical = buildWtoOvertimeCanonicalDataset({ sourceRows, employees });
    let payload = null;
    let parity = Object.freeze({ exact: false, valid: false,
        canonical_facts: [], payload_facts: [], schema_errors: [] });
    if (canonical.rows.length > 0 && canonical.blockers.length === 0) {
        payload = buildWtoOvertimePayload({ canonicalRows: canonical.rows,
            branch: String(branch.kodikos).trim() });
        parity = validateWtoOvertimeParity(canonical.rows, payload);
        if (!parity.exact) payload = null;
    }
    const dates = canonical.rows.map((row) => row.date).sort();
    const response = {
        success: true, search_from: search.from, search_to: search.to,
        actual_from: dates.length ? formatDate(dates[0]) : '',
        actual_to: dates.length ? formatDate(dates[dates.length - 1]) : '',
        employee_count: new Set(canonical.rows.map((row) => row.afm)).size,
        employee_day_count: canonical.rows.length,
        analytics_count: canonical.rows.length,
        total_legal_overtime_minutes: canonical.rows.reduce(
            (sum, row) => sum + row.legal_overtime_minutes, 0),
        total_submitted_overtime_minutes: canonical.rows.reduce(
            (sum, row) => sum + row.submitted_overtime_minutes, 0),
        total_excess_minutes: canonical.rows.reduce((sum, row) => sum + row.excess_minutes, 0),
        warning_count: canonical.warnings.length, blocker_count: canonical.blockers.length,
        rows: canonical.rows.map(publicRow), warnings: canonical.warnings,
        blockers: canonical.blockers, payload, parity,
        submission_eligible: Boolean(payload && parity.exact && canonical.blockers.length === 0)
    };
    return Object.freeze({ response, canonicalRows: canonical.rows, branch,
        search, authorized, payload, parity });
}

module.exports = { loadWtoOvertimeDataset, normalizeSearchInput, assertScope, datasetError };
