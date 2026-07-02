const mongoose = require('mongoose');

const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const {
    detectPayrollPhasesForDateRange
} = require('./phaseDetectorService');

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function parseDateOnlyUTC(value) {
    const raw = toTrimmedString(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

    const [year, month, day] = raw.split('-').map((part) => Number.parseInt(part, 10));
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
}

function formatDateYMD(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function normalizeDateParam(value) {
    const parsed = parseDateOnlyUTC(value);
    return parsed ? formatDateYMD(parsed) : '';
}

function buildPeriodMetadata(period, apo, eos) {
    if (period && typeof period === 'object' && !Array.isArray(period)) {
        return {
            ...period,
            apo,
            eos
        };
    }

    return {
        value: toTrimmedString(period),
        apo,
        eos
    };
}

function buildEmployeeScopeQuery({
    team,
    company_kod,
    apoDate,
    eosDate,
    employeeId,
    ypokatasthma
}) {
    const query = {
        team,
        company_kod,
        hmeromhnia_proslhpshs: mongoose.trusted({ $lte: eosDate }),
        $or: mongoose.trusted([
            { hmeromhnia_apoxorhshs: null },
            { hmeromhnia_apoxorhshs: mongoose.trusted({ $gte: apoDate }) }
        ])
    };

    const cleanEmployeeId = toTrimmedString(employeeId);
    if (cleanEmployeeId) {
        if (mongoose.Types.ObjectId.isValid(cleanEmployeeId)) {
            query._id = cleanEmployeeId;
        } else {
            query.kodikos = cleanEmployeeId;
        }
    }

    const cleanYpokatasthma = toTrimmedString(ypokatasthma);
    if (cleanYpokatasthma) {
        query.ypokatasthma = cleanYpokatasthma;
    }

    return query;
}

async function loadEmployeesForPreview({
    team,
    company_kod,
    apoDate,
    eosDate,
    employeeId,
    ypokatasthma
}) {
    return ErgazomenoiModel.find(
        buildEmployeeScopeQuery({
            team,
            company_kod,
            apoDate,
            eosDate,
            employeeId,
            ypokatasthma
        })
    )
        .select('_id kodikos eponymo onoma ypokatasthma hmeromhnia_proslhpshs hmeromhnia_apoxorhshs')
        .sort({ kodikos: 1 })
        .lean();
}

function getPhaseLabel(operationalPhase = {}) {
    return toTrimmedString(
        operationalPhase.detectedKathestos ||
            operationalPhase.kathestos ||
            operationalPhase.detectedKathestosCode ||
            operationalPhase.kathestosCode ||
            'UNKNOWN'
    );
}

function getEmploymentType(operationalPhase = {}) {
    return toTrimmedString(
        operationalPhase.detectedKathestosCode ||
            operationalPhase.kathestosCode ||
            operationalPhase.detectedKathestos ||
            operationalPhase.kathestos ||
            'UNKNOWN'
    );
}

function buildPhaseKey(operationalPhase = {}) {
    return [
        'operational',
        operationalPhase.phaseNo || 'NA',
        getEmploymentType(operationalPhase),
        toTrimmedString(operationalPhase.apo) || 'NA',
        toTrimmedString(operationalPhase.eos) || 'NA'
    ].join('|');
}

function buildPrintPhaseKey(operationalPhase = {}) {
    return [
        'print',
        getEmploymentType(operationalPhase)
    ].join('|');
}

function normalizeOperationalPhases(detectorResult = {}) {
    return (Array.isArray(detectorResult.operationalPhases)
        ? detectorResult.operationalPhases
        : []
    )
        .filter((phase) => toTrimmedString(phase?.apo) && toTrimmedString(phase?.eos))
        .sort((a, b) => {
            const aApo = toTrimmedString(a.apo);
            const bApo = toTrimmedString(b.apo);
            if (aApo !== bApo) return aApo.localeCompare(bApo);

            const aEos = toTrimmedString(a.eos);
            const bEos = toTrimmedString(b.eos);
            if (aEos !== bEos) return aEos.localeCompare(bEos);

            return Number(a.phaseNo || 0) - Number(b.phaseNo || 0);
        });
}

function buildCalculationUnits({ operationalPhases }) {
    return operationalPhases.map((operationalPhase, index) => {
        const fallbackAa = index + 1;
        const aaMisthodosias = operationalPhase.aa_misthodosias || fallbackAa;

        return {
            aa_misthodosias: String(aaMisthodosias),
            fromDate: toTrimmedString(operationalPhase.apo),
            toDate: toTrimmedString(operationalPhase.eos),
            phaseKey: buildPhaseKey(operationalPhase),
            phaseLabel: getPhaseLabel(operationalPhase),
            employmentType: getEmploymentType(operationalPhase),
            printPhaseKey: buildPrintPhaseKey(operationalPhase),
            source: 'operationalPhase',
            sourceIds: {
                operationalPhaseNo: operationalPhase.phaseNo || null,
                sourcePhaseNos: Array.isArray(operationalPhase.sourcePhaseNos)
                    ? operationalPhase.sourcePhaseNos
                    : []
            }
        };
    });
}

function buildPrintGroups(units) {
    const groups = new Map();

    units.forEach((unit) => {
        if (!groups.has(unit.printPhaseKey)) {
            groups.set(unit.printPhaseKey, {
                printPhaseKey: unit.printPhaseKey,
                phaseLabel: unit.phaseLabel,
                aa_misthodosiasList: [],
                intervalsCount: 0
            });
        }

        const group = groups.get(unit.printPhaseKey);
        group.aa_misthodosiasList.push(unit.aa_misthodosias);
        group.intervalsCount += 1;
    });

    return Array.from(groups.values());
}

function buildEmployeeName(employee = {}) {
    return [employee.eponymo, employee.onoma].map(toTrimmedString).filter(Boolean).join(' ');
}

async function buildEmployeePreview({ employee, input, apo, eos, warnings }) {
    const kodikos = toTrimmedString(employee?.kodikos);

    if (!kodikos) {
        warnings.push('EMPLOYEE_SKIPPED_MISSING_KODIKOS: Παραλείφθηκε εργαζόμενος χωρίς κωδικό.');
        return null;
    }

    const detectorResult = await detectPayrollPhasesForDateRange({
        team: input.team,
        company_kod: input.company_kod,
        kodikos,
        ypokatasthma: input.ypokatasthma,
        apo,
        eos
    });
    const detectorWarnings = Array.isArray(detectorResult?.warnings)
        ? detectorResult.warnings
        : [];
    detectorWarnings.forEach((warning) => {
        warnings.push(`EMPLOYEE:${kodikos}:${warning}`);
    });

    const operationalPhases = normalizeOperationalPhases(detectorResult);
    const units = buildCalculationUnits({ operationalPhases });
    const printGroups = buildPrintGroups(units);

    return {
        employeeId: employee?._id ? String(employee._id) : '',
        kodikos,
        fullName: buildEmployeeName(employee),
        calculationUnitsCount: units.length,
        saveOperationsCount: units.length,
        printGroupsCount: printGroups.length,
        units: units.map(({ printPhaseKey, ...unit }) => unit),
        printGroups
    };
}

function buildGroupsByPhase(employees) {
    const groups = new Map();

    employees.forEach((employee) => {
        employee.printGroups.forEach((printGroup) => {
            if (!groups.has(printGroup.printPhaseKey)) {
                groups.set(printGroup.printPhaseKey, {
                    printPhaseKey: printGroup.printPhaseKey,
                    phaseLabel: printGroup.phaseLabel,
                    employeeIds: new Set(),
                    calculationUnitsCount: 0,
                    printGroupsCount: 0
                });
            }

            const group = groups.get(printGroup.printPhaseKey);
            group.employeeIds.add(employee.employeeId || employee.kodikos);
            group.calculationUnitsCount += printGroup.intervalsCount;
            group.printGroupsCount += 1;
        });
    });

    return Array.from(groups.values()).map((group) => ({
        printPhaseKey: group.printPhaseKey,
        phaseLabel: group.phaseLabel,
        employeesCount: group.employeeIds.size,
        calculationUnitsCount: group.calculationUnitsCount,
        printGroupsCount: group.printGroupsCount
    }));
}

function validatePreviewInput(input = {}) {
    const warnings = [];
    const team = toTrimmedString(input.team);
    const company_kod = toTrimmedString(input.company_kod);
    const apo = normalizeDateParam(input.apoDate);
    const eos = normalizeDateParam(input.eosDate);
    const apoDate = parseDateOnlyUTC(apo);
    const eosDate = parseDateOnlyUTC(eos);

    if (!team) warnings.push('Λείπει team.');
    if (!company_kod) warnings.push('Λείπει company_kod.');
    if (!apo || !apoDate) warnings.push('Το apoDate δεν είναι έγκυρη ημερομηνία.');
    if (!eos || !eosDate) warnings.push('Το eosDate δεν είναι έγκυρη ημερομηνία.');
    if (apoDate && eosDate && apoDate > eosDate) {
        warnings.push('Το apoDate πρέπει να είναι μικρότερο ή ίσο από το eosDate.');
    }

    return {
        isValid: warnings.length === 0,
        warnings,
        team,
        company_kod,
        apo,
        eos,
        apoDate,
        eosDate,
        employeeId: toTrimmedString(input.employeeId),
        ypokatasthma: toTrimmedString(input.ypokatasthma),
        period: buildPeriodMetadata(input.period, apo, eos)
    };
}

async function buildPayrollCalculationUnitsPreview(input = {}) {
    const validated = validatePreviewInput(input);

    if (!validated.isValid) {
        const error = new Error('Λείπουν ή δεν είναι έγκυρα στοιχεία για το preview.');
        error.statusCode = 400;
        error.warnings = validated.warnings;
        throw error;
    }

    const warnings = [];
    const employeesForScope = await loadEmployeesForPreview(validated);
    const employees = [];

    for (const employee of employeesForScope) {
        const preview = await buildEmployeePreview({
            employee,
            input: validated,
            apo: validated.apo,
            eos: validated.eos,
            warnings
        });

        if (preview) employees.push(preview);
    }

    if (employees.length === 0) {
        warnings.push('Δεν βρέθηκαν εργαζόμενοι για το ζητούμενο scope.');
    }

    const groupsByPhase = buildGroupsByPhase(employees);
    const calculationUnitsCount = employees.reduce(
        (sum, employee) => sum + employee.calculationUnitsCount,
        0
    );
    const printGroupsCount = employees.reduce(
        (sum, employee) => sum + employee.printGroupsCount,
        0
    );

    return {
        success: true,
        isPreviewOnly: true,
        period: validated.period,
        totals: {
            employeesCount: employees.length,
            calculationUnitsCount,
            saveOperationsCount: calculationUnitsCount,
            printGroupsCount
        },
        employees,
        groupsByPhase,
        warnings
    };
}

module.exports = {
    buildPayrollCalculationUnitsPreview
};
