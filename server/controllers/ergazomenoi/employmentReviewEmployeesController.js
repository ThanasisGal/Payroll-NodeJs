'use strict';

const mongoose = require('mongoose');
const { LOAN_FIELDS, ownsEmploymentReviewDate } = require('../../services/ergazomenoi/employmentReviewLoanOwnershipService');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { YpokatasthmataModel } = require('../../models/companies');
const { dateRange } = require('../../middlewares/programmataAccessScope');
const { LIFECYCLE_HISTORY_FIELDS } = require('../../services/ergazomenoi/employeeEmploymentCycleContextLoaderService');
const { buildEmploymentCycles } = require('../../services/ergazomenoi/employeeEmploymentCycleResolverService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const dropdown = require('../../dropdowns/ergazomenoi/ergazomenoi');

const allowedKeys = new Set(['apo_hmeromhnia', 'eos_hmeromhnia', 'ypokatasthma',
    'search', 'value', 'page', 'limit']);
const employeeFields = `${dropdown.options.select} oristikh_enhmerosh hmeromhnia_proslhpshs hmeromhnia_apoxorhshs ${LOAN_FIELDS}`;

function invalid() { throw Object.assign(new Error('Invalid employee selection'), { status: 400 }); }

function validateQuery(query) {
    for (const [key, value] of Object.entries(query)) {
        if (!allowedKeys.has(key) || typeof value !== 'string') invalid();
    }
    const period = dateRange(query.apo_hmeromhnia, query.eos_hmeromhnia);
    if (!/^\d{1,4}$/.test(query.ypokatasthma || '')) invalid();
    const search = (query.search || '').trim();
    const value = (query.value || '').trim();
    if (search.length > 128 || /[\x00-\x1f\x7f]/.test(search)) invalid();
    if (query.value !== undefined && !/^[A-Za-z0-9._-]{1,64}$/.test(value)) invalid();
    if (query.page !== undefined && !/^[1-9]\d{0,5}$/.test(query.page)) invalid();
    if (query.limit !== undefined && query.limit !== '50') invalid();
    return { period, branch: query.ypokatasthma.padStart(4, '0'), search, value,
        page: Number(query.page || 1) };
}

function overlapsPeriod(employee, history, period) {
    if (employee.oristikh_enhmerosh === false || employee.archived === true) return false;
    const rows = semanticHistoryRows(history);
    // A malformed departure is not evidence of an open employment relationship.
    if ([employee, ...rows].some(row =>
        (row.hmeromhnia_proslhpshs && !dateKeyUtc(row.hmeromhnia_proslhpshs)) ||
        (row.hmeromhnia_apoxorhshs && !dateKeyUtc(row.hmeromhnia_apoxorhshs)))) return false;
    try {
        return buildEmploymentCycles({ currentEmployee: employee, history: rows }).some(cycle => {
            const start = cycle.hire_date > period.startIso ? cycle.hire_date : period.startIso;
            const end = cycle.departure_date && cycle.departure_date < period.endIso
                ? cycle.departure_date : period.endIso;
            if (start > end) return false;
            for (let day = new Date(`${start}T00:00:00.000Z`);
                dateKeyUtc(day) <= end; day.setUTCDate(day.getUTCDate() + 1)) {
                if (ownsEmploymentReviewDate(day, employee)) return true;
            }
            return false;
        });
    } catch (error) {
        if (!error.code?.startsWith('EMPLOYMENT_CYCLE_')) throw error;
        // Do not invent continuity for contradictory/unterminated legacy cycles.
        return false;
    }
}

function createHandler({ employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, branchModel = YpokatasthmataModel } = {}) {
    return async (req, res) => {
        try {
            const { period, branch, search, value, page } = validateQuery(req.query);
            const scope = req.programmataAccessScope;
            if (!scope?.effectiveTeam || !mongoose.isValidObjectId(scope.companyId)) {
                throw Object.assign(new Error('Missing authorized company'), { status: 403 });
            }
            const identity = { team: scope.effectiveTeam, company_kod: scope.companyId };
            const authorizedBranch = await branchModel.findOne({ team: identity.team,
                companykod_object: identity.company_kod, kodikos: branch }).select('_id').lean();
            if (!authorizedBranch) throw Object.assign(new Error('Branch unavailable'), { status: 404 });

            // Every operator is constructed here after scalar validation. No external
            // filter is passed to trusted(), and sanitizeFilter remains enabled.
            const filter = { ...identity,
                oristikh_enhmerosh: mongoose.trusted({ $ne: false }),
                archived: mongoose.trusted({ $ne: true }),
                ypokatasthma: mongoose.trusted({ $in: [...new Set([branch, String(Number(branch))])] }) };
            if (value) filter.kodikos = value;
            else if (search) {
                const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = dropdown.options.searchFields.map(field => ({ [field]: regex }));
            }
            const employees = await employeeModel.find(filter).select(employeeFields)
                .sort(dropdown.options.sort).lean();
            const employeeCounts = new Map();
            for (const employee of employees) employeeCounts.set(employee.kodikos,
                (employeeCounts.get(employee.kodikos) || 0) + 1);
            const codes = [...employeeCounts.keys()].filter(Boolean);
            const history = codes.length ? await historyModel.find({ ...identity,
                kodikos: mongoose.trusted({ $in: codes }) }).select(LIFECYCLE_HISTORY_FIELDS.join(' ')).lean() : [];
            const historyByCode = new Map();
            for (const row of history) {
                if (!historyByCode.has(row.kodikos)) historyByCode.set(row.kodikos, []);
                historyByCode.get(row.kodikos).push(row);
            }
            // Match the existing context loader's legacy duplicate-master rule:
            // each physical relationship keeps its own dates; shared code history
            // cannot be attributed to one duplicate safely. Never join their spans.
            const matching = employees.filter(employee => overlapsPeriod(employee,
                employeeCounts.get(employee.kodikos) === 1
                    ? historyByCode.get(employee.kodikos) || [] : [], period));
            const eligible = [...new Map(matching.map(employee => [employee.kodikos, employee])).values()];
            // Apply pagination after lifecycle resolution, so gaps do not hide later matches.
            const start = value ? 0 : (page - 1) * 50;
            const items = eligible.slice(start, start + (value ? 1 : 50)).map(employee => {
                const publicEmployee = Object.fromEntries(dropdown.options.select.split(' ')
                    .map(field => [field, employee[field]]));
                return dropdown.options.mapItem(publicEmployee);
            });
            return res.json({ items, totalCount: eligible.length,
                hasMore: !value && start + items.length < eligible.length });
        } catch (error) {
            const status = error.status || 500;
            return res.status(status).json({ items: [], code: 'EMPLOYMENT_REVIEW_EMPLOYEE_SELECTION',
                message: 'Η αναζήτηση εργαζομένου δεν ολοκληρώθηκε, επειδή η περίοδος ή το παράρτημα δεν είναι διαθέσιμα ή δεν ήταν δυνατή η ανάκτηση των στοιχείων. '
                    + '1. Ελέγξτε τις δύο ημερομηνίες και το παράρτημα. 2. Επαναλάβετε την αναζήτηση. '
                    + '3. Αν το πρόβλημα παραμένει, επικοινωνήστε με την υποστήριξη. Καμία αλλαγή δεν αποθηκεύτηκε. '
                    + 'Κωδικός αναφοράς: EMPLOYMENT_REVIEW_EMPLOYEE_SELECTION' });
        }
    };
}

module.exports = { createHandler, validateQuery, overlapsPeriod };
