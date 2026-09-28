'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { isPersistedReferencedRedundant } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');

const ERROR_CODE = 'EMPLOYEE_OPEN_CYCLE_DEPARTURE_REQUIRED_BEFORE_HIRE_CHANGE';

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || null;
}

function guardError() {
    const error = new Error(ERROR_CODE);
    error.code = ERROR_CODE;
    error.statusCode = 409;
    return error;
}

function cycleMap(currentEmployee = null, historyRows = []) {
    const cycles = new Map();
    const add = (record, source) => {
        const hire = day(record?.hmeromhnia_proslhpshs);
        if (!hire) return;
        if (!cycles.has(hire)) cycles.set(hire, {
            hire, departureDates: new Set(), historyIds: [], sources: []
        });
        const cycle = cycles.get(hire);
        const departure = day(record?.hmeromhnia_apoxorhshs);
        if (departure) cycle.departureDates.add(departure);
        if (source === 'HISTORY' && record?._id != null) {
            cycle.historyIds.push(String(record._id));
        }
        cycle.sources.push(source);
    };
    for (const row of historyRows || []) {
        if (!isPersistedReferencedRedundant(row)) add(row, 'HISTORY');
    }
    if (currentEmployee) add(currentEmployee, 'CURRENT');
    return cycles;
}

function latestCurrentCycle(currentEmployee, historyRows) {
    const cycles = cycleMap(currentEmployee, historyRows);
    const currentHire = day(currentEmployee?.hmeromhnia_proslhpshs);
    const latestHire = [...cycles.keys()].sort().at(-1) || null;
    return { cycles, currentHire,
        cycle: latestHire ? cycles.get(latestHire) || null : null };
}

function requestedHire(operation = {}) {
    const maintenance = operation.maintenance || {};
    const values = [
        maintenance.historyChanges?.hmeromhnia_proslhpshs,
        maintenance.employeeChanges?.hmeromhnia_proslhpshs
    ].filter(value => value !== undefined && value !== null && value !== '');
    const dates = [...new Set(values.map(day).filter(Boolean))];
    return dates.length === 1 ? dates[0] : dates.length > 1 ? 'CONFLICT' : null;
}

function assertHistoryOperationIntent({ currentEmployee, historyRows = [], operations = [] } = {}) {
    const before = latestCurrentCycle(currentEmployee, historyRows);
    if (!before.cycle || before.cycle.departureDates.size > 0) return;
    const rowsById = new Map((historyRows || []).map(row => [String(row._id), row]));
    for (const operation of operations || []) {
        if (!['inserted', 'modified'].includes(operation?.state)) continue;
        const requested = requestedHire(operation);
        if (requested === 'CONFLICT') throw guardError();
        if (operation.state === 'inserted') {
            if (requested && requested !== before.cycle.hire) throw guardError();
            continue;
        }
        const target = rowsById.get(String(operation.historyId));
        const targetHire = day(target?.hmeromhnia_proslhpshs);
        if (requested && requested !== targetHire && targetHire === before.cycle.hire) {
            throw guardError();
        }
        const requestedHireFlag = operation.maintenance?.historyChanges?.afora_proslhpsh;
        if (requestedHireFlag === true && target?.afora_proslhpsh !== true &&
            requested && requested !== targetHire) {
            throw guardError();
        }
    }
}

function assertFinalHireBoundaries({ currentBefore, historyBefore = [], currentAfter,
    historyAfter = [] } = {}) {
    if (!currentBefore || !currentAfter) return;
    const before = latestCurrentCycle(currentBefore, historyBefore);
    if (!before.cycle || before.cycle.departureDates.size > 0) return;

    const after = latestCurrentCycle(currentAfter, historyAfter);
    if (after.currentHire !== before.currentHire) throw guardError();

    const beforeHires = new Set(before.cycles.keys());
    const afterHires = new Set(after.cycles.keys());
    const added = [...afterHires].filter(hire => !beforeHires.has(hire));
    const removed = [...beforeHires].filter(hire => !afterHires.has(hire));
    if (!added.length && !removed.length) return;

    const beforeById = new Map((historyBefore || []).filter(row => row?._id != null)
        .map(row => [String(row._id), row]));
    const afterById = new Map((historyAfter || []).filter(row => row?._id != null)
        .map(row => [String(row._id), row]));
    const moved = [...beforeById].map(([id, row]) => ({
        id,
        beforeHire: day(row.hmeromhnia_proslhpshs),
        afterHire: day(afterById.get(id)?.hmeromhnia_proslhpshs)
    })).filter(item => item.afterHire && item.beforeHire !== item.afterHire);
    const insertedNewHire = [...afterById].some(([id, row]) =>
        !beforeById.has(id) && !beforeHires.has(day(row.hmeromhnia_proslhpshs)));
    const replacementOfOldClosedCycles = added.length > 0 &&
        added.length === removed.length;
    const removalOfOldClosedCycles = added.length === 0 && removed.length > 0;
    const onlyOldClosedCyclesChanged = !insertedNewHire &&
        (replacementOfOldClosedCycles || removalOfOldClosedCycles) &&
        removed.every(hire => hire !== before.cycle.hire &&
            before.cycles.get(hire)?.departureDates.size === 1) &&
        added.every(hire => hire < before.cycle.hire &&
            after.cycles.get(hire)?.departureDates.size === 1) &&
        moved.every(item => item.beforeHire !== before.cycle.hire &&
            item.afterHire !== before.cycle.hire &&
            before.cycles.get(item.beforeHire)?.departureDates.size === 1 &&
            after.cycles.get(item.afterHire)?.departureDates.size === 1);
    if (!onlyOldClosedCyclesChanged) throw guardError();
}

function assertOpenCycleHireGuard(input = {}) {
    assertHistoryOperationIntent(input);
    assertFinalHireBoundaries(input);
}

module.exports = { ERROR_CODE, assertOpenCycleHireGuard };
