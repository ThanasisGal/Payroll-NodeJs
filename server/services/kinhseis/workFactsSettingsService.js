const { PayrollPrecalcSettingsModel } = require('../../models/kinhseis');

const SOURCE_VERSION = 'workFactsPrecalc:v1';
const DEFAULTS = {
    precalcEnabled: false,
    monthlyRunDay: 2,
    monthlyRunTime: '02:30',
    timezone: 'Europe/Athens',
    periodMode: 'PREVIOUS_MONTH',
    scope: 'MONTHLY'
};

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function toBoolean(value) {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
    }

    return Boolean(value);
}

function normalizeMonthlyRunDay(value, warnings) {
    const day = Number.parseInt(String(value ?? ''), 10);

    if (Number.isInteger(day) && day >= 1 && day <= 28) {
        return day;
    }

    warnings.push('INVALID_MONTHLY_RUN_DAY: Χρησιμοποιήθηκε default 2.');
    return DEFAULTS.monthlyRunDay;
}

function normalizeMonthlyRunTime(value, warnings) {
    const time = toTrimmedString(value);

    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return time;
    }

    warnings.push('INVALID_MONTHLY_RUN_TIME: Χρησιμοποιήθηκε default 02:30.');
    return DEFAULTS.monthlyRunTime;
}

function normalizePeriodMode(value, warnings) {
    const periodMode = toTrimmedString(value).toUpperCase();

    if (periodMode === DEFAULTS.periodMode) {
        return DEFAULTS.periodMode;
    }

    warnings.push('INVALID_PERIOD_MODE: Υποστηρίζεται μόνο PREVIOUS_MONTH.');
    return DEFAULTS.periodMode;
}

function normalizeTimezone(value, warnings) {
    const timezone = toTrimmedString(value);

    if (timezone) {
        return timezone;
    }

    warnings.push('INVALID_TIMEZONE: Χρησιμοποιήθηκε default Europe/Athens.');
    return DEFAULTS.timezone;
}

function normalizePayrollPrecalcSettingsInput(input = {}) {
    const warnings = [];
    const team = toTrimmedString(input.team);
    const company_kod = toTrimmedString(input.company_kod);

    if (!team) warnings.push('Λείπει team.');
    if (!company_kod) warnings.push('Λείπει company_kod.');

    return {
        team,
        company_kod,
        ypokatasthma: toTrimmedString(input.ypokatasthma),
        precalcEnabled: toBoolean(input.precalcEnabled),
        monthlyRunDay: normalizeMonthlyRunDay(input.monthlyRunDay, warnings),
        monthlyRunTime: normalizeMonthlyRunTime(input.monthlyRunTime, warnings),
        timezone: normalizeTimezone(input.timezone, warnings),
        periodMode: normalizePeriodMode(input.periodMode, warnings),
        scope: DEFAULTS.scope,
        updatedBy: toTrimmedString(input.updatedBy),
        notes: toTrimmedString(input.notes),
        sourceVersion: SOURCE_VERSION,
        warnings
    };
}

function buildDefaultSettings({ team, company_kod, ypokatasthma = '' }) {
    return {
        team: toTrimmedString(team),
        company_kod: toTrimmedString(company_kod),
        ypokatasthma: toTrimmedString(ypokatasthma),
        ...DEFAULTS,
        lastRunAt: null,
        nextRunAt: null,
        updatedBy: '',
        notes: '',
        sourceVersion: SOURCE_VERSION,
        warnings: [],
        exists: false
    };
}

function normalizeSettingsForReturn(settings, warnings = []) {
    if (!settings) return null;

    const plain = typeof settings.toObject === 'function' ? settings.toObject() : { ...settings };

    return {
        _id: plain._id,
        team: toTrimmedString(plain.team),
        company_kod: toTrimmedString(plain.company_kod),
        ypokatasthma: toTrimmedString(plain.ypokatasthma),
        precalcEnabled: plain.precalcEnabled === true,
        monthlyRunDay: plain.monthlyRunDay ?? DEFAULTS.monthlyRunDay,
        monthlyRunTime: plain.monthlyRunTime || DEFAULTS.monthlyRunTime,
        timezone: plain.timezone || DEFAULTS.timezone,
        periodMode: plain.periodMode || DEFAULTS.periodMode,
        scope: plain.scope || DEFAULTS.scope,
        lastRunAt: plain.lastRunAt || null,
        nextRunAt: plain.nextRunAt || null,
        updatedBy: toTrimmedString(plain.updatedBy),
        notes: toTrimmedString(plain.notes),
        sourceVersion: plain.sourceVersion || SOURCE_VERSION,
        warnings,
        createdAt: plain.createdAt || null,
        updatedAt: plain.updatedAt || null,
        exists: true
    };
}

function buildSettingsQuery({ team, company_kod, ypokatasthma = '' }) {
    return {
        team: toTrimmedString(team),
        company_kod: toTrimmedString(company_kod),
        ypokatasthma: toTrimmedString(ypokatasthma)
    };
}

async function getPayrollPrecalcSettings({ team, company_kod, ypokatasthma = '' }) {
    const query = buildSettingsQuery({ team, company_kod, ypokatasthma });

    if (!query.team || !query.company_kod) {
        return {
            ...buildDefaultSettings(query),
            warnings: ['Λείπει team ή company_kod.']
        };
    }

    const settings = await PayrollPrecalcSettingsModel.findOne(query).lean();

    if (!settings) {
        return buildDefaultSettings(query);
    }

    return normalizeSettingsForReturn(settings);
}

async function upsertPayrollPrecalcSettings(input = {}) {
    const normalized = normalizePayrollPrecalcSettingsInput(input);

    if (!normalized.team || !normalized.company_kod) {
        const error = new Error('Λείπει team ή company_kod για αποθήκευση precalc settings.');
        error.statusCode = 400;
        error.warnings = normalized.warnings;
        throw error;
    }

    const query = buildSettingsQuery(normalized);
    const settings = await PayrollPrecalcSettingsModel.findOneAndUpdate(
        query,
        {
            $set: {
                precalcEnabled: normalized.precalcEnabled,
                monthlyRunDay: normalized.monthlyRunDay,
                monthlyRunTime: normalized.monthlyRunTime,
                timezone: normalized.timezone,
                periodMode: normalized.periodMode,
                scope: normalized.scope,
                updatedBy: normalized.updatedBy,
                notes: normalized.notes,
                sourceVersion: SOURCE_VERSION
            },
            $setOnInsert: {
                team: normalized.team,
                company_kod: normalized.company_kod,
                ypokatasthma: normalized.ypokatasthma,
                lastRunAt: null,
                nextRunAt: null
            }
        },
        {
            upsert: true,
            returnDocument: 'after',
            runValidators: true,
            setDefaultsOnInsert: true
        }
    ).lean();

    return normalizeSettingsForReturn(settings, normalized.warnings);
}

module.exports = {
    getPayrollPrecalcSettings,
    upsertPayrollPrecalcSettings,
    normalizePayrollPrecalcSettingsInput
};
