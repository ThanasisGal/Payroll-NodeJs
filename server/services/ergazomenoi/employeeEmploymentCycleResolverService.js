'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

const STATUS = Object.freeze({
    EMPLOYED: 'EMPLOYED',
    NO_EMPLOYMENT_HISTORY: 'NO_EMPLOYMENT_HISTORY',
    BEFORE_FIRST_HIRE: 'BEFORE_FIRST_HIRE',
    BETWEEN_CYCLES: 'BETWEEN_CYCLES',
    AFTER_LAST_DEPARTURE: 'AFTER_LAST_DEPARTURE'
});

function lifecycleError(code, details = {}) {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 409;
    error.details = details;
    return error;
}

function rowOrderValue(row = {}, fallbackIndex = 0) {
    const date = dateKeyUtc(
        row.hmeromhnia_isxyos_oron_ergasias_apo ||
        row.hmeromhnia_allaghs_orarioy_apo ||
        row.hmeromhnia_allaghs_symbashs ||
        row.createdAt ||
        row.hmeromhnia_proslhpshs
    ) || '';

    const createdAt = row.createdAt
        ? new Date(row.createdAt).getTime()
        : 0;

    const sequence = Number(row.aa_eggrafhs) || 0;

    return {
        date,
        createdAt: Number.isFinite(createdAt) ? createdAt : 0,
        sequence,
        fallbackIndex
    };
}

function compareRowOrder(left, right) {
    for (const key of ['date', 'createdAt', 'sequence', 'fallbackIndex']) {
        if (left[key] < right[key]) return -1;
        if (left[key] > right[key]) return 1;
    }

    return 0;
}

function normalizeEvidence(row = {}, source, fallbackIndex = 0) {
    const hire = dateKeyUtc(row.hmeromhnia_proslhpshs);

    if (!hire) return null;

    const departure = dateKeyUtc(row.hmeromhnia_apoxorhshs);

    return Object.freeze({
        source,
        source_id: row._id == null ? null : String(row._id),
        hire_date: hire,
        departure_date: departure,
        order: rowOrderValue(row, fallbackIndex)
    });
}

function buildEmploymentCycles({
    currentEmployee = null,
    history = []
} = {}) {
    const grouped = new Map();
    const rows = Array.isArray(history) ? history : [];

    rows.forEach((row, index) => {
        const evidence = normalizeEvidence(row, 'HISTORY', index);

        if (!evidence) return;

        if (!grouped.has(evidence.hire_date)) {
            grouped.set(evidence.hire_date, []);
        }

        grouped.get(evidence.hire_date).push(evidence);
    });

    const currentEvidence = normalizeEvidence(
        currentEmployee || {},
        'CURRENT',
        rows.length
    );

    if (currentEvidence) {
        if (!grouped.has(currentEvidence.hire_date)) {
            grouped.set(currentEvidence.hire_date, []);
        }

        grouped.get(currentEvidence.hire_date).push(currentEvidence);
    }

    const cycles = [...grouped.entries()]
        .map(([hireDate, evidenceRows]) => {
            const historyEvidence = evidenceRows
                .filter((item) => item.source === 'HISTORY')
                .sort((a, b) => compareRowOrder(a.order, b.order));

            const current =
                evidenceRows.find((item) => item.source === 'CURRENT') || null;

            const authoritative =
                current || historyEvidence[historyEvidence.length - 1];

            return {
                hire_date: hireDate,
                departure_date: authoritative?.departure_date || null,
                is_current_cycle: Boolean(current),
                source: authoritative?.source || null,
                source_id: authoritative?.source_id || null,
                history_ids: historyEvidence
                    .map((item) => item.source_id)
                    .filter(Boolean)
            };
        })
        .sort((a, b) => a.hire_date.localeCompare(b.hire_date));

    for (let index = 0; index < cycles.length; index += 1) {
        const cycle = cycles[index];

        if (
            cycle.departure_date &&
            cycle.departure_date < cycle.hire_date
        ) {
            throw lifecycleError(
                'EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE',
                { cycle }
            );
        }

        const next = cycles[index + 1];

        if (!next) continue;

        if (!cycle.departure_date) {
            throw lifecycleError(
                'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE',
                { cycle, next }
            );
        }

        if (cycle.departure_date >= next.hire_date) {
            throw lifecycleError(
                'EMPLOYMENT_CYCLE_OVERLAP',
                { cycle, next }
            );
        }
    }

    return Object.freeze(
        cycles.map((cycle, index) =>
            Object.freeze({
                cycle_no: index + 1,
                ...cycle,
                history_ids: Object.freeze([...cycle.history_ids])
            })
        )
    );
}

function resolveEmploymentCycleForDate(value, input = {}) {
    const date = dateKeyUtc(value);

    if (!date) {
        throw lifecycleError(
            'EMPLOYMENT_CYCLE_INVALID_DATE',
            { value }
        );
    }

    const cycles = buildEmploymentCycles(input);

    if (!cycles.length) {
        return Object.freeze({
            status: STATUS.NO_EMPLOYMENT_HISTORY,
            date,
            cycle: null,
            previous_cycle: null,
            next_cycle: null,
            cycles
        });
    }

    const matches = cycles.filter(
        (cycle) =>
            date >= cycle.hire_date &&
            (!cycle.departure_date || date <= cycle.departure_date)
    );

    if (matches.length > 1) {
        throw lifecycleError(
            'EMPLOYMENT_CYCLE_AMBIGUOUS_DATE',
            { date, matches }
        );
    }

    if (matches.length === 1) {
        const cycle = matches[0];

        return Object.freeze({
            status: STATUS.EMPLOYED,
            date,
            cycle,
            previous_cycle: cycles[cycle.cycle_no - 2] || null,
            next_cycle: cycles[cycle.cycle_no] || null,
            cycles
        });
    }

    const previous =
        [...cycles]
            .reverse()
            .find(
                (cycle) =>
                    cycle.departure_date &&
                    cycle.departure_date < date
            ) || null;

    const next =
        cycles.find((cycle) => cycle.hire_date > date) || null;

    const status =
        !previous && next
            ? STATUS.BEFORE_FIRST_HIRE
            : previous && next
                ? STATUS.BETWEEN_CYCLES
                : previous && !next
                    ? STATUS.AFTER_LAST_DEPARTURE
                    : STATUS.NO_EMPLOYMENT_HISTORY;

    return Object.freeze({
        status,
        date,
        cycle: null,
        previous_cycle: previous,
        next_cycle: next,
        cycles
    });
}

function isDateWithinEmploymentCycles(value, input = {}) {
    return (
        resolveEmploymentCycleForDate(value, input).status ===
        STATUS.EMPLOYED
    );
}

module.exports = {
    STATUS,
    buildEmploymentCycles,
    resolveEmploymentCycleForDate,
    isDateWithinEmploymentCycles
};
