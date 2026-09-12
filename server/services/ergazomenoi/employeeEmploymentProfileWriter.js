'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { IDENTITY_FIELDS, NEW_CURRENT_FIELDS, semanticEmploymentProfileChanged } = require('../../utils/ergazomenoi/employmentProfileTransition');
const { BASE_HISTORY_FIELDS, buildCompleteProfileSnapshot, effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');

const MODE_NEW_VERSION = 'MODE_NEW_VERSION';
const MODE_CORRECT_EXISTING = 'MODE_CORRECT_EXISTING';
// Selected internally from fresh transactional reads; callers cannot force it.
const MODE_LEGACY_MAINTENANCE = 'MODE_LEGACY_MAINTENANCE';

async function transactionCapability(connection) {
    const hello = await connection.db.admin().command({ hello: 1 });
    return Boolean((hello.setName || hello.msg === 'isdbgrid') && hello.logicalSessionTimeoutMinutes > 0);
}
function failure(code) { const error = new Error(code); error.code = code; error.statusCode = 409; return error; }

// Private session sharing keeps all accepted history operations in one transaction.
const ACTIVE_SESSION = Symbol('employeeProfileTransaction');
const EDITOR_OPERATION = Symbol('historyEditorOperation');
async function inProfileTransaction(connection, capabilityProbe, work, activeSession = null) {
    if (activeSession) return work(activeSession);
    let capable = false;
    try { capable = await capabilityProbe(connection); } catch { capable = false; }
    if (!capable) throw failure('EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE');
    const session = await connection.startSession();
    try {
        let result;
        await session.withTransaction(async () => { result = await work(session); });
        return result;
    } finally { await session.endSession(); }
}
async function writeEmployeeEmploymentProfileCorrections({ scope, employeeId, corrections,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, capabilityProbe = transactionCapability }) {
    if (!Array.isArray(corrections) || !corrections.length ||
        corrections.some(item => !item.historyId) || new Set(corrections.map(item => item.historyId)).size !== corrections.length) {
        C.invalid('historyId', 'unique exact correction identities required');
    }
    return inProfileTransaction(connection, capabilityProbe, async session => {
        const results = [];
        for (const correction of corrections) results.push(await writeEmployeeEmploymentProfile({
            ...correction, scope, employeeId, mode: MODE_CORRECT_EXISTING,
            connection, employeeModel, historyModel, capabilityProbe, [ACTIVE_SESSION]: session
        }));
        return results;
    });
}

// The existing editor batches modifications, append insertions and exact deletions.
// Deletions never reopen/extend neighbors or restore current from another period:
// neither action exists in the baseline editor.
async function writeEmployeeEmploymentHistoryOperations({ scope, employeeId, operations,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, capabilityProbe = transactionCapability }) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every(key => typeof scope[key] === 'string' && scope[key].trim())) C.invalid('scope', 'complete scope required');
    if (typeof employeeId !== 'string' || !employeeId || !Array.isArray(operations) ||
        operations.some(op => !['modified', 'inserted', 'deleted'].includes(op.state) ||
            (op.state !== 'inserted' && (typeof op.historyId !== 'string' || !op.historyId)))) C.invalid('historyId', 'exact history operation required');
    const identities = operations.filter(op => op.state !== 'inserted').map(op => op.historyId);
    if (new Set(identities).size !== identities.length) C.invalid('historyId', 'duplicate operations on the same row');
    const filter = Object.fromEntries(['team', 'company_kod', 'kodikos'].map(key => [key, scope[key]]));
    return inProfileTransaction(connection, capabilityProbe, async session => {
        const current = await employeeModel.findOne({ ...filter, _id: employeeId }).session(session).lean();
        if (!current) throw failure('EMPLOYEE_PROFILE_NOT_FOUND');
        const originalRows = await historyModel.find(filter).session(session).lean();
        const originalLatest = Math.max(0, ...originalRows.map(row => effectiveStart(row)?.getTime() || 0));
        const appendFloor = Math.max(originalLatest, effectiveStart(current)?.getTime() || 0);
        const deleted = [];
        for (let op of operations) {
            if (op.state === 'deleted') {
                const rows = await historyModel.find(filter).session(session).lean();
                const target = rows.find(row => String(row._id) === op.historyId);
                if (!target) throw failure('EMPLOYEE_PROFILE_DELETE_IDENTITY_MISMATCH');
                const result = await historyModel.deleteOne({ ...filter, _id: target._id }, { session });
                if (result.deletedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                deleted.push(target);
            } else {
                if (op.state === 'modified') {
                    const rows = await historyModel.find(filter).session(session).lean();
                    const target = rows.find(row => String(row._id) === op.historyId);
                    if (!target) throw failure('EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
                    const submitted = op.maintenance.submittedFields || Object.keys(op.maintenance.historyChanges);
                    const patch = { ...op.maintenance.historyChanges };
                    const sameDate = (a, b) => (C.calendarDate(a)?.getTime() ?? null) === (C.calendarDate(b)?.getTime() ?? null);
                    if (!submitted.includes('hmeromhnia_isxyos_oron_ergasias_apo')) {
                        const changedScheduleStart = submitted.includes('hmeromhnia_allaghs_orarioy_apo') &&
                            !sameDate(patch.hmeromhnia_allaghs_orarioy_apo, target.hmeromhnia_allaghs_orarioy_apo);
                        patch.hmeromhnia_isxyos_oron_ergasias_apo = changedScheduleStart
                            ? patch.hmeromhnia_allaghs_orarioy_apo : effectiveStart(target);
                    }
                    if (!submitted.includes('hmeromhnia_isxyos_oron_ergasias_eos')) {
                        patch.hmeromhnia_isxyos_oron_ergasias_eos = effectiveEnd(target);
                    }
                    op = { ...op, effectiveFrom: patch.hmeromhnia_isxyos_oron_ergasias_apo,
                        maintenance: { ...op.maintenance, historyChanges: patch, employeeChanges: patch } };
                }
                if (op.state === 'inserted' && C.calendarDate(op.effectiveFrom)?.getTime() <= appendFloor) throw failure('EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
                const result = await writeEmployeeEmploymentProfile({ ...op, scope, employeeId,
                    historyId: op.state === 'inserted' ? null : op.historyId,
                    mode: op.state === 'inserted' ? MODE_NEW_VERSION : MODE_CORRECT_EXISTING,
                    connection, employeeModel, historyModel, capabilityProbe,
                    [ACTIVE_SESSION]: session, [EDITOR_OPERATION]: true });
                if (op.state === 'inserted') {
                    // Baseline editor inserts at 0000 before sorting and renumbering.
                    const changed = await historyModel.updateOne({ ...filter, _id: result.history._id },
                        { $set: { aa_eggrafhs: '0000' } }, { session });
                    if (changed.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                }
            }
        }
        if (deleted.length) {
            const finalCurrent = await employeeModel.findOne({ ...filter, _id: employeeId }).session(session).lean();
            const remaining = await historyModel.find(filter).session(session).lean();
            const from = effectiveStart(finalCurrent)?.getTime();
            const needsSupport = deleted.some(row =>
                (C.readEmploymentProfile(row).recorded || C.readEmploymentProfile(finalCurrent).recorded) &&
                (effectiveStart(row)?.getTime() === from || effectiveStart(row)?.getTime() === originalLatest));
            const supporting = remaining.some(row => effectiveStart(row)?.getTime() === from &&
                C.readEmploymentProfile(row).recorded && C.FACT_FIELDS.every(field => {
                    const value = source => [C.FROM, C.UNTIL].includes(field)
                        ? C.calendarDate(source[field])?.getTime() ?? null : source[field];
                    return JSON.stringify(value(row)) === JSON.stringify(value(finalCurrent));
                }));
            if (needsSupport && !supporting) throw failure('EMPLOYEE_PROFILE_DELETE_CURRENT_VERSION_UNSUPPORTED');
        }
        // Exact baseline ordering, including inserted 0000 rows. Only aa changes.
        const rows = await historyModel.find(filter).session(session).sort({ aa_eggrafhs: 1, createdAt: 1, _id: 1 }).lean();
        for (let index = 0; index < rows.length; index++) {
            const changed = await historyModel.updateOne({ ...filter, _id: rows[index]._id },
                { $set: { aa_eggrafhs: String(index + 1).padStart(4, '0') } }, { session });
            if (changed.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
        }
        return { success: true };
    });
}


const HISTORY_CURRENT_FIELDS = new Set([...BASE_HISTORY_FIELDS, ...IDENTITY_FIELDS, ...C.FACT_FIELDS,
    'eidikh_kathgoria_ergazomenoy', 'afora_allagh_oron_ergasias', 'afora_proslhpsh', 'afora_allagh_dialleimatos', 'hmeromhnia_isxyos_dialleimatos_apo',
    'kathestos_apasxolhshs', 'typos_apasxolhshs', 'typos_ebdomadas', 'apasxolhsh_basei_symbashs',
    'pososto_prosayxhshs_6hs_hmeras', 'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias']);
function cleanMaintenancePatch(patch = {}) {
    return Object.fromEntries(Object.entries(patch).filter(([field, value]) => value !== undefined &&
        !C.FACT_FIELDS.includes(field) && !['_id', 'team', 'company_kod', 'kodikos', 'aa_eggrafhs',
            'createdAt', T.ANCHOR, 'employment_profile_source'].includes(field)));
}
function legacyMaintenancePatch(patch = {}, stored, history = false) {
    const changes = cleanMaintenancePatch(patch);
    // Baseline current mapping included scalar profile facts; history did not.
    // Never fill a missing legacy fact merely because the form supplied a default.
    if (!history) for (const field of C.FACT_FIELDS) {
        if (!NEW_CURRENT_FIELDS.includes(field) && Object.hasOwn(stored, field) && patch[field] !== undefined) changes[field] = patch[field];
    }
    for (const field of [...NEW_CURRENT_FIELDS, ...T.STANDARD_FIELDS]) {
        if (NEW_CURRENT_FIELDS.includes(field) || (stored && !Object.hasOwn(stored, field))) delete changes[field];
    }
    if (history && patch.employment_profile_source !== undefined) changes.employment_profile_source = patch.employment_profile_source;
    return changes;
}
function selectMaintenanceMode(rows, identity) {
    if (!identity || !IDENTITY_FIELDS.every(field => Object.hasOwn(identity, field))) C.invalid('historyIdentity', 'complete identity required');
    const date = (row, field) => field === 'hmeromhnia_isxyos_oron_ergasias_apo' ? effectiveStart(row) :
        C.calendarDate(row[field], field);
    const matches = rows.filter(row => IDENTITY_FIELDS.every(field =>
        (date(row, field)?.getTime() ?? null) === (date(identity, field)?.getTime() ?? null)));
    if (matches.length > 1) throw failure('EMPLOYEE_PROFILE_AMBIGUOUS_IDENTITY');
    return matches.length ? { mode: MODE_CORRECT_EXISTING, historyId: String(matches[0]._id) } :
        { mode: MODE_NEW_VERSION, historyId: null };
}

// Shared Add/Edit/profile writer. Never falls
// back to two independent writes on standalone MongoDB. Same transaction pattern
// as the existing weekly repo-transfer writer, without coupling its payroll code.
// New versions append chronologically. Corrections target an exact existing row
// without moving its boundaries. Retrospective INSERTION remains unsupported.
// The existing business-code allocator still owns uniqueness for NEW employees:
// the repository has no unique employee business-key index. This writer guarantees
// current/history atomicity, not cross-route concurrent code allocation.
async function writeEmployeeEmploymentProfile({ scope, input = {}, effectiveFrom, newEmployee = null, employeeId = null,
    mode = MODE_NEW_VERSION, historyId = null, maintenance = null, [ACTIVE_SESSION]: activeSession = null, [EDITOR_OPERATION]: editorOperation = false,
    connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, capabilityProbe = transactionCapability }) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every((key) => typeof scope[key] === 'string' && scope[key].trim())) {
        C.invalid('scope', 'team, company_kod and kodikos required');
    }
    if (![MODE_NEW_VERSION, MODE_CORRECT_EXISTING].includes(mode)) C.invalid('mode', 'unsupported mode');
    if (mode === MODE_CORRECT_EXISTING && (newEmployee || typeof historyId !== 'string' || !historyId.trim())) {
        C.invalid('historyId', 'correction requires an exact historical ID and an existing employee');
    }
    if (mode === MODE_NEW_VERSION && historyId !== null) C.invalid('historyId', 'not allowed for new version');
    const filter = Object.fromEntries(['team', 'company_kod', 'kodikos'].map((key) => [key, scope[key]]));
    for (const field of Object.keys(input)) if (!C.FACT_FIELDS.includes(field)) C.invalid(field, 'not an employment profile fact');
    let from = effectiveFrom ? C.calendarDate(effectiveFrom, 'effectiveFrom') : null;
    return inProfileTransaction(connection, capabilityProbe, async session => {
        let result;
        const submittedInput = input, submittedMaintenance = maintenance;
        const write = async () => {
            let input = submittedInput, maintenance = submittedMaintenance;
            const current = await employeeModel.findOne(employeeId ? { ...filter, _id: employeeId } : filter).session(session).lean();
            if (employeeId && String(current?._id) !== String(employeeId)) throw failure('EMPLOYEE_PROFILE_STALE');
            if (newEmployee && current) throw failure('EMPLOYEE_PROFILE_ALREADY_EXISTS');
            if (!newEmployee && !current) throw failure('EMPLOYEE_PROFILE_NOT_FOUND');
            const rows = await historyModel.find(filter).session(session).lean();
            if (!from && maintenance && current && rows.length === 0) {
                const proposed = { ...current, ...Object.fromEntries(Object.entries(
                    maintenance.employeeChanges || {}).filter(([, value]) => value !== undefined)) };
                for (const field of ['hmeromhnia_isxyos_oron_ergasias_apo',
                    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_proslhpshs']) {
                    from = C.calendarDate(proposed[field], field);
                    if (from) break;
                }
            }
            if (!from) C.invalid('effectiveFrom', 'required safe baseline date');
            // Enforce the form policy before even the legacy Maintenance shortcut.
            // Use mapped employee category (Add and Edit have different form names).
            if (!editorOperation && (newEmployee || maintenance)) {
                const context = { ...(current || newEmployee), ...Object.fromEntries(
                    Object.entries(maintenance?.employeeChanges || {}).filter(([, value]) => value !== undefined)) };
                const breaks = C.normalizeEmploymentBreakSubmission(input, context, { allowLegacyDuration: false });
                input = { ...input, ...breaks };
                // The legacy path writes the mapped patch rather than snapshot facts.
                if (maintenance) maintenance = { ...maintenance,
                    employeeChanges: { ...maintenance.employeeChanges, ...breaks } };
                if (context.eidikh_kathgoria_ergazomenoy !== undefined) maintenance = { ...maintenance,
                    historyChanges: { ...maintenance?.historyChanges, eidikh_kathgoria_ergazomenoy: context.eidikh_kathgoria_ergazomenoy } };
            }
            const datedRows = rows.filter((row) => effectiveStart(row));
            // Maintenance supplies existing server-mapped fields, never raw request data.
            // Resolve the exact identity inside the transaction, including on retries.
            const legacyMaintenance = !editorOperation && maintenance && !newEmployee && !T.versioned(current, rows) &&
                !semanticEmploymentProfileChanged(current, maintenance, input);
            const patch = legacyMaintenance ? legacyMaintenancePatch(maintenance.employeeChanges, current) : cleanMaintenancePatch(maintenance?.employeeChanges);
            let historyPatch = cleanMaintenancePatch(maintenance?.historyChanges);
            const correctableIdentityFields = new Set(maintenance?.correctableIdentityFields || []);
            if ([...correctableIdentityFields].some(field => field !== 'hmeromhnia_apoxorhshs')) {
                C.invalid('correctableIdentityFields', 'unsupported maintenance identity correction');
            }
            const selection = !editorOperation && maintenance && !newEmployee && mode === MODE_NEW_VERSION
                ? (rows.length ? selectMaintenanceMode(rows, maintenance.identity) :
                    { mode: MODE_NEW_VERSION, historyId: null }) : { mode, historyId };
            const selectedHistoryId = selection.historyId;
            if (selection.mode === MODE_CORRECT_EXISTING) {
                const target = rows.find((row) => String(row._id) === selectedHistoryId);
                if (!target || !effectiveStart(target) || (!editorOperation && effectiveStart(target).getTime() !== from.getTime())) {
                    throw failure('EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
                }
                if (!editorOperation && maintenance?.identity && selectMaintenanceMode([target], maintenance.identity).historyId !== selectedHistoryId) {
                    throw failure('EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
                }
                const originalFrom = effectiveStart(target);
                const latest = !datedRows.some(row => effectiveStart(row) > originalFrom);
                const end = editorOperation && (Object.hasOwn(target, 'hmeromhnia_isxyos_oron_ergasias_eos') ||
                    historyPatch.hmeromhnia_isxyos_oron_ergasias_eos != null)
                    ? C.calendarDate(historyPatch.hmeromhnia_isxyos_oron_ergasias_eos) : effectiveEnd(target);
                const baseline = T.anchor(current);
                if (editorOperation && baseline && originalFrom.getTime() === T.day(baseline.before).getTime() && from.getTime() !== originalFrom.getTime()) {
                    throw failure('EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED');
                }
                const boundaryChanged = from.getTime() !== originalFrom.getTime() ||
                    (end?.getTime() ?? null) !== (effectiveEnd(target)?.getTime() ?? null);
                if (editorOperation && boundaryChanged && (!latest || from < originalFrom ||
                    (end && end < from) || !C.readEmploymentProfile(target).recorded)) {
                    throw failure('EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED');
                }
                if (datedRows.some((row) => String(row._id) !== selectedHistoryId &&
                    (!end || effectiveStart(row) <= end) && (!effectiveEnd(row) || effectiveEnd(row) >= from))) {
                    throw failure('EMPLOYEE_PROFILE_HISTORY_OVERLAP');
                }
                const currentFrom = effectiveStart(current);
                // A latest-row correction can update current only when its identity
                // agrees. Missing current dates are allowed for legacy Maintenance.
                if (latest && currentFrom && currentFrom.getTime() !== originalFrom.getTime()) {
                    throw failure('EMPLOYEE_PROFILE_CURRENT_IDENTITY_MISMATCH');
                }
                if (!latest || editorOperation) {
                    // Never fill an old historical gap from today's employee facts.
                    // Missing facts need an explicit correction, not inferred false/0.
                    const missing = C.readEmploymentProfile(target).unrecordedFields.filter((field) =>
                        ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field) &&
                        (!Object.prototype.hasOwnProperty.call(input, field) || input[field] === undefined));
                    if (missing.length) throw failure('EMPLOYEE_PROFILE_LEGACY_CORRECTION_REQUIRES_FACTS');
                }
                if (legacyMaintenance) historyPatch = legacyMaintenancePatch(maintenance.historyChanges, target, true);
                const source = { ...(latest && !editorOperation ? { ...current, ...target } : target), ...historyPatch };
                const snapshot = legacyMaintenance ? {} : buildCompleteProfileSnapshot({ input, current: source, effectiveFrom: from });
                const capturedBaseline = latest && !legacyMaintenance ? T.capture(current, rows, from) : null;
                const facts = legacyMaintenance ? {} : Object.fromEntries(C.FACT_FIELDS.map((field) => [field, snapshot[field]]));
                const currentChanges = latest ? { ...patch, ...facts, ...(capturedBaseline ? { [T.ANCHOR]: capturedBaseline } : {}) } :
                    Object.fromEntries(Object.entries(patch).filter(([field]) => !HISTORY_CURRENT_FIELDS.has(field)));
                if (Object.keys(currentChanges).length) {
                    const update = await employeeModel.updateOne({ ...filter, _id: current._id },
                        { $set: currentChanges }, { session });
                    if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_STALE');
                }
                // Include the existing Maintenance contract mapping; preserve all
                // identity dates, sequence, creation time and surrounding rows.
                const correction = legacyMaintenance ? { ...historyPatch } : { ...historyPatch, ...snapshot,
                    afora_allagh_dialleimatos: true, hmeromhnia_isxyos_dialleimatos_apo: from };
                // Corrections cannot move any identity date or overwrite the sequence.
                for (const field of IDENTITY_FIELDS) {
                    if (!correctableIdentityFields.has(field)) delete correction[field];
                }
                if (editorOperation) {
                    for (const field of IDENTITY_FIELDS) {
                        const value = historyPatch[field];
                        if ((C.calendarDate(value)?.getTime() ?? null) !== (C.calendarDate(target[field])?.getTime() ?? null)) {
                            correction[field] = value;
                        }
                    }
                    if (boundaryChanged) {
                        correction.hmeromhnia_isxyos_oron_ergasias_apo = from;
                        correction.hmeromhnia_isxyos_oron_ergasias_eos = end;
                    }
                }
                const update = await historyModel.updateOne({ ...filter, _id: target._id,
                    hmeromhnia_isxyos_oron_ergasias_apo: target.hmeromhnia_isxyos_oron_ergasias_apo ?? null,
                    hmeromhnia_allaghs_orarioy_apo: target.hmeromhnia_allaghs_orarioy_apo ?? null },
                { $set: correction }, { session });
                if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                result = { facts, history: { ...target, ...correction }, currentUpdated: latest,
                    employee: { ...current, ...currentChanges }, mode: legacyMaintenance ? MODE_LEGACY_MAINTENANCE : selection.mode };
                return;
            }
            if (datedRows.some((row) => effectiveStart(row) >= from)) throw failure('EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
            const openRows = datedRows.filter((row) => !effectiveEnd(row) || effectiveEnd(row) >= from);
            if (openRows.length > 1) throw failure('EMPLOYEE_PROFILE_HISTORY_OVERLAP');
            if (legacyMaintenance) historyPatch = legacyMaintenancePatch(maintenance.historyChanges, null, true);
            if (maintenance && rows.length === 0 &&
                !C.calendarDate(historyPatch.hmeromhnia_isxyos_oron_ergasias_apo)) {
                historyPatch.hmeromhnia_isxyos_oron_ergasias_apo = from;
            }
            const snapshot = legacyMaintenance ? {} : buildCompleteProfileSnapshot({ input,
                current: { ...(current || newEmployee), ...patch, ...historyPatch }, effectiveFrom: from });
            const facts = legacyMaintenance ? {} : Object.fromEntries(C.FACT_FIELDS.map((field) => [field, snapshot[field]]));
            const until = C.calendarDate(historyPatch.hmeromhnia_isxyos_oron_ergasias_eos);
            if (until && until < from) C.invalid('hmeromhnia_isxyos_oron_ergasias_eos', 'end precedes start');
            if (!legacyMaintenance) snapshot.hmeromhnia_isxyos_oron_ergasias_eos = until;
            const baseline = legacyMaintenance ? null : T.capture(current, rows, from);
            const currentUpdate = legacyMaintenance ? patch : { ...patch, ...facts, ...(baseline ? { [T.ANCHOR]: baseline } : {}),
                hmeromhnia_isxyos_oron_ergasias_apo: snapshot.hmeromhnia_isxyos_oron_ergasias_apo,
                hmeromhnia_isxyos_oron_ergasias_eos: until };
            let employee;
            if (current) {
                employee = { ...current, ...currentUpdate };
                // Updating the employee inside the transaction serializes competing
                // profile writes. Mongo write conflicts retry the entire fresh read.
                const update = await employeeModel.updateOne({ ...filter, _id: current._id }, { $set: currentUpdate }, { session });
                if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_STALE');
            } else {
                [employee] = await employeeModel.create([{ ...newEmployee, ...filter, ...currentUpdate }], { session });
            }
            if (openRows[0]) {
                const until = new Date(from); until.setUTCDate(until.getUTCDate() - 1);
                const closed = await historyModel.updateOne({ ...filter, _id: openRows[0]._id },
                    { $set: { hmeromhnia_isxyos_oron_ergasias_eos: until } }, { session });
                if (closed.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
            }
            const sequence = Math.max(0, ...rows.map((row) => Number(row.aa_eggrafhs) || 0)) + 1;
            const record = { ...historyPatch, ...filter, ...snapshot,
                aa_eggrafhs: String(sequence).padStart(4, '0'),
                afora_proslhpsh: historyPatch.afora_proslhpsh ?? !current };
            // Carry original omission context into schema validation for inherited legacy breaks.
            const historyDocument = typeof historyModel === 'function' ? new historyModel(record) : record;
            // Mongoose defaults are not legacy facts. A baseline-compatible history
            // insertion must also remain physically unversioned after construction.
            if (legacyMaintenance && historyDocument.set) for (const field of C.FACT_FIELDS) historyDocument.set(field, undefined);
            if (!legacyMaintenance && historyDocument.$locals) historyDocument.$locals.employmentProfileValidation = { input,
                current: { ...(current || newEmployee), ...patch, ...historyPatch } };
            const [history] = await historyModel.create([historyDocument], { session });
            result = { facts, history, employee, mode: legacyMaintenance ? MODE_LEGACY_MAINTENANCE : selection.mode };
        };
        await write();
        // Created documents are used by the existing post-commit PDF workflow.
        result.employee?.$session?.(null);
        return result;
    }, activeSession);
}
module.exports = { MODE_NEW_VERSION, MODE_CORRECT_EXISTING, MODE_LEGACY_MAINTENANCE, transactionCapability, writeEmployeeEmploymentProfile, writeEmployeeEmploymentProfileCorrections, writeEmployeeEmploymentHistoryOperations, selectMaintenanceMode };
