'use strict';

// Explicit adapter from the preview contract to the existing, isolated writer.
// A preview fingerprint is never an approval and this module opens no connection.
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const { isInactiveHistoryRow, REDUNDANT_STATUS_FIELD: STATUS, REDUNDANT_SURVIVOR_FIELD: SURVIVOR,
    REDUNDANT_REFERENCED } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const VERSION = 'employee-history-coordinated-settlement:synthetic:v1';
const id = row => String(row._id);
const businessFields = new Set([...C.FIELD_GROUPS.TEMPORAL_SEMANTIC, ...C.PROFILE_FIELDS, ...C.FIELD_GROUPS.INFORMATIONAL,
    'employment_profile_source', 'employment_profile_schema_version', 'ekdosh_typoy_egkekrimenhs_rythmishs', 'energos']);
function coordinatedHistoryDocument(record) {
    const { IstorikoProslhpseonAllagonModel: History } = require('../../models/ergazomenoi');
    const document = new History(record);
    // Model defaults are not historical evidence. Preserve absent amounts,
    // dates and terms as absent, both while preparing and while inserting.
    for (const field of Object.keys(History.schema.paths)) {
        if (!Object.hasOwn(record, field)) document.set(field, undefined);
    }
    return document;
}
function buildCoordinatedSettlementProposal(input) {
    const proposal = require('./employeeHistorySettlementCoordinatorService').coordinateEmployeeHistorySettlement(input);
    if (proposal.status !== 'CLEAN') return { ...proposal, version: VERSION };
    const rows = S.clone(proposal.proposedRows), byId = new Map(rows.map(row => [id(row), row]));
    // Even unreferenced redundant originals are retained. Retirement requires a
    // unique surviving period with compatible recorded business evidence.
    for (const original of input.completeHistoryRows.filter(row => !byId.has(id(row)))) {
        const candidates = rows.filter(row => !isInactiveHistoryRow(row) &&
            A.equal(row[C.HIRE], original[C.HIRE]) && C.PROFILE_FIELDS.every(field =>
                original[field] === undefined || original[field] === null || original[field] === '' ||
                A.equal(original[field], row[field])) &&
            (!original[C.START] || !row[C.END] || new Date(original[C.START]) <= new Date(row[C.END])) &&
            (!original[C.END] || !row[C.START] || new Date(original[C.END]) >= new Date(row[C.START])));
        if (isInactiveHistoryRow(original) || candidates.length !== 1) S.fail('REDUNDANT_SURVIVOR_UNPROVEN');
        rows.push({ ...S.clone(original), [STATUS]: REDUNDANT_REFERENCED, [SURVIVOR]: candidates[0]._id });
    }
    if (Object.keys(proposal.currentPatch).some(field => !businessFields.has(field))) S.fail('UNEXPECTED_MUTATION');
    const verification = require('./employeeHistoryAutomaticReconstructionPlannerService').verifyEmployeeHistoryAutomaticSettlement({
        scope: input.scope, currentEmployee: { ...input.currentEmployee, ...proposal.currentPatch },
        proposedRows: rows, requiredHistoryRows: input.completeHistoryRows });
    if (verification.status !== 'CLEAN') S.fail('VERIFICATION_FAILED');
    return { ...proposal, version: VERSION, mode: 'SYNTHETIC_ONLY', sourceProposal: proposal,
        proposedRows: rows, verification, requiresWriterContractExtension: false };
}
function assertCoordinatedPhysicalPlan({ proposal, completeHistoryRows, physicalPlan, expectedRows, now, splitOptions }) {
    if (!splitOptions || !A.equal(buildCoordinatedSettlementProposal(splitOptions), proposal) ||
        !A.equal(physicalPlan.beforeRows, completeHistoryRows) || physicalPlan.rowsToDelete.length ||
        !A.equal(A.ordered(expectedRows), A.ordered(physicalPlan.finalRows))) S.fail('UNEXPECTED_MUTATION');
    const { IstorikoProslhpseonAllagonModel: History } = require('../../models/ergazomenoi');
    const before = new Map(completeHistoryRows.map(row => [id(row), row]));
    const logicalNew = proposal.proposedRows.filter(row => !before.has(id(row))).sort((a,b) =>
        new Date(a[C.START]) - new Date(b[C.START]) || id(a).localeCompare(id(b)));
    const inserts = [...physicalPlan.rowsToInsert].sort((a,b) => Number(a.aa_eggrafhs) - Number(b.aa_eggrafhs));
    const final = new Map(physicalPlan.finalRows.map(row => [id(row), row]));
    const updates = new Map(physicalPlan.rowsToUpdate.map(item => [item.historyId, item]));
    const numbers = completeHistoryRows.map(row => String(row.aa_eggrafhs || ''));
    if (numbers.some(value => !/^\d+$/.test(value)) || new Set(numbers.map(Number)).size !== numbers.length ||
        !Number.isSafeInteger(Math.max(0,...numbers.map(Number)) + inserts.length)) S.fail('HISTORY_SEQUENCE_INVALID');
    if (inserts.length !== logicalNew.length || final.size !== physicalPlan.finalRows.length ||
        final.size !== before.size + inserts.length || updates.size !== physicalPlan.rowsToUpdate.length ||
        [...updates.keys()].some(key => !before.has(key))) S.fail('UNEXPECTED_MUTATION');
    const assignments = new Map(logicalNew.map((row,index) => [id(row), inserts[index]._id]));
    logicalNew.forEach((row,index) => {
        const actual = inserts[index];
        if (actual._id?._bsontype !== 'ObjectId' || before.has(id(actual))) S.fail('UNEXPECTED_INSERT');
        const expected = coordinatedHistoryDocument({ ...row, _id: actual._id,
            aa_eggrafhs: String(Math.max(0,...numbers.map(Number)) + index + 1).padStart(4,'0'), createdAt: now, updatedAt: now })
            .toObject({ depopulate: true, minimize: false, versionKey: false });
        if (History.schema.options.versionKey) expected[History.schema.options.versionKey] = 0;
        if (!A.equal(actual, expected) || !A.equal(actual, final.get(id(actual)))) S.fail('UNEXPECTED_INSERT');
    });
    for (const original of completeHistoryRows) {
        const wanted = proposal.proposedRows.find(row => id(row) === id(original));
        if (!wanted) S.fail('PROTECTED_PAYLOAD');
        const remapped = { ...wanted };
        if (assignments.has(String(remapped[SURVIVOR]))) remapped[SURVIVOR] = assignments.get(String(remapped[SURVIVOR]));
        const target = { ...original, ...Object.fromEntries(Object.entries(remapped).filter(([,v]) => v !== undefined)
            .map(([field,value]) => [field, field === '_id' ? value : History.schema.path(field)?.cast(value) ?? value])) };
        const update = updates.get(id(original));
        if (update) {
            const allowed = isInactiveHistoryRow(wanted) ? new Set([STATUS,SURVIVOR]) : businessFields;
            const previous = new Date(original.updatedAt).getTime();
            const revision = new Date(Math.max(now.getTime(), Number.isFinite(previous) ? previous + 1 : now.getTime()));
            if (!Object.keys(update.patch).length || Object.keys(update.patch).some(field => field !== 'updatedAt' && !allowed.has(field)) ||
                !A.equal(update.patch.updatedAt,revision) || !A.equal({...original,...update.patch},{...target,updatedAt:revision})) S.fail('UNEXPECTED_MUTATION');
            target.updatedAt = revision;
        } else if (!A.equal(original,target)) S.fail('UNEXPECTED_MUTATION');
        if (isInactiveHistoryRow(original) && (update || !A.equal(original,target))) S.fail('PROTECTED_PAYLOAD');
        if (splitOptions.protectedReferenceSummary[id(original)]?.length && !A.equal(original,target)) {
            const { [STATUS]: status, [SURVIVOR]: survivor, updatedAt, ...payload } = target;
            const { updatedAt: oldRevision, ...oldPayload } = original;
            if (status !== REDUNDANT_REFERENCED || !A.equal(payload,oldPayload) || !final.has(String(survivor)) ||
                isInactiveHistoryRow(final.get(String(survivor)))) S.fail('PROTECTED_PAYLOAD');
        }
        if (!A.equal(target,final.get(id(original)))) S.fail('UNEXPECTED_MUTATION');
    }
}
module.exports = { VERSION, buildCoordinatedSettlementProposal, assertCoordinatedPhysicalPlan, coordinatedHistoryDocument };
