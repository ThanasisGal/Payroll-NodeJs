const mongoose = require('mongoose');

const { PayrollPrecalcSchedulerSlotModel } = require('../../models/kinhseis');
const { upsertPayrollPrecalcSettings } = require('./workFactsSettingsService');

const DEFAULT_TIMEZONE = 'Europe/Athens';
const DEFAULT_STEP_MINUTES = 5;
const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_DAYS = 7;
const SOURCE_VERSION = 'workFactsPrecalc:v1';
const RESERVED_SLOT_CONFLICT_MESSAGE =
    'Η ώρα δεσμεύτηκε ήδη. Επιλέξτε άλλη διαθέσιμη ώρα.';

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function normalizeSchedulerSlotYpokatasthma(value) {
    const normalized = toTrimmedString(value);

    return normalized || 'ALL';
}

function isSupportedTimezone(timezone) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
        return true;
    } catch (_error) {
        return false;
    }
}

function getTimezoneParts(date, timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        calendar: 'iso8601',
        numberingSystem: 'latn',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });
    const values = {};

    formatter.formatToParts(date).forEach((part) => {
        if (part.type !== 'literal') {
            values[part.type] = Number.parseInt(part.value, 10);
        }
    });

    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute,
        second: values.second
    };
}

function localPartsToUtcDate({ year, month, day, hour, minute, second = 0 }, timezone) {
    const expectedUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    let candidate = new Date(expectedUtcMs);

    for (let i = 0; i < 3; i += 1) {
        const actual = getTimezoneParts(candidate, timezone);
        const actualUtcMs = Date.UTC(
            actual.year,
            actual.month - 1,
            actual.day,
            actual.hour,
            actual.minute,
            actual.second,
            0
        );
        const deltaMs = expectedUtcMs - actualUtcMs;

        if (deltaMs === 0) {
            return candidate;
        }

        candidate = new Date(candidate.getTime() + deltaMs);
    }

    const verified = getTimezoneParts(candidate, timezone);
    if (
        verified.year === year &&
        verified.month === month &&
        verified.day === day &&
        verified.hour === hour &&
        verified.minute === minute
    ) {
        return candidate;
    }

    return new Date(expectedUtcMs);
}

function formatDateYMD({ year, month, day }) {
    return [
        String(year).padStart(4, '0'),
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0')
    ].join('-');
}

function formatTimeHM({ hour, minute }) {
    return [
        String(hour).padStart(2, '0'),
        String(minute).padStart(2, '0')
    ].join(':');
}

function parseSlotDate(slotDate) {
    const raw = toTrimmedString(slotDate);
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

    return { raw, year, month, day };
}

function parseSlotTime(slotTime) {
    const raw = toTrimmedString(slotTime);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) return null;

    const [hour, minute] = raw.split(':').map((part) => Number.parseInt(part, 10));

    return { raw, hour, minute };
}

function normalizeStepMinutes(value, warnings) {
    const stepMinutes = Number.parseInt(String(value ?? DEFAULT_STEP_MINUTES), 10);

    if (stepMinutes === 5 || stepMinutes === 10) {
        return stepMinutes;
    }

    warnings.push('INVALID_STEP_MINUTES: Υποστηρίζονται μόνο 5 ή 10 λεπτά.');
    return null;
}

function normalizeLimit(value) {
    const limit = Number.parseInt(String(value ?? DEFAULT_LIMIT), 10);

    if (Number.isInteger(limit) && limit > 0) {
        return Math.min(limit, 200);
    }

    return DEFAULT_LIMIT;
}

function normalizeMaxDays(value) {
    const maxDays = Number.parseInt(String(value ?? DEFAULT_MAX_DAYS), 10);

    if (Number.isInteger(maxDays) && maxDays > 0) {
        return Math.min(maxDays, 31);
    }

    return DEFAULT_MAX_DAYS;
}

function normalizeSettingYpokatasthma(value) {
    const normalized = normalizeSchedulerSlotYpokatasthma(value);

    return normalized === 'ALL' ? '' : normalized;
}

function buildPayrollPrecalcSchedulerSlotKey({ slotDate, slotTime, timezone }) {
    const cleanSlotDate = toTrimmedString(slotDate);
    const cleanSlotTime = toTrimmedString(slotTime);
    const cleanTimezone = toTrimmedString(timezone);

    if (!cleanSlotDate || !cleanSlotTime || !cleanTimezone) {
        const error = new Error('Λείπει slotDate, slotTime ή timezone για scheduler slot key.');
        error.statusCode = 400;
        throw error;
    }

    return `${cleanTimezone}|${cleanSlotDate}T${cleanSlotTime}`;
}

function buildSlotAt({ slotDate, slotTime, timezone }) {
    const parsedDate = parseSlotDate(slotDate);
    const parsedTime = parseSlotTime(slotTime);

    if (!parsedDate || !parsedTime) return null;

    return localPartsToUtcDate(
        {
            year: parsedDate.year,
            month: parsedDate.month,
            day: parsedDate.day,
            hour: parsedTime.hour,
            minute: parsedTime.minute
        },
        timezone
    );
}

function validateSchedulerSlotInput(input = {}) {
    const warnings = [];
    const slotDate = parseSlotDate(input.slotDate ?? input.startDate);
    const slotTime = parseSlotTime(input.slotTime ?? input.startTime);
    const timezone = toTrimmedString(input.timezone) || DEFAULT_TIMEZONE;
    const stepMinutes = normalizeStepMinutes(input.stepMinutes, warnings);
    const team = toTrimmedString(input.team);
    const company_kod = toTrimmedString(input.company_kod);

    if (!slotDate) warnings.push('INVALID_SLOT_DATE: Το slotDate πρέπει να είναι YYYY-MM-DD.');
    if (!slotTime) warnings.push('INVALID_SLOT_TIME: Το slotTime πρέπει να είναι HH:mm.');
    if (!timezone) warnings.push('INVALID_TIMEZONE: Λείπει timezone.');
    if (timezone && !isSupportedTimezone(timezone)) {
        warnings.push(`INVALID_TIMEZONE: Δεν υποστηρίζεται "${timezone}".`);
    }

    if (slotTime && stepMinutes && slotTime.minute % stepMinutes !== 0) {
        warnings.push('INVALID_SLOT_TIME_STEP: Το λεπτό δεν ταιριάζει με το stepMinutes.');
    }

    if (Object.prototype.hasOwnProperty.call(input, 'team') && !team) {
        warnings.push('Λείπει team.');
    }

    if (Object.prototype.hasOwnProperty.call(input, 'company_kod') && !company_kod) {
        warnings.push('Λείπει company_kod.');
    }

    const normalized = {
        team,
        company_kod,
        ypokatasthma: normalizeSchedulerSlotYpokatasthma(input.ypokatasthma),
        slotDate: slotDate?.raw || toTrimmedString(input.slotDate ?? input.startDate),
        slotTime: slotTime?.raw || toTrimmedString(input.slotTime ?? input.startTime),
        timezone,
        stepMinutes: stepMinutes || DEFAULT_STEP_MINUTES,
        settingId: toTrimmedString(input.settingId),
        reservedBy: toTrimmedString(input.reservedBy),
        notes: toTrimmedString(input.notes),
        warnings
    };

    return {
        isValid: warnings.length === 0,
        warnings,
        normalized
    };
}

function addLocalMinutes(parts, minutesToAdd) {
    const date = new Date(Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute + minutesToAdd,
        0,
        0
    ));

    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes()
    };
}

function buildCandidateSlot(parts, { timezone, stepMinutes }) {
    const slotDate = formatDateYMD(parts);
    const slotTime = formatTimeHM(parts);
    const slotKey = buildPayrollPrecalcSchedulerSlotKey({ slotDate, slotTime, timezone });
    const slotAt = buildSlotAt({ slotDate, slotTime, timezone });

    return {
        slotKey,
        slotAt,
        slotDate,
        slotTime,
        timezone,
        stepMinutes
    };
}

function normalizeSlotForReturn(slot) {
    if (!slot) return null;

    const plain = typeof slot.toObject === 'function' ? slot.toObject() : { ...slot };

    return {
        ...plain,
        _id: plain._id ? String(plain._id) : plain._id,
        settingId: plain.settingId ? String(plain.settingId) : plain.settingId
    };
}

async function getAvailablePayrollPrecalcSchedulerSlots(options = {}) {
    const validation = validateSchedulerSlotInput({
        slotDate: options.startDate,
        slotTime: options.startTime,
        timezone: options.timezone || DEFAULT_TIMEZONE,
        stepMinutes: options.stepMinutes || DEFAULT_STEP_MINUTES
    });

    if (!validation.isValid) {
        return {
            success: false,
            statusCode: 400,
            warnings: validation.warnings,
            slots: []
        };
    }

    const { slotDate, slotTime, timezone, stepMinutes } = validation.normalized;
    const limit = normalizeLimit(options.limit);
    const maxDays = normalizeMaxDays(options.maxDays);
    const parsedDate = parseSlotDate(slotDate);
    const parsedTime = parseSlotTime(slotTime);
    const maxCandidates = Math.ceil((maxDays * 24 * 60) / stepMinutes);
    const candidates = [];
    let current = {
        year: parsedDate.year,
        month: parsedDate.month,
        day: parsedDate.day,
        hour: parsedTime.hour,
        minute: parsedTime.minute
    };

    for (let i = 0; i < maxCandidates; i += 1) {
        candidates.push(buildCandidateSlot(current, { timezone, stepMinutes }));
        current = addLocalMinutes(current, stepMinutes);
    }

    const reservedSlots = await PayrollPrecalcSchedulerSlotModel.find({
        status: 'RESERVED',
        slotKey: mongoose.trusted({ $in: candidates.map((slot) => slot.slotKey) })
    })
        .select('slotKey')
        .lean();
    const reservedKeys = new Set(reservedSlots.map((slot) => slot.slotKey));
    const slots = candidates
        .filter((slot) => !reservedKeys.has(slot.slotKey))
        .slice(0, limit);

    return {
        success: true,
        slots
    };
}

async function reservePayrollPrecalcSchedulerSlot(input = {}) {
    const validation = validateSchedulerSlotInput(input);

    if (!validation.isValid) {
        return {
            success: false,
            conflict: false,
            statusCode: 400,
            warnings: validation.warnings,
            message: validation.warnings.join(' | ')
        };
    }

    const normalized = validation.normalized;

    if (!normalized.team || !normalized.company_kod) {
        return {
            success: false,
            conflict: false,
            statusCode: 400,
            warnings: ['Λείπει team ή company_kod.'],
            message: 'Λείπει team ή company_kod.'
        };
    }

    const slotKey = buildPayrollPrecalcSchedulerSlotKey(normalized);
    const slotAt = buildSlotAt(normalized);
    const document = {
        team: normalized.team,
        company_kod: normalized.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        slotKey,
        slotAt,
        slotDate: normalized.slotDate,
        slotTime: normalized.slotTime,
        timezone: normalized.timezone,
        stepMinutes: normalized.stepMinutes,
        status: 'RESERVED',
        reservedBy: normalized.reservedBy,
        notes: normalized.notes,
        sourceVersion: SOURCE_VERSION
    };

    if (normalized.settingId && mongoose.Types.ObjectId.isValid(normalized.settingId)) {
        document.settingId = normalized.settingId;
    }

    try {
        const slot = await PayrollPrecalcSchedulerSlotModel.create(document);

        return {
            success: true,
            conflict: false,
            slot: normalizeSlotForReturn(slot)
        };
    } catch (error) {
        if (error?.code === 11000) {
            return {
                success: false,
                conflict: true,
                statusCode: 409,
                message: RESERVED_SLOT_CONFLICT_MESSAGE
            };
        }

        throw error;
    }
}

async function releasePayrollPrecalcSchedulerSlot(input = {}) {
    const slotId = toTrimmedString(input.slotId);
    const slotKey = toTrimmedString(input.slotKey);

    if (!slotId && !slotKey) {
        return {
            success: false,
            notFound: true,
            statusCode: 404,
            message: 'Δεν βρέθηκε ενεργή δέσμευση slot.'
        };
    }

    const filter = {
        status: 'RESERVED'
    };

    if (slotId && mongoose.Types.ObjectId.isValid(slotId)) {
        filter._id = slotId;
    } else {
        filter.slotKey = slotKey;
    }

    const slot = await PayrollPrecalcSchedulerSlotModel.findOneAndUpdate(
        filter,
        {
            $set: {
                status: 'RELEASED',
                releasedAt: new Date(),
                releasedBy: toTrimmedString(input.releasedBy),
                releaseReason: toTrimmedString(input.releaseReason)
            }
        },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).lean();

    if (!slot) {
        return {
            success: false,
            notFound: true,
            statusCode: 404,
            message: 'Δεν βρέθηκε ενεργή δέσμευση slot.'
        };
    }

    return {
        success: true,
        notFound: false,
        slot: normalizeSlotForReturn(slot)
    };
}

async function releaseActivePayrollPrecalcSchedulerSlotsForTarget(input = {}) {
    const team = toTrimmedString(input.team);
    const company_kod = toTrimmedString(input.company_kod);
    const ypokatasthma = normalizeSchedulerSlotYpokatasthma(input.ypokatasthma);

    if (!team || !company_kod) {
        return {
            success: false,
            statusCode: 400,
            releasedCount: 0,
            message: 'Λείπει team ή company_kod.'
        };
    }

    const filter = {
        team,
        company_kod,
        ypokatasthma,
        status: 'RESERVED'
    };
    const exceptSlotKey = toTrimmedString(input.exceptSlotKey);

    if (exceptSlotKey) {
        filter.slotKey = mongoose.trusted({ $ne: exceptSlotKey });
    }

    const result = await PayrollPrecalcSchedulerSlotModel.updateMany(
        filter,
        {
            $set: mongoose.trusted({
                status: 'RELEASED',
                releasedAt: new Date(),
                releasedBy: toTrimmedString(input.releasedBy),
                releaseReason: toTrimmedString(input.releaseReason)
            })
        },
        { runValidators: true }
    );

    return {
        success: true,
        releasedCount: result.modifiedCount || 0
    };
}

async function attachPayrollPrecalcSchedulerSlotToSetting(input = {}) {
    const slotId = toTrimmedString(input.slotId);
    const slotKey = toTrimmedString(input.slotKey);
    const settingId = toTrimmedString(input.settingId);

    if (!settingId || !mongoose.Types.ObjectId.isValid(settingId)) {
        return {
            success: false,
            notFound: false,
            statusCode: 400,
            message: 'Λείπει ή δεν είναι έγκυρο το settingId.'
        };
    }

    if (!slotId && !slotKey) {
        return {
            success: false,
            notFound: true,
            statusCode: 404,
            message: 'Δεν βρέθηκε ενεργή δέσμευση slot.'
        };
    }

    const filter = {
        status: 'RESERVED'
    };

    if (slotId && mongoose.Types.ObjectId.isValid(slotId)) {
        filter._id = slotId;
    } else {
        filter.slotKey = slotKey;
    }

    const slot = await PayrollPrecalcSchedulerSlotModel.findOneAndUpdate(
        filter,
        {
            $set: mongoose.trusted({
                settingId
            })
        },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).lean();

    if (!slot) {
        return {
            success: false,
            notFound: true,
            statusCode: 404,
            message: 'Δεν βρέθηκε ενεργή δέσμευση slot.'
        };
    }

    return {
        success: true,
        notFound: false,
        slot: normalizeSlotForReturn(slot)
    };
}

async function configurePayrollPrecalcSchedulerSlotForSetting(input = {}) {
    const reservedSlotResult = await reservePayrollPrecalcSchedulerSlot(input);

    if (reservedSlotResult.success !== true) {
        return reservedSlotResult;
    }

    const slot = reservedSlotResult.slot;
    const parsedDate = parseSlotDate(slot.slotDate);
    const monthlyRunDay = parsedDate?.day;
    const reservedBy = toTrimmedString(input.reservedBy);
    const releaseNewSlot = async (releaseReason) => releasePayrollPrecalcSchedulerSlot({
        slotKey: slot.slotKey,
        releasedBy: reservedBy,
        releaseReason
    });

    if (!Number.isInteger(monthlyRunDay) || monthlyRunDay < 1 || monthlyRunDay > 28) {
        await releaseNewSlot('configure_failed_invalid_monthly_run_day');
        return {
            success: false,
            conflict: false,
            statusCode: 400,
            warnings: ['INVALID_MONTHLY_RUN_DAY: Επιτρέπονται μόνο ημέρες 1-28 για monthly scheduler settings.'],
            message: 'Η ημέρα του slot πρέπει να είναι από 1 έως 28.'
        };
    }

    try {
        const setting = await upsertPayrollPrecalcSettings({
            team: slot.team,
            company_kod: slot.company_kod,
            ypokatasthma: normalizeSettingYpokatasthma(slot.ypokatasthma),
            precalcEnabled: true,
            monthlyRunDay,
            monthlyRunTime: slot.slotTime,
            timezone: slot.timezone,
            periodMode: input.periodMode,
            scope: input.scope,
            updatedBy: toTrimmedString(input.updatedBy),
            notes: toTrimmedString(input.notes),
            nextRunAtOverride: slot.slotAt
        });

        const attachResult = await attachPayrollPrecalcSchedulerSlotToSetting({
            slotKey: slot.slotKey,
            settingId: setting?._id
        });

        if (attachResult.success !== true) {
            await releaseNewSlot('configure_failed_attach_setting');
            return {
                success: false,
                conflict: false,
                statusCode: attachResult.statusCode || 500,
                message: attachResult.message || 'Δεν ήταν δυνατή η σύνδεση slot με settings.'
            };
        }

        const releasePreviousResult = await releaseActivePayrollPrecalcSchedulerSlotsForTarget({
            team: slot.team,
            company_kod: slot.company_kod,
            ypokatasthma: slot.ypokatasthma,
            exceptSlotKey: slot.slotKey,
            releasedBy: reservedBy,
            releaseReason: 'replaced_by_scheduler_slot_configure'
        });

        return {
            success: true,
            slot: attachResult.slot,
            setting,
            releasedPreviousSlots: releasePreviousResult.releasedCount || 0
        };
    } catch (error) {
        await releaseNewSlot('configure_failed_settings_upsert');
        error.statusCode = error.statusCode || 500;
        throw error;
    }
}

module.exports = {
    normalizeSchedulerSlotYpokatasthma,
    buildPayrollPrecalcSchedulerSlotKey,
    validateSchedulerSlotInput,
    getAvailablePayrollPrecalcSchedulerSlots,
    reservePayrollPrecalcSchedulerSlot,
    releasePayrollPrecalcSchedulerSlot,
    releaseActivePayrollPrecalcSchedulerSlotsForTarget,
    attachPayrollPrecalcSchedulerSlotToSetting,
    configurePayrollPrecalcSchedulerSlotForSetting
};
