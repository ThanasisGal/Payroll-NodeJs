const mongoose = require('mongoose');

const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { PayrollPrecalcJobModel } = require('../../models/kinhseis');
const {
    generateAndSaveWorkFactsForEmployeePeriod,
    findWorkFactsSnapshot
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

function normalizeOptionalPositiveInteger(value, fieldName, warnings) {
    if (value === undefined || value === null || value === '') return null;

    const raw = String(value).trim();
    if (!/^\d+$/.test(raw)) {
        warnings.push(`Το ${fieldName} πρέπει να είναι θετικός ακέραιος.`);
        return null;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        warnings.push(`Το ${fieldName} πρέπει να είναι θετικός ακέραιος.`);
        return null;
    }

    return parsed;
}

function resolveEmployeeLimit({ limit, maxEmployees, warnings }) {
    const cleanLimit = normalizeOptionalPositiveInteger(limit, 'limit', warnings);
    const cleanMaxEmployees = normalizeOptionalPositiveInteger(
        maxEmployees,
        'maxEmployees',
        warnings
    );
    const candidates = [cleanLimit, cleanMaxEmployees].filter((value) => value !== null);

    return candidates.length > 0 ? Math.min(...candidates) : null;
}

function validateBatchInput({ team, company_kod, apo, eos, scope, limit, maxEmployees }) {
    const warnings = [];
    const cleanTeam = toTrimmedString(team);
    const cleanCompany = toTrimmedString(company_kod);
    const apoDate = parseDateOnlyUTC(apo);
    const eosDate = parseDateOnlyUTC(eos);
    const normalizedScope = normalizeScope(scope, warnings);
    const employeeLimit = resolveEmployeeLimit({ limit, maxEmployees, warnings });

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
        scope: normalizedScope,
        employeeLimit
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

function normalizeBatchJobForStatus(job) {
    const normalized = normalizeJobForReturn(job);
    if (!normalized) return null;

    return {
        id: normalized._id ? String(normalized._id) : '',
        jobKey: normalized.jobKey || '',
        status: normalized.status || '',
        scope: normalized.scope || '',
        apo: normalized.apo || '',
        eos: normalized.eos || '',
        ypokatasthma: normalized.ypokatasthma || '',
        startedAt: normalized.startedAt || null,
        finishedAt: normalized.finishedAt || null,
        employeesTotal: normalized.employeesTotal || 0,
        employeesDone: normalized.employeesDone || 0,
        employeesSkipped: normalized.employeesSkipped || 0,
        employeesFailed: normalized.employeesFailed || 0,
        processedKodikos: Array.isArray(normalized.processedKodikos)
            ? normalized.processedKodikos
            : [],
        failedEmployees: Array.isArray(normalized.failedEmployees)
            ? normalized.failedEmployees
            : [],
        warnings: Array.isArray(normalized.warnings) ? normalized.warnings : [],
        errorMessage: normalized.errorMessage || ''
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

async function loadEmployeesForBatch({
    team,
    company_kod,
    apo,
    eos,
    ypokatasthma,
    kodikoi,
    limit
}) {
    const query = ErgazomenoiModel.find(
        buildEmployeeQuery({ team, company_kod, apo, eos, ypokatasthma, kodikoi })
    )
        .select('kodikos ypokatasthma hmeromhnia_proslhpshs hmeromhnia_apoxorhshs')
        .sort({ kodikos: 1 });

    if (limit !== null) {
        query.limit(limit);
    }

    return query.lean();
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

async function updateJobProgress({ jobKey, progress }) {
    const job = await PayrollPrecalcJobModel.findOneAndUpdate(
        { jobKey },
        { $set: progress },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).lean();

    return normalizeJobForReturn(job, { batchStatus: job?.status });
}

function snapshotYpokatasthmaMatches(snapshot, ypokatasthma) {
    const requestedYpokatasthma = toTrimmedString(ypokatasthma);
    const snapshotYpokatasthma = toTrimmedString(snapshot?.ypokatasthma);

    if (!requestedYpokatasthma) return true;
    if (!snapshotYpokatasthma) return true;

    return snapshotYpokatasthma === requestedYpokatasthma;
}

function buildBaseBatchResult({
    success,
    job,
    jobKey,
    status,
    dryRun,
    key,
    ypokatasthma,
    totals,
    items,
    warnings,
    failedEmployees
}) {
    return {
        success,
        batchStatus: status,
        jobId: job?._id ? String(job._id) : '',
        jobKey,
        status,
        dryRun,
        scope: key.scope,
        apo: key.apoYMD,
        eos: key.eosYMD,
        ypokatasthma,
        totals,
        items,
        warnings,
        failedEmployees,
        employeesTotal: totals.eligible,
        employeesDone: totals.generated,
        employeesSkipped: totals.reused + totals.locked + totals.skippedExistingReady,
        employeesFailed: totals.failed,
        processedKodikos: items.map((item) => item.kodikos).filter(Boolean)
    };
}

function buildFailedBatchResult({ key, jobKey = '', dryRun = false, warnings }) {
    const totals = {
        eligible: 0,
        generated: 0,
        reused: 0,
        locked: 0,
        skippedExistingReady: 0,
        failed: 0
    };

    return buildBaseBatchResult({
        success: false,
        job: null,
        jobKey,
        status: 'FAILED',
        dryRun,
        key,
        ypokatasthma: '',
        totals,
        items: [],
        warnings,
        failedEmployees: []
    });
}

function buildBatchRunContext({
    team,
    company_kod,
    apo,
    eos,
    scope,
    ypokatasthma,
    kodikoi,
    limit,
    maxEmployees,
    dryRun
}) {
    const key = validateBatchInput({ team, company_kod, apo, eos, scope, limit, maxEmployees });

    if (!key.isValid) {
        return {
            isValid: false,
            result: buildFailedBatchResult({
                key,
                dryRun: dryRun === true,
                warnings: key.warnings
            })
        };
    }

    const cleanYpokatasthma = toTrimmedString(ypokatasthma);
    const cleanKodikoi = normalizeKodikoi(kodikoi);
    const jobKey = buildJobKey({ ...key, ypokatasthma: cleanYpokatasthma });

    return {
        isValid: true,
        key,
        cleanYpokatasthma,
        cleanKodikoi,
        jobKey
    };
}

async function startWorkFactsBatchJob({
    team,
    company_kod,
    apo,
    eos,
    scope = 'MONTHLY',
    requestedBy = '',
    force = false,
    ypokatasthma = '',
    kodikoi = [],
    dryRun = false,
    limit = null,
    maxEmployees = null
}) {
    const context = buildBatchRunContext({
        team,
        company_kod,
        apo,
        eos,
        scope,
        ypokatasthma,
        kodikoi,
        limit,
        maxEmployees,
        dryRun
    });

    if (!context.isValid) {
        return {
            success: false,
            statusCode: 400,
            reason: 'invalid_batch_input',
            result: context.result
        };
    }

    const runningJob = await markJobRunning({
        key: context.key,
        jobKey: context.jobKey,
        requestedBy,
        force,
        ypokatasthma: context.cleanYpokatasthma
    });

    return {
        success: true,
        alreadyRunning: runningJob.skipped === true,
        job: runningJob.job,
        jobKey: context.jobKey
    };
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
    kodikoi = [],
    reuseExistingReady = true,
    dryRun = false,
    limit = null,
    maxEmployees = null,
    updateProgressEachEmployee = false,
    startedJob = null
}) {
    const context = buildBatchRunContext({
        team,
        company_kod,
        apo,
        eos,
        scope,
        ypokatasthma,
        kodikoi,
        limit,
        maxEmployees,
        dryRun
    });

    if (!context.isValid) return context.result;

    const {
        key,
        cleanYpokatasthma,
        cleanKodikoi,
        jobKey
    } = context;
    let activeJob = null;
    const hasStartedJob = Boolean(startedJob && startedJob.jobKey === jobKey);

    if (hasStartedJob) {
        activeJob = startedJob;
    } else if (dryRun !== true) {
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

        activeJob = runningJob.job;
    }

    const warnings = [];
    const failedEmployees = [];
    const items = [];
    const totals = {
        eligible: 0,
        generated: 0,
        reused: 0,
        locked: 0,
        skippedExistingReady: 0,
        failed: 0
    };

    try {
        const employees = await loadEmployeesForBatch({
            team: key.team,
            company_kod: key.company_kod,
            apo: key.apo,
            eos: key.eos,
            ypokatasthma: cleanYpokatasthma,
            kodikoi: cleanKodikoi,
            limit: key.employeeLimit
        });
        totals.eligible = employees.length;

        for (const employee of employees) {
            const kodikos = toTrimmedString(employee.kodikos);
            if (!kodikos) {
                totals.failed += 1;
                warnings.push('SKIPPED_EMPLOYEE_WITHOUT_KODIKOS');
                items.push({
                    kodikos: '',
                    status: 'FAILED',
                    reason: 'missing_kodikos',
                    message: 'Λείπει ο κωδικός εργαζομένου.'
                });
                continue;
            }

            try {
                const existingSnapshot = await findWorkFactsSnapshot({
                    team: key.team,
                    company_kod: key.company_kod,
                    kodikos,
                    apo: key.apoYMD,
                    eos: key.eosYMD,
                    scope: key.scope
                });
                const existingStatus = toTrimmedString(existingSnapshot?.status);

                if (existingSnapshot?.locked === true || existingStatus === 'LOCKED') {
                    totals.locked += 1;
                    warnings.push(`LOCKED_SKIPPED:${kodikos}`);
                    items.push({ kodikos, status: 'LOCKED_SKIPPED' });
                    continue;
                }

                if (existingSnapshot && existingStatus === 'READY' && force !== true) {
                    if (!snapshotYpokatasthmaMatches(existingSnapshot, cleanYpokatasthma)) {
                        totals.skippedExistingReady += 1;
                        warnings.push(`SKIPPED_EXISTING_READY_YP_MISMATCH:${kodikos}`);
                        items.push({
                            kodikos,
                            status: 'SKIPPED_EXISTING_READY',
                            reason: 'ypokatasthma_mismatch'
                        });
                        continue;
                    }

                    if (reuseExistingReady === true) {
                        totals.reused += 1;
                        items.push({ kodikos, status: 'REUSED_READY' });
                        continue;
                    }

                    totals.skippedExistingReady += 1;
                    items.push({
                        kodikos,
                        status: 'SKIPPED_EXISTING_READY',
                        reason: 'reuse_existing_ready_disabled'
                    });
                    continue;
                }

                if (dryRun === true) {
                    items.push({ kodikos, status: 'DRY_RUN_GENERATE' });
                    continue;
                }

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

                if (snapshot?.saveStatus === 'LOCKED_SKIPPED') {
                    totals.locked += 1;
                    warnings.push(`LOCKED_SKIPPED:${kodikos}`);
                    items.push({ kodikos, status: 'LOCKED_SKIPPED' });
                    continue;
                }

                if (snapshot?.status === 'FAILED') {
                    totals.failed += 1;
                    failedEmployees.push({
                        kodikos,
                        errorMessage: Array.isArray(snapshot.warnings)
                            ? snapshot.warnings.join(' | ')
                            : 'FAILED snapshot'
                    });
                    items.push({
                        kodikos,
                        status: 'FAILED',
                        message: Array.isArray(snapshot.warnings)
                            ? snapshot.warnings.join(' | ')
                            : 'Η παραγωγή snapshot δεν ολοκληρώθηκε ως READY.'
                    });
                    continue;
                }

                totals.generated += 1;
                items.push({ kodikos, status: 'GENERATED' });
            } catch (error) {
                totals.failed += 1;
                failedEmployees.push({
                    kodikos,
                    errorMessage: error.message || 'Σφάλμα παραγωγής snapshot εργαζομένου.'
                });
                items.push({
                    kodikos,
                    status: 'FAILED',
                    message: error.message || 'Σφάλμα παραγωγής snapshot εργαζομένου.'
                });
            } finally {
                if (dryRun !== true && updateProgressEachEmployee === true) {
                    await updateJobProgress({
                        jobKey,
                        progress: {
                            employeesTotal: totals.eligible,
                            employeesDone: totals.generated,
                            employeesSkipped:
                                totals.reused + totals.locked + totals.skippedExistingReady,
                            employeesFailed: totals.failed,
                            processedKodikos: items
                                .map((item) => item.kodikos)
                                .filter(Boolean),
                            failedEmployees,
                            warnings
                        }
                    });
                }
            }
        }

        if (employees.length === 0) {
            warnings.push('Δεν βρέθηκαν εργαζόμενοι που τέμνουν το ζητούμενο διάστημα.');
        }

        const successfulItems =
            totals.generated + totals.reused + totals.locked + totals.skippedExistingReady;

        if (totals.failed > 0 && successfulItems > 0) {
            warnings.push('PARTIAL_FAILURE: Κάποιοι εργαζόμενοι απέτυχαν, το job σημειώθηκε SUCCESS.');
        }

        const finalStatus = employees.length > 0 && totals.failed === employees.length
            ? 'FAILED'
            : 'SUCCESS';
        const result = buildBaseBatchResult({
            success: finalStatus !== 'FAILED',
            job: activeJob,
            jobKey,
            status: finalStatus,
            dryRun: dryRun === true,
            key,
            ypokatasthma: cleanYpokatasthma,
            totals,
            items,
            warnings,
            failedEmployees
        });

        if (dryRun === true && !activeJob) {
            return result;
        }

        const finishedJob = await finishJob({
            jobKey,
            update: {
                status: finalStatus,
                employeesTotal: totals.eligible,
                employeesDone: totals.generated,
                employeesSkipped: totals.reused + totals.locked + totals.skippedExistingReady,
                employeesFailed: totals.failed,
                processedKodikos: items.map((item) => item.kodikos).filter(Boolean),
                failedEmployees,
                warnings,
                errorMessage: finalStatus === 'FAILED'
                    ? 'Απέτυχαν όλοι οι εργαζόμενοι του batch.'
                    : ''
            }
        });

        return {
            ...finishedJob,
            ...result,
            jobId: finishedJob?._id ? String(finishedJob._id) : result.jobId
        };
    } catch (error) {
        warnings.push(error.message || 'Σφάλμα batch παραγωγής work facts.');

        if (dryRun === true && !activeJob) {
            return buildBaseBatchResult({
                success: false,
                job: null,
                jobKey,
                status: 'FAILED',
                dryRun: true,
                key,
                ypokatasthma: cleanYpokatasthma,
                totals,
                items,
                warnings,
                failedEmployees
            });
        }

        const finishedJob = await finishJob({
            jobKey,
            update: {
                status: 'FAILED',
                employeesTotal: totals.eligible,
                employeesDone: totals.generated,
                employeesSkipped: totals.reused + totals.locked + totals.skippedExistingReady,
                employeesFailed: totals.failed,
                processedKodikos: items.map((item) => item.kodikos).filter(Boolean),
                failedEmployees,
                warnings,
                errorMessage: error.message || 'Σφάλμα batch παραγωγής work facts.'
            }
        });

        return {
            ...finishedJob,
            success: false,
            jobId: finishedJob?._id ? String(finishedJob._id) : '',
            jobKey,
            status: 'FAILED',
            dryRun: false,
            scope: key.scope,
            apo: key.apoYMD,
            eos: key.eosYMD,
            ypokatasthma: cleanYpokatasthma,
            totals,
            items,
            warnings,
            failedEmployees
        };
    }
}

async function getWorkFactsBatchJobStatus({ idOrJobKey, team, company_kod }) {
    const cleanIdOrJobKey = toTrimmedString(idOrJobKey);
    const cleanTeam = toTrimmedString(team);
    const cleanCompany = toTrimmedString(company_kod);

    if (!cleanIdOrJobKey || !cleanTeam || !cleanCompany) return null;

    const identityQuery = mongoose.Types.ObjectId.isValid(cleanIdOrJobKey)
        ? { _id: cleanIdOrJobKey }
        : { jobKey: cleanIdOrJobKey };
    const job = await PayrollPrecalcJobModel.findOne({
        ...identityQuery,
        team: cleanTeam,
        company_kod: cleanCompany
    }).lean();

    return normalizeBatchJobForStatus(job);
}

module.exports = {
    generateWorkFactsForCompanyPeriod,
    startWorkFactsBatchJob,
    getWorkFactsBatchJobStatus
};
