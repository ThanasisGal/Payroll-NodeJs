'use strict';

const crypto = require('crypto');

const RESOLUTION_KIND = 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION';
const RESOLUTION_STATUS = 'RESOLVED';
const ACCOUNTING_TIME_FIELDS = Object.freeze([
    'apologistiko_biblio', 'kathgoria_ergasias_apologistika', 'adeia_apologistika',
    'astheneia_apologistika', 'kathgoria_adeias_apologistika',
    'apo_ora_01_apologistika', 'eos_ora_01_apologistika',
    'apo_ora_02_apologistika', 'eos_ora_02_apologistika',
    'apo_ora_03_apologistika', 'eos_ora_03_apologistika'
]);

function resolutionError(code, message, details = {}) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = 409;
    error.details = details;
    return error;
}

function stableValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value.toHexString === 'function') return value.toHexString();
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
    }, {});
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function hasValidResolutionFingerprint(decision) {
    const canonical = decision?.canonical_snapshot;
    const identity = canonical?.identity;
    if (!canonical || !identity || !decision?.resolution_fingerprint ||
        fingerprint(canonical) !== decision.resolution_fingerprint) return false;
    return decision.resolution_kind === RESOLUTION_KIND &&
        identity.resolution_kind === RESOLUTION_KIND &&
        text(decision.deferred_week_id) === text(identity.deferred_week_id) &&
        text(decision.proposal_identity) === fingerprint(identity);
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

function text(value) { return String(value ?? '').trim(); }

function normalizeBranch(value) {
    const branch = text(value);
    return branch ? branch.padStart(4, '0') : '';
}

function dateKey(value, field) {
    const raw = value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw resolutionError('INVALID_DEFERRED_RESOLUTION_DATE', `Μη έγκυρο ${field}.`, { value });
    }
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
        throw resolutionError('INVALID_DEFERRED_RESOLUTION_DATE', `Μη έγκυρο ${field}.`, { value });
    }
    return raw;
}

function normalizePeriod(period, field) {
    const start = dateKey(period?.period_start, `${field}.period_start`);
    const end = dateKey(period?.period_end, `${field}.period_end`);
    if (start > end) throw resolutionError('INVALID_DEFERRED_RESOLUTION_PERIOD', `Μη έγκυρη περίοδος ${field}.`);
    return { period_start: start, period_end: end };
}

function normalizeWeek(fullWeekContext) {
    const rows = Array.isArray(fullWeekContext) ? fullWeekContext : fullWeekContext?.daily_rows;
    if (!Array.isArray(rows) || rows.length !== 7) {
        throw resolutionError('DEFERRED_RESOLUTION_FULL_WEEK_REQUIRED', 'Απαιτείται πλήρης φυσική εβδομάδα επτά ημερών.');
    }
    const ordered = rows.map((row) => ({ ...stableValue(row), hmeromhnia: dateKey(row?.hmeromhnia, 'week row date') }))
        .sort((left, right) => left.hmeromhnia.localeCompare(right.hmeromhnia));
    const uniqueDates = new Set(ordered.map((row) => row.hmeromhnia));
    const start = new Date(`${ordered[0].hmeromhnia}T00:00:00.000Z`);
    const consecutive = ordered.every((row, index) => {
        const expected = new Date(start);
        expected.setUTCDate(expected.getUTCDate() + index);
        return row.hmeromhnia === expected.toISOString().slice(0, 10);
    });
    if (uniqueDates.size !== 7 || !consecutive || start.getUTCDay() !== 1) {
        throw resolutionError('DEFERRED_RESOLUTION_NATURAL_WEEK_REQUIRED', 'Το context πρέπει να είναι μία πλήρης φυσική εβδομάδα Δευτέρα–Κυριακή.');
    }
    return ordered;
}
function validateDeferredIdentity(deferredWeek, weekRows) {
    const identity = {
        team: text(deferredWeek?.team),
        company_kod: text(deferredWeek?.company_kod),
        ypokatasthma: normalizeBranch(deferredWeek?.ypokatasthma),
        employee_id: text(deferredWeek?.employee_id),
        week_start: dateKey(deferredWeek?.week_start, 'deferredWeek.week_start'),
        week_end: dateKey(deferredWeek?.week_end, 'deferredWeek.week_end'),
        source_period_start: dateKey(deferredWeek?.source_period_start, 'deferredWeek.source_period_start'),
        source_period_end: dateKey(deferredWeek?.source_period_end, 'deferredWeek.source_period_end')
    };
    if (['team', 'company_kod', 'ypokatasthma', 'employee_id'].some((field) => !identity[field])) {
        throw resolutionError('DEFERRED_RESOLUTION_IDENTITY_INCOMPLETE', 'Η ταυτότητα της απόφασης δεν είναι πλήρης.');
    }
    if (identity.week_start !== weekRows[0].hmeromhnia || identity.week_end !== weekRows[6].hmeromhnia) {
        throw resolutionError('DEFERRED_RESOLUTION_WEEK_IDENTITY_MISMATCH', 'Η deferred εβδομάδα δεν συμφωνεί με το 7ήμερο context.');
    }
    const expectedDeferredWeekId = JSON.stringify(Object.values(identity));
    if (text(deferredWeek?.deferred_week_id) !== expectedDeferredWeekId) {
        throw resolutionError('DEFERRED_WEEK_IDENTITY_MISMATCH', 'Το deferred_week_id δεν συμφωνεί με την Phase-1 ταυτότητα.');
    }
    for (const row of weekRows) {
        const rowScope = { team: text(row.team), company_kod: text(row.company_kod),
            ypokatasthma: normalizeBranch(row.ypokatasthma), employee_id: text(row.employee_id) };
        if (Object.keys(rowScope).some((field) => rowScope[field] !== identity[field])) {
            throw resolutionError('DEFERRED_RESOLUTION_EMPLOYEE_SCOPE_MISMATCH', 'Το 7ήμερο context δεν ανήκει στη deferred ταυτότητα.');
        }
    }
    return identity;
}

function normalizeEndpoint(endpoint, label, weekDates, weekRows) {
    const rowId = text(endpoint?.row_id || endpoint?.prodhlomena_oraria_id || endpoint?._id);
    const date = dateKey(endpoint?.hmeromhnia || endpoint?.date, `${label} date`);
    if (!rowId || !weekDates.has(date)) {
        throw resolutionError('DEFERRED_RESOLUTION_ENDPOINT_OUTSIDE_WEEK', `${label} δεν ανήκει στη φυσική εβδομάδα.`);
    }
    const authoritativeRow = weekRows.find((row) => row.hmeromhnia === date);
    const authoritativeId = text(authoritativeRow?.row_id || authoritativeRow?.prodhlomena_oraria_id || authoritativeRow?._id);
    if (!authoritativeId || authoritativeId !== rowId) {
        throw resolutionError('DEFERRED_RESOLUTION_ENDPOINT_IDENTITY_MISMATCH', `${label} δεν ταυτίζεται με τη γραμμή της φυσικής εβδομάδας.`);
    }
    return { row_id: rowId, hmeromhnia: date };
}

function projectionFor(period, side, proposedRows) {
    const accountingRows = proposedRows
        .map((row) => stableValue({ ...row, hmeromhnia: dateKey(row?.hmeromhnia || row?.date, 'accounting row date') }))
        .filter((row) => row.hmeromhnia >= period.period_start && row.hmeromhnia <= period.period_end)
        .sort((left, right) => `${left.hmeromhnia}|${left.row_id || ''}`.localeCompare(`${right.hmeromhnia}|${right.row_id || ''}`));
    const canonical = { ...period, side, accounting_rows: accountingRows };
    return { ...canonical, projection_fingerprint: fingerprint(canonical) };
}

function normalizeProposedRows(rows, endpoints, weekDates) {
    const normalized = rows.map((row) => {
        const hmeromhnia = dateKey(row?.hmeromhnia || row?.date, 'accounting row date');
        const rowId = text(row?.row_id || row?.prodhlomena_oraria_id || row?._id);
        if (!weekDates.has(hmeromhnia)) {
            throw resolutionError('DEFERRED_RESOLUTION_ACCOUNTING_ROW_OUTSIDE_WEEK', 'Η προτεινόμενη γραμμή βρίσκεται εκτός φυσικής εβδομάδας.');
        }
        const endpoint = endpoints.find((item) => item.row_id === rowId && item.hmeromhnia === hmeromhnia);
        if (!endpoint) {
            throw resolutionError('DEFERRED_RESOLUTION_ACCOUNTING_ROW_NOT_ENDPOINT', 'Μόνο οι επιλεγμένες source/target γραμμές μπορούν να αλλάξουν.');
        }
        const result = { row_id: rowId, hmeromhnia };
        ACCOUNTING_TIME_FIELDS.forEach((field) => {
            if (!Object.prototype.hasOwnProperty.call(row, field)) return;
            const value = row[field];
            if (value !== null && typeof value === 'object') {
                throw resolutionError('INVALID_DEFERRED_RESOLUTION_ACCOUNTING_FIELD', 'Τα πεδία οργάνωσης χρόνου πρέπει να είναι scalar τιμές.', { field });
            }
            result[field] = value;
        });
        return result;
    });
    const identities = new Set(normalized.map((row) => `${row.row_id}|${row.hmeromhnia}`));
    if (normalized.length !== 2 || identities.size !== 2 || endpoints.some((endpoint) =>
        !identities.has(`${endpoint.row_id}|${endpoint.hmeromhnia}`))) {
        throw resolutionError('DEFERRED_RESOLUTION_BOTH_ENDPOINTS_REQUIRED', 'Απαιτούνται ακριβώς οι after τιμές των source και target.');
    }
    return normalized.sort((left, right) =>
        `${left.hmeromhnia}|${left.row_id}`.localeCompare(`${right.hmeromhnia}|${right.row_id}`));
}

function canonicalRowValues(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => stableValue(row))
        .sort((left, right) => {
            const leftKey = `${dateKey(left?.hmeromhnia || left?.date, 'before row date')}|${text(left?.row_id || left?.prodhlomena_oraria_id || left?._id)}`;
            const rightKey = `${dateKey(right?.hmeromhnia || right?.date, 'before row date')}|${text(right?.row_id || right?.prodhlomena_oraria_id || right?._id)}`;
            return leftKey.localeCompare(rightKey);
        });
}

function buildDeferredCrossPeriodRepoResolution({ deferredWeek, fullWeekContext, source, target,
    sourcePeriod, targetPeriod, resolutionPeriod, hr, beforeValues, proposedAccountingAfterValues,
    frozenSnapshotFingerprint = '' } = {}) {
    const deferredWeekId = text(deferredWeek?.deferred_week_id);
    if (!deferredWeekId) throw resolutionError('DEFERRED_WEEK_ID_REQUIRED', 'Απαιτείται deferred_week_id.');
    const weekRows = normalizeWeek(fullWeekContext);
    const deferredIdentity = validateDeferredIdentity(deferredWeek, weekRows);
    const weekDates = new Set(weekRows.map((row) => row.hmeromhnia));
    const normalizedSource = normalizeEndpoint(source, 'source', weekDates, weekRows);
    const normalizedTarget = normalizeEndpoint(target, 'target', weekDates, weekRows);
    if (normalizedSource.row_id === normalizedTarget.row_id) {
        throw resolutionError('DEFERRED_RESOLUTION_DISTINCT_ENDPOINTS_REQUIRED', 'Source και target πρέπει να είναι διαφορετικές γραμμές.');
    }
    const sourceRange = normalizePeriod(sourcePeriod, 'sourcePeriod');
    const targetRange = normalizePeriod(targetPeriod, 'targetPeriod');
    const resolutionRange = normalizePeriod(resolutionPeriod, 'resolutionPeriod');
    if (sourceRange.period_start === targetRange.period_start && sourceRange.period_end === targetRange.period_end) {
        throw resolutionError('CROSS_PERIOD_RESOLUTION_REQUIRES_DISTINCT_PERIODS', 'Η cross-period απόφαση απαιτεί διαφορετικές περιόδους source και target.');
    }
    if (sourceRange.period_start <= targetRange.period_end && targetRange.period_start <= sourceRange.period_end) {
        throw resolutionError('CROSS_PERIOD_RESOLUTION_PERIODS_OVERLAP', 'Οι source και target περίοδοι δεν επιτρέπεται να επικαλύπτονται.');
    }
    if (normalizedSource.hmeromhnia < sourceRange.period_start || normalizedSource.hmeromhnia > sourceRange.period_end ||
        normalizedTarget.hmeromhnia < targetRange.period_start || normalizedTarget.hmeromhnia > targetRange.period_end) {
        throw resolutionError('DEFERRED_RESOLUTION_ENDPOINT_PERIOD_MISMATCH', 'Source ή target δεν ανήκει στη δηλωμένη περίοδο.');
    }
    const actor = { user_id: text(hr?.user_id), user_name: text(hr?.user_name), user_role: text(hr?.user_role),
        resolved_at: text(hr?.resolved_at), resolution_reason: text(hr?.resolution_reason) };
    if (!actor.user_id || !actor.user_name || !actor.user_role || !actor.resolved_at || !actor.resolution_reason) {
        throw resolutionError('EXPLICIT_HR_RESOLUTION_REQUIRED', 'Απαιτείται ρητή και πλήρης απόφαση HR.');
    }
    const resolvedAt = new Date(actor.resolved_at);
    if (Number.isNaN(resolvedAt.getTime())) throw resolutionError('INVALID_HR_RESOLUTION_TIMESTAMP', 'Μη έγκυρο resolved_at.');
    const rawProposedRows = Array.isArray(proposedAccountingAfterValues) ? proposedAccountingAfterValues : [];
    if (!rawProposedRows.length) throw resolutionError('DEFERRED_RESOLUTION_ACCOUNTING_ROWS_REQUIRED', 'Απαιτούνται προτεινόμενες απολογιστικές τιμές.');
    const proposedRows = normalizeProposedRows(rawProposedRows,
        [normalizedSource, normalizedTarget], weekDates);
    const projections = [
        projectionFor(sourceRange, 'SOURCE_PERIOD', proposedRows),
        projectionFor(targetRange, 'TARGET_PERIOD', proposedRows)
    ];
    if (projections[0].accounting_rows.length !== 1 ||
        projections[0].accounting_rows[0].row_id !== normalizedSource.row_id ||
        projections[1].accounting_rows.length !== 1 ||
        projections[1].accounting_rows[0].row_id !== normalizedTarget.row_id) {
        throw resolutionError('DEFERRED_RESOLUTION_PROJECTION_MEMBERSHIP_INVALID', 'Οι source/target γραμμές δεν ανήκουν αποκλειστικά στις σωστές προβολές.');
    }
    const identityInput = { resolution_kind: RESOLUTION_KIND, team: deferredIdentity.team,
        company_kod: deferredIdentity.company_kod, ypokatasthma: deferredIdentity.ypokatasthma,
        employee_id: deferredIdentity.employee_id, deferred_week_id: deferredWeekId,
        week_start: weekRows[0].hmeromhnia, week_end: weekRows[6].hmeromhnia,
        source_period: sourceRange, target_period: targetRange,
        source_row_id: normalizedSource.row_id, target_row_id: normalizedTarget.row_id };
    const canonicalResolutionInput = stableValue({ identity: identityInput, deferred_week: deferredWeek,
        full_week_context: weekRows, source: normalizedSource, target: normalizedTarget,
        source_period: sourceRange, target_period: targetRange, resolution_period: resolutionRange,
        hr_resolution: actor,
        before_values: canonicalRowValues(beforeValues), proposed_accounting_after_values: proposedRows,
        frozen_snapshot_fingerprint: text(frozenSnapshotFingerprint) });
    return deepFreeze({ resolution_kind: RESOLUTION_KIND, proposal_identity: fingerprint(identityInput),
        deferred_week_id: deferredWeekId, resolution_status: RESOLUTION_STATUS,
        resolution_period_start: resolutionRange.period_start, resolution_period_end: resolutionRange.period_end,
        source_period_start: sourceRange.period_start, source_period_end: sourceRange.period_end,
        target_period_start: targetRange.period_start, target_period_end: targetRange.period_end,
        resolution_reason: actor.resolution_reason,
        resolution_fingerprint: fingerprint(canonicalResolutionInput),
        resolved_by_user_id: actor.user_id, resolved_by_user_name: actor.user_name,
        resolved_by_user_role: actor.user_role, resolved_at: resolvedAt.toISOString(),
        canonical_snapshot: canonicalResolutionInput, period_projections: projections });
}

module.exports = { RESOLUTION_KIND, RESOLUTION_STATUS, ACCOUNTING_TIME_FIELDS, stableValue, fingerprint,
    hasValidResolutionFingerprint, buildDeferredCrossPeriodRepoResolution };
