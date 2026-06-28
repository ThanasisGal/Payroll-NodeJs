const mongoose = require('mongoose');

const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { PayrollPrecalcJobModel } = require('../../models/kinhseis');
const {
    generateAndSaveWorkFactsForEmployeePeriod
} = require('./workFactsPrecalcService');

const ALLOWED_SCOPES = new Set(['MONTHLY', 'TERMINATION', 'MANUAL']);
const SOURCE_VERSION = 'workFactsPrecalc:v1';
const COMPANY_WIDE_JOB_KEY_YP = 'ALL';

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

function normalizeScope(scope, warnings) {
    const normalizedScope = toTrimmedString(scope).toUpperCase();

    if (ALLOWED_SCOPES.has(normalizedScope)) {
        return normalizedScope;
    }

    warnings.push(`Invalid scope "${toTrimmedString(scope)}". Χρησιμοποιήθηκε scope MONTHLY.`);
    return 'MONTHLY';
}

function normalizeKodikoi(kodikoi) {
    if (!Array.isArray(kodikoi)) return [];

    return [...new Set(kodikoi.map(toTrimmedString).filter(Boolean))];
}

function validateBatchInput({ team, company_kod, apo, eos, scope }) {
    const warnings = [];
    const cleanTeam = toTrimmedString(team);
    const cleanCompany = toTrimmedString(company_kod);
    const apoDate = parseDateOnlyUTC(apo);
    const eosDate = parseDateOnlyUTC(eos);
    const normalizedScope = normalizeScope(scope, warnings);

    if (!cleanTeam) warnings.push('Λείπει team.');
    if (!cleanCompany) warnings.push('Λείπει company_kod.');
    if (!apoDate) warnings.push('Το apo δεν είναι έγκυρη ημερομηνία.');
    if (!eosDate) warnings.push('Το eos δεν είναι έγκυρη ημερομηνία.');
    if (apoDate && eosDate && apoDate > eosDate) warnings.push('Το apo πρέπει να είναι <= eos.');

    return {
        isValid: warnings.length === 0,
        warnings,
        team: cleanTeam,
        company_kod: cleanCompany,
        apo: apoDate,
        eos: eosDate,
        apoYMD: apoDate ? formatDateYMD(apoDate) : toTrimmedString(apo),
        eosYMD: eosDate ? formatDateYMD(eosDate) : toTrimmedString(eos),
        scope: normalizedScope
    };
}

function normalizeYpokatasthmaForJobKey(ypokatasthma) {
    return toTrimmedString(ypokatasthma) || COMPANY_WIDE_JOB_KEY_YP;
}

function buildJobKey({ team, company_kod, ypokatasthma, apoYMD, eosYMD, scope }) {
    return [
        team,
        company_kod,
        normalizeYpokatasthmaForJobKey(ypokatasthma),
        apoYMD,
        eosYMD,
        scope
    ].join('|');
}

function normalizeJobForReturn(job, extra = {}) {
    if (!job) return null;

    const plain = typeof job.toObject === 'function' ? job.toObject() : { ...job };

    return {
        ...plain,
        ...extra,
        apo: formatDateYMD(plain.apo),
        eos: formatDateYMD(plain.eos),
        startedAt: plain.startedAt instanceof Date ? plain.startedAt.toISOString() : plain.startedAt,
        finishedAt: plain.finishedAt instanceof Date
            ? plain.finishedAt.toISOString()
            : plain.finishedAt
    };
}

function buildEmployeeQuery({ team, company_kod, apo, eos, ypokatasthma, kodikoi }) {
    const query = {
        team,
        company_kod,
        hmeromhnia_proslhpshs: mongoose.trusted({ $lte: eos }),
        $or: mongoose.trusted([
            { hmeromhnia_apoxorhshs: null },
            { hmeromhnia_apoxorhshs: mongoose.trusted({ $gte: apo }) }
        ])
    };

    const cleanYpokatasthma = toTrimmedString(ypokatasthma);
    if (cleanYpokatasthma) {
        query.ypokatasthma = cleanYpokatasthma;
    }

    if (kodikoi.length > 0) {
        query.kodikos = mongoose.trusted({ $in: kodikoi });
    }

    return query;
}

async function loadEmployeesForBatch({ team, company_kod, apo, eos, ypokatasthma, kodikoi }) {
    return ErgazomenoiModel.find(
        buildEmployeeQuery({ team, company_kod, apo, eos, ypokatasthma, kodikoi })
    )
        .select('kodikos ypokatasthma hmeromhnia_proslhpshs hmeromhnia_apoxorhshs')
        .sort({ kodikos: 1 })
        .lean();
}

async function markJobRunning({ key, jobKey, requestedBy, force, ypokatasthma }) {
    const runningFields = {
        team: key.team,
        company_kod: key.company_kod,
        ypokatasthma: toTrimmedString(ypokatasthma),
        apo: key.apo,
        eos: key.eos,
        scope: key.scope,
        status: 'RUNNING',
        requestedBy: toTrimmedString(requestedBy),
        startedAt: new Date(),
        finishedAt: null,
        employeesTotal: 0,
        employeesDone: 0,
        employeesSkipped: 0,
        employeesFailed: 0,
        processedKodikos: [],
        failedEmployees: [],
        warnings: [],
        errorMessage: '',
        force: force === true,
        sourceVersion: SOURCE_VERSION
    };

    const reusableJob = await PayrollPrecalcJobModel.findOneAndUpdate(
        {
            jobKey,
            status: mongoose.trusted({ $ne: 'RUNNING' })
        },
        { $set: runningFields },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).lean();

    if (reusableJob) {
        return {
            skipped: false,
            job: normalizeJobForReturn(reusableJob, { batchStatus: 'RUNNING' })
        };
    }

    const existingJob = await PayrollPrecalcJobModel.findOne({ jobKey }).lean();

    if (existingJob) {
        return {
            skipped: true,
            job: normalizeJobForReturn(existingJob, {
                batchStatus: 'RUNNING_SKIPPED',
                warnings: [
                    ...new Set([
                        ...(Array.isArray(existingJob.warnings) ? existingJob.warnings : []),
                        'RUNNING_JOB_SKIPPED: Υπάρχει ήδη RUNNING job για το ίδιο διάστημα.'
                    ])
                ]
            })
        };
    }

    let job;
    try {
        job = await PayrollPrecalcJobModel.create({
            ...runningFields,
            jobKey
        });
    } catch (error) {
        if (error?.code !== 11000) throw error;

        const duplicateJob = await PayrollPrecalcJobModel.findOne({ jobKey }).lean();
        return {
            skipped: true,
            job: normalizeJobForReturn(duplicateJob, {
                batchStatus: 'RUNNING_SKIPPED',
                warnings: [
                    ...new Set([
                        ...(Array.isArray(duplicateJob?.warnings) ? duplicateJob.warnings : []),
                        'RUNNING_JOB_SKIPPED: Δημιουργήθηκε ταυτόχρονα job με ίδιο jobKey.'
                    ])
                ]
            })
        };
    }

    return {
        skipped: false,
        job: normalizeJobForReturn(job, { batchStatus: 'RUNNING' })
    };
}

async function finishJob({ jobKey, update }) {
    const job = await PayrollPrecalcJobModel.findOneAndUpdate(
        { jobKey },
        {
            $set: {
                ...update,
                finishedAt: new Date()
            }
        },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).lean();

    return normalizeJobForReturn(job, { batchStatus: update.status });
}

async function generateWorkFactsForCompanyPeriod({
    team,
    company_kod,
    apo,
    eos,
    scope = 'MONTHLY',
    requestedBy = '',
    force = false,
    ypokatasthma = '',
    kodikoi = []
}) {
    const key = validateBatchInput({ team, company_kod, apo, eos, scope });

    if (!key.isValid) {
        return {
            batchStatus: 'FAILED',
            status: 'FAILED',
            warnings: key.warnings,
            employeesTotal: 0,
            employeesDone: 0,
            employeesSkipped: 0,
            employeesFailed: 0,
            processedKodikos: [],
            failedEmployees: []
        };
    }

    const cleanYpokatasthma = toTrimmedString(ypokatasthma);
    const cleanKodikoi = normalizeKodikoi(kodikoi);
    const jobKey = buildJobKey({ ...key, ypokatasthma: cleanYpokatasthma });
    const runningJob = await markJobRunning({
        key,
        jobKey,
        requestedBy,
        force,
        ypokatasthma: cleanYpokatasthma
    });

    if (runningJob.skipped) {
        return runningJob.job;
    }

    const warnings = [];
    const processedKodikos = [];
    const failedEmployees = [];
    let employeesDone = 0;
    let employeesSkipped = 0;
    let employeesFailed = 0;

    try {
        const employees = await loadEmployeesForBatch({
            team: key.team,
            company_kod: key.company_kod,
            apo: key.apo,
            eos: key.eos,
            ypokatasthma: cleanYpokatasthma,
            kodikoi: cleanKodikoi
        });

        for (const employee of employees) {
            const kodikos = toTrimmedString(employee.kodikos);
            if (!kodikos) {
                employeesSkipped += 1;
                warnings.push('SKIPPED_EMPLOYEE_WITHOUT_KODIKOS');
                continue;
            }

            try {
                const snapshot = await generateAndSaveWorkFactsForEmployeePeriod({
                    team: key.team,
                    company_kod: key.company_kod,
                    kodikos,
                    apo: key.apoYMD,
                    eos: key.eosYMD,
                    scope: key.scope,
                    requestedBy,
                    force
                });

                processedKodikos.push(kodikos);

                if (snapshot?.saveStatus === 'LOCKED_SKIPPED') {
                    employeesSkipped += 1;
                    warnings.push(`LOCKED_SKIPPED:${kodikos}`);
                    continue;
                }

                if (snapshot?.status === 'FAILED') {
                    employeesFailed += 1;
                    failedEmployees.push({
                        kodikos,
                        errorMessage: Array.isArray(snapshot.warnings)
                            ? snapshot.warnings.join(' | ')
                            : 'FAILED snapshot'
                    });
                    continue;
                }

                employeesDone += 1;
            } catch (error) {
                employeesFailed += 1;
                failedEmployees.push({
                    kodikos,
                    errorMessage: error.message || 'Σφάλμα παραγωγής snapshot εργαζομένου.'
                });
            }
        }

        if (employees.length === 0) {
            warnings.push('Δεν βρέθηκαν εργαζόμενοι που τέμνουν το ζητούμενο διάστημα.');
        }

        if (employeesFailed > 0 && employeesFailed < employees.length) {
            warnings.push('PARTIAL_FAILURE: Κάποιοι εργαζόμενοι απέτυχαν, το job σημειώθηκε SUCCESS.');
        }

        const finalStatus = employees.length > 0 && employeesFailed === employees.length
            ? 'FAILED'
            : 'SUCCESS';

        return finishJob({
            jobKey,
            update: {
                status: finalStatus,
                employeesTotal: employees.length,
                employeesDone,
                employeesSkipped,
                employeesFailed,
                processedKodikos,
                failedEmployees,
                warnings,
                errorMessage: finalStatus === 'FAILED'
                    ? 'Απέτυχαν όλοι οι εργαζόμενοι του batch.'
                    : ''
            }
        });
    } catch (error) {
        return finishJob({
            jobKey,
            update: {
                status: 'FAILED',
                employeesTotal: 0,
                employeesDone,
                employeesSkipped,
                employeesFailed,
                processedKodikos,
                failedEmployees,
                warnings,
                errorMessage: error.message || 'Σφάλμα batch παραγωγής work facts.'
            }
        });
    }
}

module.exports = {
    generateWorkFactsForCompanyPeriod
};
