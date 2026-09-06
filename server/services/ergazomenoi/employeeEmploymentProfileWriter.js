'use strict';

const mongoose = require('mongoose');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot, effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');

const MODE_NEW_VERSION = 'MODE_NEW_VERSION';
const MODE_CORRECT_EXISTING = 'MODE_CORRECT_EXISTING';

async function transactionCapability(connection) {
    const hello = await connection.db.admin().command({ hello: 1 });
    return Boolean((hello.setName || hello.msg === 'isdbgrid') && hello.logicalSessionTimeoutMinutes > 0);
}
function failure(code) { const error = new Error(code); error.code = code; error.statusCode = 409; return error; }

// Foundation-only writer; route/UI activation is a separate slice. Never falls
// back to two independent writes on standalone MongoDB. Same transaction pattern
// as the existing weekly repo-transfer writer, without coupling its payroll code.
// New versions append chronologically. Corrections target an exact existing row
// without moving its boundaries. Retrospective INSERTION remains unsupported.
// The existing business-code allocator still owns uniqueness for NEW employees:
// the repository has no unique employee business-key index. This writer guarantees
// current/history atomicity, not cross-route concurrent code allocation.
async function writeEmployeeEmploymentProfile({ scope, input = {}, effectiveFrom, newEmployee = null,
    mode = MODE_NEW_VERSION, historyId = null,
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
    const from = C.calendarDate(effectiveFrom, 'effectiveFrom');
    if (!from) C.invalid('effectiveFrom', 'required');
    let capable = false;
    try { capable = await capabilityProbe(connection); } catch { capable = false; }
    if (!capable) throw failure('EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE');
    const session = await connection.startSession();
    let result;
    try {
        await session.withTransaction(async () => {
            const current = await employeeModel.findOne(filter).session(session).lean();
            if (newEmployee && current) throw failure('EMPLOYEE_PROFILE_ALREADY_EXISTS');
            if (!newEmployee && !current) throw failure('EMPLOYEE_PROFILE_NOT_FOUND');
            const rows = await historyModel.find(filter).session(session).lean();
            const datedRows = rows.filter((row) => effectiveStart(row));
            if (mode === MODE_CORRECT_EXISTING) {
                const target = rows.find((row) => String(row._id) === historyId);
                if (!target || !effectiveStart(target) || effectiveStart(target).getTime() !== from.getTime()) {
                    throw failure('EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
                }
                const end = effectiveEnd(target);
                if (datedRows.some((row) => String(row._id) !== historyId &&
                    (!end || effectiveStart(row) <= end) && (!effectiveEnd(row) || effectiveEnd(row) >= from))) {
                    throw failure('EMPLOYEE_PROFILE_HISTORY_OVERLAP');
                }
                const latest = !datedRows.some((row) => effectiveStart(row) > from);
                const currentFrom = effectiveStart(current);
                // A latest-row correction can update current only when its identity
                // agrees. Missing current dates are allowed for legacy Maintenance.
                if (latest && currentFrom && currentFrom.getTime() !== from.getTime()) {
                    throw failure('EMPLOYEE_PROFILE_CURRENT_IDENTITY_MISMATCH');
                }
                if (!latest) {
                    // Never fill an old historical gap from today's employee facts.
                    // Missing facts need an explicit correction, not inferred false/0.
                    const missing = C.readEmploymentProfile(target).unrecordedFields.filter((field) =>
                        ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field) &&
                        (!Object.prototype.hasOwnProperty.call(input, field) || input[field] === undefined));
                    if (missing.length) throw failure('EMPLOYEE_PROFILE_LEGACY_CORRECTION_REQUIRES_FACTS');
                }
                const source = latest ? { ...current, ...target } : target;
                const snapshot = buildCompleteProfileSnapshot({ input, current: source, effectiveFrom: from });
                const facts = Object.fromEntries(C.FACT_FIELDS.map((field) => [field, snapshot[field]]));
                if (latest) {
                    const update = await employeeModel.updateOne({ ...filter, _id: current._id },
                        { $set: facts }, { session });
                    if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_STALE');
                }
                // Only facts/provenance are corrected. All date identity fields,
                // aa_eggrafhs, createdAt, amounts and surrounding rows remain intact.
                const correction = { ...facts, afora_allagh_dialleimatos: true,
                    hmeromhnia_isxyos_dialleimatos_apo: from };
                const update = await historyModel.updateOne({ ...filter, _id: target._id,
                    hmeromhnia_isxyos_oron_ergasias_apo: target.hmeromhnia_isxyos_oron_ergasias_apo ?? null,
                    hmeromhnia_allaghs_orarioy_apo: target.hmeromhnia_allaghs_orarioy_apo ?? null },
                { $set: correction }, { session });
                if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
                result = { facts, history: { ...target, ...correction }, currentUpdated: latest };
                return;
            }
            if (datedRows.some((row) => effectiveStart(row) >= from)) throw failure('EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
            const openRows = datedRows.filter((row) => !effectiveEnd(row) || effectiveEnd(row) >= from);
            if (openRows.length > 1) throw failure('EMPLOYEE_PROFILE_HISTORY_OVERLAP');
            const snapshot = buildCompleteProfileSnapshot({ input, current: current || newEmployee, effectiveFrom: from });
            const facts = Object.fromEntries(C.FACT_FIELDS.map((field) => [field, snapshot[field]]));
            const currentUpdate = { ...facts,
                hmeromhnia_isxyos_oron_ergasias_apo: snapshot.hmeromhnia_isxyos_oron_ergasias_apo,
                hmeromhnia_isxyos_oron_ergasias_eos: null };
            if (current) {
                // Updating the employee inside the transaction serializes competing
                // profile writes. Mongo write conflicts retry the entire fresh read.
                const update = await employeeModel.updateOne({ ...filter, _id: current._id }, { $set: currentUpdate }, { session });
                if (update.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_STALE');
            } else {
                await employeeModel.create([{ ...newEmployee, ...filter, ...currentUpdate }], { session });
            }
            if (openRows[0]) {
                const until = new Date(from); until.setUTCDate(until.getUTCDate() - 1);
                const closed = await historyModel.updateOne({ ...filter, _id: openRows[0]._id },
                    { $set: { hmeromhnia_isxyos_oron_ergasias_eos: until } }, { session });
                if (closed.matchedCount !== 1) throw failure('EMPLOYEE_PROFILE_HISTORY_STALE');
            }
            const sequence = Math.max(0, ...rows.map((row) => Number(row.aa_eggrafhs) || 0)) + 1;
            const [history] = await historyModel.create([{ ...filter, ...snapshot,
                aa_eggrafhs: String(sequence).padStart(4, '0'), afora_proslhpsh: !current }], { session });
            result = { facts, history };
        });
        return result;
    } finally { await session.endSession(); }
}
module.exports = { MODE_NEW_VERSION, MODE_CORRECT_EXISTING, transactionCapability, writeEmployeeEmploymentProfile };
