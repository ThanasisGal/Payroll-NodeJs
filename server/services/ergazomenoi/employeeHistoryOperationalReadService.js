'use strict';

const mongoose = require('mongoose');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const P = require('./employeeHistoryApprovedProposalContract');
const Row = require('./employeeHistoryRowApprovalService');
const Boundary = require('./employeeApprovedHistoryImmutableBoundaryService');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const editionsByRow = new WeakMap();
const editionMarker = '__verified_employee_history_edition';
const sourceVersion = row => Object.fromEntries(Object.entries(row || {}).filter(([field]) => field !== 'history_reference_fence'));

function originalHistoryRow(row) { return editionsByRow.get(row)?.original || row; }

// Contract-status timelines have their own change-date semantics. Split only at
// the recorded terms boundaries, so their existing resolver cannot carry a
// finite correction forward indefinitely. These are calculation slices, never
// inserted historical events, contracts or employment cycles.
function operationalHistorySlices(history, from, to) {
    if (!from || !to || !Number.isFinite(+new Date(from)) || !Number.isFinite(+new Date(to)) || new Date(from) > new Date(to)) return [];
    const start = new Date(from), end = new Date(to), cuts = new Set([+start, +end + 86400000]);
    const bounds = new Map();
    for (const row of history) {
        if (!editionsByRow.has(row)) continue;
        let first, last;
        try { first = effectiveStart(editionsByRow.get(row).content); last = effectiveEnd(editionsByRow.get(row).content); } catch { /* Unknown dates never establish applicability. */ }
        bounds.set(row, { first, last });
        for (const boundary of [first && +first, last && +last + 86400000])
            if (boundary && boundary > +start && boundary <= +end) cuts.add(boundary);
    }
    const dates = [...cuts].sort((a, b) => a - b);
    return dates.slice(0, -1).map((date, index) => ({ from: new Date(date), to: new Date(dates[index + 1] - 86400000),
        history: history.map(row => {
            const bound = bounds.get(row);
            return !bound || bound.first && +bound.first <= date && (!bound.last || date <= +bound.last)
                ? row : originalHistoryRow(row);
        }) }));
}

const values = value => typeof value === 'string' && value.trim() ? [value] :
    Array.isArray(value?.$in) && value.$in.every(item => typeof item === 'string' && item.trim()) ? value.$in : [];

// Opt-in at operational readers only. Never install this on the model: maintenance,
// write fences, persisted references and frozen snapshots need physical documents.
function identities(filter) {
    if (typeof filter.team !== 'string' || !filter.team.trim()) return [];
    const companies = values(filter.company_kod), codes = values(filter.kodikos);
    if (companies.length && codes.length) return companies.flatMap(company_kod =>
        codes.map(kodikos => ({ team: filter.team, company_kod, kodikos })));
    if (!filter.$or?.length) return [];
    return filter.$or.flatMap(part => identities({ ...part, team: filter.team }));
}

function boundDecision(audit, original, employee, independent = true) {
    const d = audit.diagnostics, decision = d?.rowApproval, scope = audit.employeeScope;
    if (!d || !decision || !employee || audit.mutationSource !== P.OPERATION ||
        d.version !== P.VERSION || !['UPDATE', 'INSERT'].includes(d.operation) || d.outcome !== 'COMMITTED' ||
        decision.version !== Row.VERSION || ![Row.STATUS, 'COMMITTED_AWAITING_VERIFICATION'].includes(decision.status) ||
        !['CORRECTION_EDITION', 'APPROVAL_ONLY', 'PHYSICAL_UPDATE', 'INSERT'].includes(decision.mode) ||
        independent && (decision.status !== Row.STATUS || !(decision.verification?.verifiedAt instanceof Date) ||
            !Number.isFinite(+decision.verification.verifiedAt) || decision.verification.version !== Row.VERSION) ||
        !d.actorUserId || d.binding?.actorUserId !== d.actorUserId ||
        d.binding?.employeeId !== String(employee._id) || String(scope?.employee_id) !== String(employee._id) ||
        d.targetHistoryId !== String(original._id) || isInactiveHistoryRow(original) ||
        d.declaration !== 'Ναι' || !d.explicitChanges ||
        Object.entries(d.explicitChanges).some(([field, value]) => !P.permittedFields.includes(field) || Row.blank(value))) return false;
    const identity = { team: original.team, company_kod: original.company_kod, kodikos: original.kodikos };
    if (!A.equal(d.binding.scope, identity) || !['team', 'company_kod', 'kodikos'].every(field =>
        scope[field] === identity[field] && employee[field] === identity[field] &&
        decision.approvedContent?.[field] === identity[field]) ||
        d.operation === 'UPDATE' && (!A.equal(decision.approvedContent?._id, original._id) ||
            !A.equal(decision.approvedContent?.aa_eggrafhs, original.aa_eggrafhs)) ||
        !A.equal(sourceVersion(d.actualAfter), sourceVersion(original))) return false;
    try {
        // The reference fence can advance when new references are created; it
        // is not a new business edition. All other fields/revisions must match.
        Row.verify({ completeHistoryRows: [d.actualAfter] }, independent ? audit : { ...audit,
            diagnostics: { ...d, rowApproval: { ...decision, status: 'COMMITTED_AWAITING_VERIFICATION' } } });
        return true;
    } catch { return false; }
}

function projectionFor(query) {
    const projection = { ...(query.projection() || {}) };
    for (const field of Object.keys(projection).filter(field => field.startsWith('-'))) {
        delete projection[field]; projection[field.slice(1)] = 0;
    }
    const inclusive = Object.entries(projection).some(([key, value]) => !key.startsWith('+') && value === 1);
    query.model.schema.eachPath((field, path) => {
        const forced = projection['+' + field];
        delete projection['+' + field];
        if (path.options.select === false) {
            if (forced) { if (inclusive) projection[field] = 1; }
            else if (!inclusive) projection[field] = 0;
        }
    });
    return projection;
}

async function readOperationalHistory(query, { useCorrections = true } = {}) {
    // Existing test doubles stay entirely in their injected data store. No
    // fallback to the application's default connection or an environment URI.
    if (!useCorrections || !(query instanceof mongoose.Query)) return await query;
    if (query.op !== 'find' || query.mongooseOptions().lean !== true) throw new TypeError('OPERATIONAL_HISTORY_REQUIRES_LEAN_FIND');
    const scope = identities(query.getFilter());
    if (!scope.length) return await query;
    const connection = query.model.db, session = query.getOptions().session;
    const auditCollection = require('../../models/employeeHistoryRepairAudit').collection.name;
    const audits = await connection.collection(auditCollection).find({
        mutationSource: { $in:[P.OPERATION, Boundary.OPERATION] },
        $and:[
            { $or:scope.map(item => Object.fromEntries(Object.entries(item).map(([field, value]) => ['employeeScope.'+field,value]))) },
            { $or:[
                { mutationSource:P.OPERATION,
                    'diagnostics.rowApproval.version':Row.VERSION,
                    'diagnostics.rowApproval.status':{$in:[Row.STATUS,'COMMITTED_AWAITING_VERIFICATION']} },
                { mutationSource:Boundary.OPERATION,
                    'diagnostics.version':Boundary.WRITER_VERSION,
                    'diagnostics.operation':'NEW_CHANGE' }
            ] }
        ]
    }, { session }).project({ employeeScope: 1, mutationSource: 1, historyBefore:1, historyAfter:1,
        ...Object.fromEntries(['version', 'operation', 'outcome', 'actorUserId', 'boundary', 'fromHistoryId',
            'insertedHistoryId', 'effectiveFrom', 'binding', 'targetHistoryId',
            'declaration', 'explicitChanges', 'reviewedOriginal', 'actualBefore', 'actualAfter', 'rowApproval']
            .map(field => ['diagnostics.' + field, 1]))
    }).sort({ repairedAt: -1, _id: -1 }).toArray();
    if (!audits.length) return await query;

    for(const item of audits.filter(audit=>audit.mutationSource===Boundary.OPERATION))
        Boundary.committedBoundary(item);
    const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
    const ids = [...new Set(audits.flatMap(audit => [audit.diagnostics?.targetHistoryId,
        audit.diagnostics?.boundary?.priorHistoryId,
        audit.diagnostics?.boundary?.successorHistoryId]).filter(validId))];
    if (!ids.length) return await query;
    // Full persisted facts, including the private revision fence, are needed to
    // verify the approved source version; the caller's projection is applied last.
    const sourceQuery = query.model.find({ $or: mongoose.trusted(scope),
        _id: mongoose.trusted({ $in: ids }) }).select('+history_reference_fence').session(session || null).lean();
    const originals = await sourceQuery;
    const employeeCollection = require('../../models/ergazomenoi').ErgazomenoiModel.collection.name;
    const employees = await connection.collection(employeeCollection).find({ $or: scope }, { session,
        projection: { _id: 1, team: 1, company_kod: 1, kodikos: 1, hmeromhnia_proslhpshs: 1 } }).toArray();
    const editions = [];
    const verifiedApprovals = [];
    for (const original of originals) {
        const matches = employees.filter(employee => ['team', 'company_kod', 'kodikos'].every(field => employee[field] === original[field]));
        if (matches.length !== 1) continue;
        for (const audit of audits.filter(item => item.mutationSource === P.OPERATION)) {
            const decision = audit.diagnostics?.rowApproval;
            if (boundDecision(audit, original, matches[0])) {
                // Approval-only records can have identical physical content.
                // They still remain required provenance for a later atomic
                // receipt that names that exact independently verified audit.
                verifiedApprovals.push({original,audit});
                if (decision.mode === 'CORRECTION_EDITION' || decision.mode === 'APPROVAL_ONLY' && decision.hasCorrectionEdition === true)
                    editions.push({ original, content: decision.approvedContent, audit });
                break;
            }
            // PR #401 commits physical writes before its independent reread.
            // Until that reread succeeds, expose the preceding facts, or omit an
            // unverified INSERT. Never let that intermediate state enter payroll.
            if (['PHYSICAL_UPDATE', 'INSERT'].includes(decision?.mode) && boundDecision(audit, original, matches[0], false) &&
                decision.originalRowHash === A.hash(audit.diagnostics.actualBefore || null)) {
                editions.push({ original, content: audit.diagnostics.actualBefore, correction: false });
                break;
            }
        }
    }
    // An atomic NEW_CHANGE may only add a verified logical end to its old
    // predecessor. It is never an APPROVED_RESOLVED legacy correction and
    // cannot supersede a pre-existing independently approved edition.
    const atomic = audits.filter(item => item.mutationSource === Boundary.OPERATION);
    for (const employee of employees) {
        const employeeRows = originals.filter(row => ['team','company_kod','kodikos'].every(k =>
            row[k] === employee[k]));
        if (!employeeRows.length) continue;
        const scopes = {team:employee.team,company_kod:employee.company_kod,kodikos:employee.kodikos};
        const approvedEditions=editions.filter(item => item.audit &&
            ['team','company_kod','kodikos'].every(k=>item.original[k]===scopes[k]));
        const scopedVerifiedApprovals=verifiedApprovals.filter(item =>
            ['team','company_kod','kodikos'].every(k=>item.original[k]===scopes[k]));
        const effective=employeeRows.map(row =>
            approvedEditions.find(item => String(item.original._id) === String(row._id))?.content || row);
        const projected = Boundary.project({scope:scopes,currentEmployee:employee,
            physicalRows:employeeRows,historyRows:effective,
            verifiedApprovals:scopedVerifiedApprovals.map(item=>item.audit),
            atomicAudits:atomic.filter(audit => ['team','company_kod','kodikos'].every(k =>
                audit.employeeScope?.[k]===scopes[k]))});
        for(const b of projected.boundaries) {
            const original = employeeRows.find(row => String(row._id) === b.priorHistoryId);
            const content=projected.historyRows.find(row => String(row._id) === b.priorHistoryId);
            const approved=approvedEditions.find(item=>String(item.original._id)===b.priorHistoryId);
            if(approved) approved.content=content;
            else editions.push({original, content, correction:false});
        }
    }
    if (!editions.length) return await query;

    // MongoDB itself applies the existing predicate, sorting and projection to
    // the selected edition. In particular, corrected dates can enter OR leave a
    // period even when the original was excluded by its date/terms predicate.
    // Equality against the entire source also rejects a concurrent source change.
    const filter = query.cast(query.model);
    const pipeline = [
        { $match: { $or: scope } },
        { $replaceWith: { $switch: { branches: editions.map(({ original, content }) => ({
            case: { $eq: ['$$ROOT', { $literal: original }] },
            then: { $literal: content ? { ...content, [editionMarker]: String(original._id) } : {} }
        })), default: '$$ROOT' } } },
        { $match: { $and: [filter, { employment_history_canonical_status: { $nin: ['REDUNDANT_REFERENCED', 'WITHDRAWN_ERRONEOUS'] } }] } }
    ];
    const options = query.getOptions();
    if (options.sort) pipeline.push({ $sort: options.sort });
    if (options.skip) pipeline.push({ $skip: options.skip });
    if (options.limit) pipeline.push({ $limit: Math.abs(options.limit) });
    const projection = projectionFor(query);
    if (Object.values(projection).includes(1)) projection[editionMarker] = 1;
    if (Object.keys(projection).length) pipeline.push({ $project: projection });
    const result = await connection.collection(query.model.collection.name).aggregate(pipeline, {
        ...(session ? { session } : {}), ...(options.collation ? { collation: options.collation } : {})
    }).toArray();
    for (const row of result) {
        const edition = editions.find(item => String(item.original._id) === row[editionMarker]);
        delete row[editionMarker];
        if (edition && edition.correction !== false) editionsByRow.set(row, edition);
    }
    return result;
}

module.exports = { readOperationalHistory, operationalHistorySlices, originalHistoryRow, boundDecision };
