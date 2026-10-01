'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel, ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const { YpokatasthmataModel } = require('../../models/companies');
const {
    buildWtoLeaveCanonicalDataset,
    buildWtoLeavePayload,
    validateWtoLeaveParity,
    formatDate
} = require('./wtoLeaveSubmissionService');
const { resolveEmploymentTypeValue } =
    require('../../utils/ergazomenoi/getOrarioTermsForDate');

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
        throw datasetError('WTOLEAVE_INVALID_SEARCH_DATE', `Το πεδίο ${field} δεν είναι έγκυρη ημερομηνία.`);
    }
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
        throw datasetError('WTOLEAVE_INVALID_SEARCH_DATE', `Το πεδίο ${field} δεν είναι έγκυρη ημερομηνία.`);
    }
    return date;
}
function normalizeSearchInput(input = {}) {
    const branchRaw = String(input.ypokatasthma || '').trim();
    if (!/^\d{1,4}$/.test(branchRaw)) {
        throw datasetError('WTOLEAVE_INVALID_BRANCH', 'Το υποκατάστημα πρέπει να έχει 1 έως 4 ψηφία.');
    }
    const fromDate = parseIsoDate(input.from_date, 'Από ημερομηνία');
    const toDate = parseIsoDate(input.to_date, 'Έως ημερομηνία');
    const days = Math.floor((toDate - fromDate) / DAY_MS);
    if (days < 0 || days > 366) {
        throw datasetError('WTOLEAVE_INVALID_SEARCH_RANGE',
            'Το διάστημα αναζήτησης πρέπει να είναι από 1 έως 367 ημερολογιακές ημέρες.');
    }
    return Object.freeze({ branch: branchRaw.padStart(4, '0'), fromDate, toDate,
        from: input.from_date, to: input.to_date });
}
function assertScope(scope = {}) {
    const team = String(scope.effectiveTeam || scope.team || '').trim();
    const company = String(scope.companyId || scope.company_kod || '').trim();
    if (!team || !mongoose.isValidObjectId(company)) {
        throw datasetError('WTOLEAVE_INVALID_SESSION_SCOPE',
            'Δεν υπάρχει έγκυρο εταιρικό πλαίσιο συνεδρίας.', 403);
    }
    return Object.freeze({ team, company });
}
function publicRow(row) {
    return { source_record_id: row.source_record_id, employee_code: row.employee_code,
        afm: row.afm, eponymo: row.eponymo, onoma: row.onoma, date: row.date,
        leave_type: row.leave_type, full_day: row.full_day, intervals: row.intervals,
        reference_year: row.reference_year, required_days: row.required_days,
        entitlement_debug: row.entitlement_debug };
}

async function loadWtoLeaveDataset({ scope, input, models = {} } = {}) {
    const authorized = assertScope(scope);
    const search = normalizeSearchInput(input);
    const Employee = models.ErgazomenoiModel || ErgazomenoiModel;
    const Schedule = models.ProdhlomenaOrariaModel || ProdhlomenaOrariaModel;
    const Branch = models.YpokatasthmataModel || YpokatasthmataModel;
    const branch = await Branch.findOne({ team: authorized.team,
        companykod_object: authorized.company, kodikos: search.branch }).lean();
    if (!branch) throw datasetError('WTOLEAVE_BRANCH_NOT_FOUND',
        'Το υποκατάστημα δεν ανήκει στην ενεργή εταιρεία.', 404);

    const sourceRows = await Schedule.find({ team: authorized.team,
        company_kod: authorized.company, ypokatasthma: search.branch,
        hmeromhnia: mongoose.trusted({ $gte: search.fromDate, $lte: search.toDate })
    }).sort({ hmeromhnia: 1, kodikos: 1 }).lean();
    const codes = [...new Set(sourceRows.map((row) => String(row.kodikos || '').trim()).filter(Boolean))];
    const employees = codes.length ? await Employee.find({ team: authorized.team,
        company_kod: authorized.company, ypokatasthma: search.branch,
        kodikos: mongoose.trusted({ $in: codes })
    }).select('_id kodikos afm eponymo onoma karta_ergasias afora_daneismo_ergazomenoy typos_ergodoth_daneismoy hmeromhnia_proslhpshs hmeromhnia_apoxorhshs hmeres_ergasias_ebdomadas kathestos_apasxolhshs typos_apasxolhshs proyphresia_adeias_se_eth').lean() : [];

    const type2Codes = new Set(employees.filter((employee) =>
        resolveEmploymentTypeValue(employee) === '2').map((employee) =>
        String(employee.kodikos || '').trim()));
    const relevantType2LeaveRows = sourceRows.filter((row) => type2Codes.has(String(row.kodikos || '').trim()) &&
        String(row.kathgoria_adeias_apologistika || '').trim() === 'ΑΔΚΑΝ' &&
        row.adeia_apologistika === true && row.egkekrimenh_oroadeia_apologistika !== true);
    let actualWorkRows = [];
    if (relevantType2LeaveRows.length) {
        const employeeByCode = new Map(employees.map((employee) => [String(employee.kodikos || '').trim(), employee]));
        const starts = relevantType2LeaveRows.map((row) => {
            const reference = new Date(row.hmeromhnia);
            const jan1 = new Date(Date.UTC(reference.getUTCFullYear(), 0, 1));
            const hire = new Date(employeeByCode.get(String(row.kodikos || '').trim()).hmeromhnia_proslhpshs);
            return hire > jan1 ? hire : jan1;
        });
        const earliest = new Date(Math.min(...starts.map(Number)));
        const latest = new Date(Math.max(...relevantType2LeaveRows.map((row) => Number(new Date(row.hmeromhnia)))));
        actualWorkRows = await Schedule.find({ team: authorized.team,
            company_kod: authorized.company, ypokatasthma: search.branch,
            kodikos: mongoose.trusted({ $in: [...type2Codes] }),
            hmeromhnia: mongoose.trusted({ $gte: earliest, $lte: latest })
        }).sort({ hmeromhnia: 1, kodikos: 1 }).lean();
    }

    const canonical = buildWtoLeaveCanonicalDataset({ sourceRows, employees, actualWorkRows });
    let payload = null;
    let parity = Object.freeze({ exact: false, valid: false,
        canonical_facts: [], payload_facts: [] });
    if (canonical.rows.length > 0 && canonical.blockers.length === 0) {
        payload = buildWtoLeavePayload({ canonicalRows: canonical.rows, branch: String(branch.kodikos).trim() });
        parity = validateWtoLeaveParity(canonical.rows, payload);
        if (!parity.exact) payload = null;
    }
    const dates = canonical.rows.map((row) => row.date).sort();
    const analyticsCount = canonical.rows.reduce((sum, row) =>
        sum + (row.full_day ? 1 : row.intervals.length), 0);
    const response = {
        success: true,
        search_from: search.from,
        search_to: search.to,
        actual_from: dates.length ? formatDate(dates[0]) : '',
        actual_to: dates.length ? formatDate(dates[dates.length - 1]) : '',
        employee_count: new Set(canonical.rows.map((row) => row.afm)).size,
        employee_day_count: canonical.rows.length,
        analytics_count: analyticsCount,
        full_day_count: canonical.rows.filter((row) => row.full_day).length,
        hourly_interval_count: canonical.rows.filter((row) => !row.full_day)
            .reduce((sum, row) => sum + row.intervals.length, 0),
        rows: canonical.rows.map(publicRow),
        blockers: canonical.blockers,
        payload,
        parity,
        submission_eligible: Boolean(payload && parity.exact && canonical.blockers.length === 0)
    };
    return Object.freeze({ response, canonicalRows: canonical.rows, branch,
        search, authorized, payload, parity });
}

module.exports = { loadWtoLeaveDataset, normalizeSearchInput, assertScope, datasetError };
