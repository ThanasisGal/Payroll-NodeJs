const phaseDetectorService = require('./phaseDetectorService');
const { ApasxolhseisPeriodFactsModel } = require('../../models/kinhseis');

const ALLOWED_SCOPES = new Set(['MONTHLY', 'TERMINATION', 'MANUAL']);
const SOURCE_VERSION = 'workFactsPrecalc:v1';
const HOURS_FIELDS = [
    'workingHours',
    'absenceHours',
    'nightHours',
    'holidayHours',
    'yperergasiaHours',
    'nomimiYperoriaHours',
    'paranomiYperoriaHours',
    'sixthDayHours',
    'prosthetiErgasiaHours'
];

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function toNumberOrZero(value) {
    if (value === null || value === undefined || value === '') return 0;

    const n = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
}

function roundHours(value) {
    return +toNumberOrZero(value).toFixed(4);
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

function dateOnlyUTC(value) {
    const date = parseDateOnlyUTC(value);
    return date ? date : null;
}

function normalizeScope(scope, warnings) {
    const normalizedScope = toTrimmedString(scope).toUpperCase();

    if (ALLOWED_SCOPES.has(normalizedScope)) {
        return normalizedScope;
    }

    warnings.push(
        `Invalid scope "${toTrimmedString(scope)}". Χρησιμοποιήθηκε scope MANUAL.`
    );
    return 'MANUAL';
}

function normalizeScopeValue(scope) {
    const warnings = [];
    return normalizeScope(scope, warnings);
}

function buildFailedPayload({ team, company_kod, kodikos, apo, eos, scope, requestedBy, warnings }) {
    return {
        team: toTrimmedString(team),
        company_kod: toTrimmedString(company_kod),
        kodikos: toTrimmedString(kodikos),
        apo,
        eos,
        scope,
        requestedBy: toTrimmedString(requestedBy),
        status: 'FAILED',
        generatedAt: new Date().toISOString(),
        phases: [],
        phaseSummary: [],
        dailyFacts: [],
        totals: buildEmptyTotals(),
        warnings
    };
}

function buildEmptyTotals() {
    return HOURS_FIELDS.reduce((totals, field) => {
        totals[field] = 0;
        return totals;
    }, {});
}

function hasSourcePhaseNo(operationalPhase, phaseNo) {
    const phaseNumber = Number.parseInt(phaseNo, 10);
    if (!Number.isInteger(phaseNumber)) return false;

    const sourcePhaseNos = Array.isArray(operationalPhase?.sourcePhaseNos)
        ? operationalPhase.sourcePhaseNos
        : [];

    return sourcePhaseNos.map((value) => Number.parseInt(value, 10)).includes(phaseNumber);
}

function isDateInsideOperationalPhase(dateValue, operationalPhase) {
    const date = parseDateOnlyUTC(dateValue);
    const apo = parseDateOnlyUTC(operationalPhase?.apo);
    const eos = parseDateOnlyUTC(operationalPhase?.eos);

    return Boolean(date && apo && eos && date >= apo && date <= eos);
}

function findOperationalPhaseForDay({ phaseNo, day, operationalPhases }) {
    const bySourcePhase = operationalPhases.find((operationalPhase) =>
        hasSourcePhaseNo(operationalPhase, phaseNo)
    );

    if (bySourcePhase) return bySourcePhase;

    return operationalPhases.find((operationalPhase) =>
        isDateInsideOperationalPhase(day?.date, operationalPhase)
    ) || null;
}

function buildOperationalPhaseKey(operationalPhase, phase) {
    if (!operationalPhase) {
        return [
            'diagnostic',
            phase?.phaseNo || 'NA',
            toTrimmedString(phase?.detectedKathestosCode) || 'NA',
            toTrimmedString(phase?.apo) || 'NA',
            toTrimmedString(phase?.eos) || 'NA'
        ].join('|');
    }

    return [
        'operational',
        operationalPhase.phaseNo || 'NA',
        toTrimmedString(operationalPhase.detectedKathestosCode || operationalPhase.kathestosCode) ||
            'NA',
        toTrimmedString(operationalPhase.apo) || 'NA',
        toTrimmedString(operationalPhase.eos) || 'NA'
    ].join('|');
}

function buildBaseDailyFacts({ detectorResult }) {
    const phases = Array.isArray(detectorResult?.phases) ? detectorResult.phases : [];
    const operationalPhases = Array.isArray(detectorResult?.operationalPhases)
        ? detectorResult.operationalPhases
        : [];

    return phases.flatMap((phase) => {
        const diagnosticPhaseNo = phase?.phaseNo || null;
        const dailyRows = Array.isArray(phase?.daily) ? phase.daily : [];

        return dailyRows.map((day) => {
            const operationalPhase = findOperationalPhaseForDay({
                phaseNo: diagnosticPhaseNo,
                day,
                operationalPhases
            });
            const effectiveKathestosCode = toTrimmedString(
                operationalPhase?.detectedKathestosCode ||
                    operationalPhase?.kathestosCode ||
                    phase?.detectedKathestosCode
            );
            const effectiveKathestos = toTrimmedString(
                operationalPhase?.detectedKathestos || phase?.detectedKathestos
            );

            return {
                date: toTrimmedString(day?.date),
                phaseKey: buildOperationalPhaseKey(operationalPhase, phase),
                phaseNo: diagnosticPhaseNo,
                diagnosticPhaseNo,
                operationalPhaseNo: operationalPhase?.phaseNo || null,
                effectiveKathestosCode,
                effectiveKathestos,
                source: operationalPhase ? 'OPERATIONAL_PHASE' : 'DIAGNOSTIC_PHASE_FALLBACK',
                workingHours: roundHours(day?.payHours ?? day?.hours),
                absenceHours: roundHours(day?.absenceHours),
                nightHours: roundHours(day?.nightHours),
                holidayHours: roundHours(day?.holidayHours),
                yperergasiaHours: roundHours(day?.yperergasiaHours),
                nomimiYperoriaHours: roundHours(day?.nomimiYperoriaHours),
                paranomiYperoriaHours: roundHours(day?.paranomiYperoriaHours),
                sixthDayHours: roundHours(day?.sixthDayHours),
                prosthetiErgasiaHours: roundHours(day?.prosthetiErgasiaHours),
                insuranceExemptionEligible: effectiveKathestosCode === '0',
                warnings: Array.isArray(day?.warnings) ? day.warnings : []
            };
        });
    });
}

function buildPhaseSummary({ dailyFacts, detectorResult }) {
    const operationalPhases = Array.isArray(detectorResult?.operationalPhases)
        ? detectorResult.operationalPhases
        : [];
    const factsByPhaseKey = new Map();

    dailyFacts.forEach((fact) => {
        if (!factsByPhaseKey.has(fact.phaseKey)) {
            factsByPhaseKey.set(fact.phaseKey, []);
        }

        factsByPhaseKey.get(fact.phaseKey).push(fact);
    });

    return operationalPhases
        .map((operationalPhase) => {
            const phaseKey = buildOperationalPhaseKey(operationalPhase);
            const facts = factsByPhaseKey.get(phaseKey) || [];
            if (facts.length === 0) return null;

            const effectiveKathestosCode = toTrimmedString(
                operationalPhase.detectedKathestosCode || operationalPhase.kathestosCode
            );
            const dates = facts.map((fact) => fact.date).filter(Boolean).sort();

            return {
                phaseKey,
                phaseNo: facts[0]?.phaseNo || null,
                operationalPhaseNo: operationalPhase.phaseNo || null,
                apo: dates[0] || toTrimmedString(operationalPhase.apo),
                eos: dates[dates.length - 1] || toTrimmedString(operationalPhase.eos),
                effectiveKathestosCode,
                effectiveKathestos: toTrimmedString(operationalPhase.detectedKathestos),
                source: 'OPERATIONAL_PHASE',
                workingHours: roundHours(
                    facts.reduce((sum, fact) => sum + toNumberOrZero(fact.workingHours), 0)
                ),
                absenceHours: roundHours(
                    facts.reduce((sum, fact) => sum + toNumberOrZero(fact.absenceHours), 0)
                ),
                insuranceExemptionEligible: effectiveKathestosCode === '0',
                warnings: [
                    ...new Set(facts.flatMap((fact) => Array.isArray(fact.warnings)
                        ? fact.warnings
                        : []))
                ]
            };
        })
        .filter(Boolean);
}

function buildTotals(dailyFacts) {
    return dailyFacts.reduce((totals, fact) => {
        HOURS_FIELDS.forEach((field) => {
            totals[field] = roundHours(totals[field] + fact[field]);
        });

        return totals;
    }, buildEmptyTotals());
}

function validateInput({ team, company_kod, kodikos, apo, eos }) {
    const warnings = [];
    const cleanTeam = toTrimmedString(team);
    const cleanCompany = toTrimmedString(company_kod);
    const cleanKodikos = toTrimmedString(kodikos);
    const apoDate = parseDateOnlyUTC(apo);
    const eosDate = parseDateOnlyUTC(eos);

    if (!cleanTeam) warnings.push('Λείπει team.');
    if (!cleanCompany) warnings.push('Λείπει company_kod.');
    if (!cleanKodikos) warnings.push('Λείπει kodikos.');
    if (!apoDate) warnings.push('Το apo δεν είναι έγκυρη ημερομηνία.');
    if (!eosDate) warnings.push('Το eos δεν είναι έγκυρη ημερομηνία.');
    if (apoDate && eosDate && apoDate > eosDate) warnings.push('Το apo πρέπει να είναι <= eos.');

    return {
        isValid: warnings.length === 0,
        warnings,
        team: cleanTeam,
        company_kod: cleanCompany,
        kodikos: cleanKodikos,
        apo: apoDate ? formatDateYMD(apoDate) : toTrimmedString(apo),
        eos: eosDate ? formatDateYMD(eosDate) : toTrimmedString(eos)
    };
}

function normalizeSnapshotKey({ team, company_kod, kodikos, apo, eos, scope = 'MANUAL' }) {
    const input = validateInput({ team, company_kod, kodikos, apo, eos });
    const warnings = [...input.warnings];
    const normalizedScope = normalizeScope(scope, warnings);
    const apoDate = dateOnlyUTC(input.apo);
    const eosDate = dateOnlyUTC(input.eos);

    return {
        isValid: input.isValid && Boolean(apoDate && eosDate),
        warnings,
        team: input.team,
        company_kod: input.company_kod,
        kodikos: input.kodikos,
        apo: apoDate,
        eos: eosDate,
        apoYMD: input.apo,
        eosYMD: input.eos,
        scope: normalizedScope
    };
}

function snapshotQueryFromKey(key) {
    return {
        team: key.team,
        company_kod: key.company_kod,
        kodikos: key.kodikos,
        apo: key.apo,
        eos: key.eos,
        scope: key.scope
    };
}

function normalizeSnapshotForReturn(snapshot, extra = {}) {
    if (!snapshot) return null;

    const plain = typeof snapshot.toObject === 'function' ? snapshot.toObject() : { ...snapshot };

    return {
        ...plain,
        ...extra,
        apo: formatDateYMD(plain.apo),
        eos: formatDateYMD(plain.eos),
        generatedAt: plain.generatedAt instanceof Date
            ? plain.generatedAt.toISOString()
            : plain.generatedAt
    };
}

function buildSnapshotDocument(payload, key) {
    const generatedAtDate = payload.generatedAt
        ? new Date(payload.generatedAt)
        : new Date();

    return {
        team: key.team,
        company_kod: key.company_kod,
        ypokatasthma: toTrimmedString(payload.ypokatasthma),
        kodikos: key.kodikos,
        apo: key.apo,
        eos: key.eos,
        scope: key.scope,
        status: ['READY', 'LOCKED', 'STALE', 'FAILED'].includes(toTrimmedString(payload.status))
            ? toTrimmedString(payload.status)
            : 'FAILED',
        generatedAt: Number.isNaN(generatedAtDate.getTime()) ? new Date() : generatedAtDate,
        generatedBy: toTrimmedString(payload.generatedBy || payload.requestedBy),
        sourceVersion: toTrimmedString(payload.sourceVersion) || SOURCE_VERSION,
        phases: Array.isArray(payload.phases) ? payload.phases : [],
        phaseSummary: Array.isArray(payload.phaseSummary) ? payload.phaseSummary : [],
        dailyFacts: Array.isArray(payload.dailyFacts) ? payload.dailyFacts : [],
        totals: payload.totals && typeof payload.totals === 'object' ? payload.totals : {},
        warnings: Array.isArray(payload.warnings) ? payload.warnings.map(toTrimmedString) : [],
        inputFingerprint: toTrimmedString(payload.inputFingerprint)
    };
}

async function generateWorkFactsForEmployeePeriod({
    team,
    company_kod,
    kodikos,
    apo,
    eos,
    scope = 'MANUAL',
    requestedBy = ''
}) {
    const input = validateInput({ team, company_kod, kodikos, apo, eos });
    const warnings = [...input.warnings];
    const normalizedScope = normalizeScope(scope, warnings);

    if (!input.isValid) {
        return buildFailedPayload({
            team: input.team,
            company_kod: input.company_kod,
            kodikos: input.kodikos,
            apo: input.apo,
            eos: input.eos,
            scope: normalizedScope,
            requestedBy,
            warnings
        });
    }

    try {
        const detectorResult = await phaseDetectorService.detectPayrollPhasesForDateRange({
            team: input.team,
            company_kod: input.company_kod,
            kodikos: input.kodikos,
            apo: input.apo,
            eos: input.eos
        });
        const dailyFacts = buildBaseDailyFacts({ detectorResult });
        const phaseSummary = buildPhaseSummary({ dailyFacts, detectorResult });
        const detectorWarnings = Array.isArray(detectorResult?.warnings)
            ? detectorResult.warnings
            : [];

        return {
            team: input.team,
            company_kod: input.company_kod,
            kodikos: input.kodikos,
            apo: input.apo,
            eos: input.eos,
            scope: normalizedScope,
            requestedBy: toTrimmedString(requestedBy),
            status: 'READY',
            generatedAt: new Date().toISOString(),
            phases: Array.isArray(detectorResult?.phases) ? detectorResult.phases : [],
            phaseSummary,
            dailyFacts,
            totals: buildTotals(dailyFacts),
            warnings: [...warnings, ...detectorWarnings]
        };
    } catch (error) {
        return buildFailedPayload({
            team: input.team,
            company_kod: input.company_kod,
            kodikos: input.kodikos,
            apo: input.apo,
            eos: input.eos,
            scope: normalizedScope,
            requestedBy,
            warnings: [...warnings, error.message || 'Σφάλμα παραγωγής work facts.']
        });
    }
}

async function findWorkFactsSnapshot({ team, company_kod, kodikos, apo, eos, scope = 'MANUAL' }) {
    const key = normalizeSnapshotKey({ team, company_kod, kodikos, apo, eos, scope });

    if (!key.isValid) {
        return null;
    }

    const snapshot = await ApasxolhseisPeriodFactsModel.findOne(snapshotQueryFromKey(key)).lean();
    return normalizeSnapshotForReturn(snapshot);
}

async function saveWorkFactsSnapshot(payload, { force = false } = {}) {
    const key = normalizeSnapshotKey({
        team: payload?.team,
        company_kod: payload?.company_kod,
        kodikos: payload?.kodikos,
        apo: payload?.apo,
        eos: payload?.eos,
        scope: payload?.scope
    });

    if (!key.isValid) {
        const error = new Error(`Invalid work facts snapshot key: ${key.warnings.join(' ')}`);
        error.statusCode = 400;
        throw error;
    }

    const query = snapshotQueryFromKey(key);
    const existing = await ApasxolhseisPeriodFactsModel.findOne(query).lean();

    if (existing?.locked === true && force !== true) {
        return normalizeSnapshotForReturn(existing, {
            saveStatus: 'LOCKED_SKIPPED',
            warnings: [
                ...new Set([
                    ...(Array.isArray(existing.warnings) ? existing.warnings : []),
                    'LOCKED_SNAPSHOT_SKIPPED: Το snapshot είναι locked και δεν έγινε overwrite.'
                ])
            ]
        });
    }

    const snapshotDocument = buildSnapshotDocument(payload, key);

    if (force === true && existing?.locked === true) {
        snapshotDocument.locked = false;
        snapshotDocument.lockedAt = undefined;
        snapshotDocument.lockedBy = '';
        snapshotDocument.lockReason = '';
    }

    const saved = await ApasxolhseisPeriodFactsModel.findOneAndUpdate(
        query,
        {
            $set: snapshotDocument,
            $setOnInsert: {
                locked: false
            }
        },
        {
            upsert: true,
            returnDocument: 'after',
            runValidators: true,
            setDefaultsOnInsert: true
        }
    ).lean();

    return normalizeSnapshotForReturn(saved, {
        saveStatus: existing ? 'UPDATED' : 'CREATED'
    });
}

async function generateAndSaveWorkFactsForEmployeePeriod({
    team,
    company_kod,
    kodikos,
    apo,
    eos,
    scope = 'MANUAL',
    requestedBy = '',
    force = false
}) {
    const normalizedScope = normalizeScopeValue(scope);
    const key = normalizeSnapshotKey({
        team,
        company_kod,
        kodikos,
        apo,
        eos,
        scope: normalizedScope
    });

    if (key.isValid) {
        const existing = await ApasxolhseisPeriodFactsModel.findOne(snapshotQueryFromKey(key)).lean();

        if (existing?.locked === true && force !== true) {
            return normalizeSnapshotForReturn(existing, {
                saveStatus: 'LOCKED_SKIPPED',
                warnings: [
                    ...new Set([
                        ...(Array.isArray(existing.warnings) ? existing.warnings : []),
                        'LOCKED_SNAPSHOT_SKIPPED: Το snapshot είναι locked και δεν έγινε overwrite.'
                    ])
                ]
            });
        }
    }

    const payload = await generateWorkFactsForEmployeePeriod({
        team,
        company_kod,
        kodikos,
        apo,
        eos,
        scope: normalizedScope,
        requestedBy
    });

    return saveWorkFactsSnapshot(
        {
            ...payload,
            generatedBy: requestedBy,
            sourceVersion: SOURCE_VERSION
        },
        { force }
    );
}

module.exports = {
    generateWorkFactsForEmployeePeriod,
    generateAndSaveWorkFactsForEmployeePeriod,
    findWorkFactsSnapshot,
    saveWorkFactsSnapshot
};
