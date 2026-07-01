const mongoose = require('mongoose');

const { PayrollPrecalcSettingsModel } = require('../../models/kinhseis');
const { generateWorkFactsForCompanyPeriod } = require('./workFactsBatchService');
const {
    computeNextMonthlyRunAt,
    computePreviousMonthRangeForRunDate,
    normalizeScheduleSettingsForRun
} = require('./workFactsScheduleUtils');

const DEFAULT_REQUESTED_BY = 'payroll-precalc-scheduler';

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function normalizeLimit(value, fallback) {
    const limit = Number.parseInt(String(value ?? ''), 10);

    if (Number.isInteger(limit) && limit > 0) {
        return Math.min(limit, 100);
    }

    return fallback;
}

function normalizeDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
}

function buildSettingsIdentity(setting) {
    return {
        team: toTrimmedString(setting.team),
        company_kod: toTrimmedString(setting.company_kod),
        ypokatasthma: toTrimmedString(setting.ypokatasthma)
    };
}

function normalizeSchedulerYpokatasthma(value) {
    const normalized = toTrimmedString(value);

    return normalized || 'ALL';
}

function isPayrollPrecalcSchedulerTargetAllowed(setting, targets) {
    if (!Array.isArray(targets) || targets.length < 1) return false;

    const team = toTrimmedString(setting?.team);
    const company_kod = toTrimmedString(setting?.company_kod);
    const ypokatasthma = normalizeSchedulerYpokatasthma(setting?.ypokatasthma);

    return targets.some((target) => (
        team === target.team &&
        company_kod === target.company_kod &&
        ypokatasthma === target.ypokatasthma
    ));
}

function normalizeSettingForRun(setting) {
    return {
        ...buildSettingsIdentity(setting),
        ...normalizeScheduleSettingsForRun(setting)
    };
}

async function findDuePayrollPrecalcSettings({ now = new Date(), limit = 20 } = {}) {
    const runNow = normalizeDate(now);
    const cleanLimit = normalizeLimit(limit, 20);

    return PayrollPrecalcSettingsModel.find({
        precalcEnabled: true,
        nextRunAt: mongoose.trusted({ $lte: runNow })
    })
        .sort({ nextRunAt: 1 })
        .limit(cleanLimit)
        .lean();
}

async function updateSettingAfterRun({ setting, now }) {
    const normalized = normalizeSettingForRun(setting);
    const nextRunAt = computeNextMonthlyRunAt({
        monthlyRunDay: normalized.monthlyRunDay,
        monthlyRunTime: normalized.monthlyRunTime,
        timezone: normalized.timezone,
        fromDate: new Date(now.getTime() + 60000)
    });

    return PayrollPrecalcSettingsModel.findOneAndUpdate(
        buildSettingsIdentity(setting),
        {
            $set: {
                lastRunAt: now,
                nextRunAt
            }
        },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).lean();
}

async function runSingleDueSetting({ setting, now, requestedBy }) {
    const normalized = normalizeSettingForRun(setting);

    if (!normalized.team || !normalized.company_kod) {
        return {
            status: 'SKIPPED',
            settingId: setting._id,
            warnings: ['Λείπει team ή company_kod στο payroll precalc setting.']
        };
    }

    if (normalized.periodMode !== 'PREVIOUS_MONTH' || normalized.scope !== 'MONTHLY') {
        return {
            status: 'SKIPPED',
            settingId: setting._id,
            team: normalized.team,
            company_kod: normalized.company_kod,
            ypokatasthma: normalized.ypokatasthma,
            warnings: normalized.warnings
        };
    }

    const { apo, eos } = computePreviousMonthRangeForRunDate({
        runAt: setting.nextRunAt,
        timezone: normalized.timezone
    });
    const job = await generateWorkFactsForCompanyPeriod({
        team: normalized.team,
        company_kod: normalized.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        apo,
        eos,
        scope: 'MONTHLY',
        requestedBy,
        force: false
    });

    const updatedSetting = await updateSettingAfterRun({ setting, now });

    return {
        status: job?.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
        settingId: setting._id,
        team: normalized.team,
        company_kod: normalized.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        apo,
        eos,
        job,
        updatedSetting
    };
}

async function runDuePayrollPrecalcJobs({
    now = new Date(),
    limit = 5,
    requestedBy = DEFAULT_REQUESTED_BY,
    allowedTargets = []
} = {}) {
    const runNow = normalizeDate(now);
    const cleanLimit = normalizeLimit(limit, 5);
    const dueSettings = await findDuePayrollPrecalcSettings({
        now: runNow,
        limit: cleanLimit
    });
    const allowedSettings = dueSettings.filter((setting) => (
        isPayrollPrecalcSchedulerTargetAllowed(setting, allowedTargets)
    ));

    console.log(
        `Payroll precalc scheduler due settings: total=${dueSettings.length} ` +
        `allowed=${allowedSettings.length} skippedByAllowlist=${dueSettings.length - allowedSettings.length}`
    );

    const summary = {
        requestedBy: toTrimmedString(requestedBy) || DEFAULT_REQUESTED_BY,
        now: runNow,
        totalDue: dueSettings.length,
        allowedDue: allowedSettings.length,
        skippedByAllowlist: dueSettings.length - allowedSettings.length,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        results: []
    };

    for (const setting of allowedSettings) {
        try {
            const result = await runSingleDueSetting({
                setting,
                now: runNow,
                requestedBy: summary.requestedBy
            });

            if (result.status === 'SUCCESS') {
                summary.succeeded += 1;
            } else if (result.status === 'SKIPPED') {
                summary.skipped += 1;
            } else {
                summary.failed += 1;
            }

            summary.results.push(result);
        } catch (error) {
            summary.failed += 1;
            summary.results.push({
                status: 'FAILED',
                settingId: setting._id,
                ...buildSettingsIdentity(setting),
                errorMessage: error.message || 'Payroll precalc scheduler setting failed.'
            });
        }
    }

    return summary;
}

async function refreshPayrollPrecalcNextRun({
    team,
    company_kod,
    ypokatasthma = '',
    fromDate = new Date()
} = {}) {
    const identity = {
        team: toTrimmedString(team),
        company_kod: toTrimmedString(company_kod),
        ypokatasthma: toTrimmedString(ypokatasthma)
    };

    if (!identity.team || !identity.company_kod) {
        const error = new Error('Λείπει team ή company_kod για refresh payroll precalc nextRunAt.');
        error.statusCode = 400;
        throw error;
    }

    const setting = await PayrollPrecalcSettingsModel.findOne(identity).lean();
    if (!setting) return null;

    const normalized = normalizeSettingForRun(setting);
    const nextRunAt = setting.precalcEnabled === true
        ? computeNextMonthlyRunAt({
            monthlyRunDay: normalized.monthlyRunDay,
            monthlyRunTime: normalized.monthlyRunTime,
            timezone: normalized.timezone,
            fromDate: normalizeDate(fromDate)
        })
        : null;

    return PayrollPrecalcSettingsModel.findOneAndUpdate(
        identity,
        { $set: { nextRunAt } },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).lean();
}

module.exports = {
    findDuePayrollPrecalcSettings,
    isPayrollPrecalcSchedulerTargetAllowed,
    runDuePayrollPrecalcJobs,
    refreshPayrollPrecalcNextRun
};
