const mongoose = require('mongoose');

const ApasxoliseisPolicyPreviewApprovalsModel = require('../../models/apasxoliseisPolicyPreviewApproval');
const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const { validateSessionScope } = require('./apasxoliseisPolicyPreviewApprovalService');

const APPLY_DRY_RUN_DECISION_TYPE = 'APPROVE_PREFILL';
const APPLY_DRY_RUN_FIELD_DEFINITIONS = Object.freeze({
    adeia_apologistika: { label: 'Άδεια απολογιστικά', type: 'boolean' },
    kathgoria_adeias_apologistika: {
        label: 'Κατηγορία άδειας απολογιστικά',
        type: 'string'
    },
    ores_apoysias_apologistika: { label: 'Ώρες απουσίας απολογιστικά', type: 'number' },
    repo_apologistika: { label: 'Ρεπό απολογιστικά', type: 'boolean' },
    kathgoria_ergasias_apologistika: {
        label: 'Κατηγορία εργασίας απολογιστικά',
        type: 'string'
    },
    ores_ergasias_apologistika: { label: 'Ώρες εργασίας απολογιστικά', type: 'number' },
    apo_ora_01_apologistika: { label: 'Από ώρα 1 απολογιστικά', type: 'string' },
    eos_ora_01_apologistika: { label: 'Έως ώρα 1 απολογιστικά', type: 'string' },
    apo_ora_02_apologistika: { label: 'Από ώρα 2 απολογιστικά', type: 'string' },
    eos_ora_02_apologistika: { label: 'Έως ώρα 2 απολογιστικά', type: 'string' },
    apo_ora_03_apologistika: { label: 'Από ώρα 3 απολογιστικά', type: 'string' },
    eos_ora_03_apologistika: { label: 'Έως ώρα 3 απολογιστικά', type: 'string' }
});

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toTrimmedString(value, maxLength = 250) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function parseDateOnly(value, fieldLabel) {
    const key = toTrimmedString(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        throw validationError(`Μη έγκυρη τιμή για ${fieldLabel}.`);
    }

    const date = new Date(`${key}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key) {
        throw validationError(`Μη έγκυρη τιμή για ${fieldLabel}.`);
    }
    return { key, date };
}

function normalizeOptionalObjectId(value, fieldLabel) {
    const normalized = toTrimmedString(value, 50);
    if (!normalized) return null;
    if (!mongoose.isValidObjectId(normalized)) {
        throw validationError(`Μη έγκυρη τιμή για ${fieldLabel}.`);
    }
    return new mongoose.Types.ObjectId(normalized);
}

function validateApplyDryRunFilters(filters = {}) {
    const source = asObject(filters);
    const apo = parseDateOnly(source.apo_hmeromhnia, 'apo_hmeromhnia');
    const eos = parseDateOnly(source.eos_hmeromhnia, 'eos_hmeromhnia');
    if (apo.date > eos.date) throw validationError('Μη έγκυρο εύρος ημερομηνιών.');

    const decisionType =
        toTrimmedString(source.decision_type, 50).toUpperCase() || APPLY_DRY_RUN_DECISION_TYPE;
    if (decisionType !== APPLY_DRY_RUN_DECISION_TYPE) {
        throw validationError('Το dry-run υποστηρίζει μόνο αποφάσεις APPROVE_PREFILL.');
    }

    return {
        apo_hmeromhnia: apo,
        eos_hmeromhnia: eos,
        group_id: toTrimmedString(source.group_id, 150),
        approval_id: normalizeOptionalObjectId(source.approval_id, 'approval_id'),
        decision_type: decisionType,
        page: Math.max(Number.parseInt(source.page, 10) || 1, 1),
        limit: Math.min(Math.max(Number.parseInt(source.limit, 10) || 20, 1), 100)
    };
}

function buildApplyDryRunApprovalFilter({ session, filters = {} }) {
    const scope = validateSessionScope(session);
    const normalized = validateApplyDryRunFilters(filters);
    const filter = {
        team: scope.team,
        company_kod: scope.company_kod,
        decision_status: 'RECORDED',
        decision_type: APPLY_DRY_RUN_DECISION_TYPE,
        apo_hmeromhnia: mongoose.trusted({ $gte: normalized.apo_hmeromhnia.date }),
        eos_hmeromhnia: mongoose.trusted({ $lte: normalized.eos_hmeromhnia.date })
    };

    if (scope.etos) filter.etos = scope.etos;
    if (normalized.group_id) filter.group_id = normalized.group_id;
    if (normalized.approval_id) filter._id = normalized.approval_id;

    return { scope, normalized, filter };
}

function buildApplyDryRunProdhlomenaLookup({ scope, objectIds }) {
    const typedIds = (Array.isArray(objectIds) ? objectIds : []).filter(
        (id) => id instanceof mongoose.Types.ObjectId
    );
    return {
        team: scope.team,
        company_kod: scope.company_kod,
        _id: mongoose.trusted({ $in: typedIds })
    };
}

function normalizeComparableValue(value, type) {
    if (value === null || value === undefined) return { valid: true, value: null };

    if (type === 'number') {
        if (typeof value === 'number' && Number.isFinite(value)) return { valid: true, value };
        if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
            return { valid: true, value: Number(value) };
        }
        return { valid: false, value };
    }

    if (type === 'boolean') {
        return typeof value === 'boolean' ? { valid: true, value } : { valid: false, value };
    }

    if (type === 'date') {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? { valid: false, value }
            : { valid: true, value: date.toISOString().slice(0, 10) };
    }

    return typeof value === 'string'
        ? { valid: true, value: value.trim() }
        : { valid: false, value };
}

function compareProposedValuesWithCurrentRecord({ proposedValues, currentRecord }) {
    const proposed = asObject(proposedValues);
    return Object.entries(proposed).map(([field, proposedValue]) => {
        const definition = APPLY_DRY_RUN_FIELD_DEFINITIONS[field];
        const currentValue = currentRecord ? currentRecord[field] : undefined;

        if (!definition) {
            return {
                field,
                label: field,
                current_value: currentValue ?? null,
                proposed_value: proposedValue,
                action: 'SKIPPED',
                reason: 'Το πεδίο δεν υποστηρίζεται από το dry-run apply allowlist.'
            };
        }

        const current = normalizeComparableValue(currentValue, definition.type);
        const next = normalizeComparableValue(proposedValue, definition.type);
        if (!current.valid || !next.valid) {
            return {
                field,
                label: definition.label,
                current_value: currentValue ?? null,
                proposed_value: proposedValue,
                action: 'SKIPPED',
                reason: 'Η τρέχουσα ή η προτεινόμενη τιμή δεν έχει τον αναμενόμενο τύπο.'
            };
        }

        const same = current.value === next.value;
        return {
            field,
            label: definition.label,
            current_value: currentValue ?? null,
            proposed_value: proposedValue,
            action: same ? 'ALREADY_SAME' : 'WOULD_SET',
            reason: same
                ? 'Η τρέχουσα τιμή είναι ήδη ίδια με την προτεινόμενη.'
                : 'Η προτεινόμενη τιμή διαφέρει από την τρέχουσα.'
        };
    });
}

function buildDryRunItem(item = {}, currentRecord = null) {
    const rawId = toTrimmedString(item.prodhlomena_oraria_id, 50);
    const base = {
        prodhlomena_oraria_id: rawId || null,
        employee_kodikos: toTrimmedString(item.employee_kodikos, 50),
        hmeromhnia: item.hmeromhnia ? new Date(item.hmeromhnia).toISOString().slice(0, 10) : null,
        current_values: {},
        proposed_values: asObject(item.proposed_values),
        field_diffs: []
    };

    if (!rawId || !mongoose.isValidObjectId(rawId)) {
        return { ...base, status: 'SKIPPED', reason: 'Μη έγκυρο prodhlomena_oraria_id.' };
    }
    if (!currentRecord) {
        return { ...base, status: 'SKIPPED', reason: 'Δεν βρέθηκε η εγγραφή προδηλωμένου ωραρίου.' };
    }

    const proposedKeys = Object.keys(base.proposed_values);
    if (proposedKeys.length === 0) {
        return { ...base, status: 'SKIPPED', reason: 'Δεν υπάρχουν proposed_values για αξιολόγηση.' };
    }

    const fieldDiffs = compareProposedValuesWithCurrentRecord({
        proposedValues: base.proposed_values,
        currentRecord
    });
    const currentValues = {};
    fieldDiffs.forEach((diff) => {
        currentValues[diff.field] = diff.current_value;
    });
    const wouldChange = fieldDiffs.some((diff) => diff.action === 'WOULD_SET');
    const allSkipped = fieldDiffs.every((diff) => diff.action === 'SKIPPED');

    return {
        ...base,
        status: wouldChange ? 'WOULD_CHANGE' : allSkipped ? 'SKIPPED' : 'NO_CHANGE',
        reason: wouldChange
            ? 'Υπάρχουν πεδία που θα άλλαζαν.'
            : allSkipped
              ? 'Κανένα προτεινόμενο πεδίο δεν μπορεί να αξιολογηθεί.'
              : 'Οι υποστηριζόμενες τιμές είναι ήδη ίδιες.',
        current_values: currentValues,
        field_diffs: fieldDiffs
    };
}

function buildEmptySummary() {
    return {
        approvals_found: 0,
        approvals_returned: 0,
        items_total: 0,
        items_with_changes: 0,
        items_without_changes: 0,
        items_skipped: 0,
        fields_total: 0,
        fields_would_change: 0,
        fields_already_same: 0,
        fields_skipped: 0
    };
}

function addItemToSummary(summary, item) {
    summary.items_total++;
    if (item.status === 'WOULD_CHANGE') summary.items_with_changes++;
    if (item.status === 'NO_CHANGE') summary.items_without_changes++;
    if (item.status === 'SKIPPED') summary.items_skipped++;
    item.field_diffs.forEach((diff) => {
        summary.fields_total++;
        if (diff.action === 'WOULD_SET') summary.fields_would_change++;
        if (diff.action === 'ALREADY_SAME') summary.fields_already_same++;
        if (diff.action === 'SKIPPED') summary.fields_skipped++;
    });
}

function buildApplyDryRunReport({ approvals = [], currentRecordsById = new Map() }) {
    const summary = buildEmptySummary();
    const eligibleApprovals = approvals.filter(
        (approval) =>
            approval?.decision_type === APPLY_DRY_RUN_DECISION_TYPE &&
            approval?.decision_status === 'RECORDED'
    );
    summary.approvals_found = eligibleApprovals.length;
    summary.approvals_returned = eligibleApprovals.length;

    const reportApprovals = eligibleApprovals.map((approval) => {
        const approvalSummary = buildEmptySummary();
        approvalSummary.approvals_found = 1;
        approvalSummary.approvals_returned = 1;
        const items = (Array.isArray(approval.items) ? approval.items : []).map((item) => {
            const id = toTrimmedString(item.prodhlomena_oraria_id, 50);
            const reportItem = buildDryRunItem(item, currentRecordsById.get(id) || null);
            addItemToSummary(summary, reportItem);
            addItemToSummary(approvalSummary, reportItem);
            return reportItem;
        });

        return {
            approval_id: String(approval._id || ''),
            group_id: approval.group_id || '',
            decision_type: approval.decision_type,
            created_at: approval.created_at || null,
            created_by_user_name: approval.created_by_user_name || '',
            notes: approval.notes || '',
            summary: approvalSummary,
            items
        };
    });

    return { summary, approvals: reportApprovals };
}

async function runPolicyPreviewApplyDryRun({
    session,
    filters,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel,
    prodhlomenaModel = ProdhlomenaOrariaModel
}) {
    const built = buildApplyDryRunApprovalFilter({ session, filters });
    const skip = (built.normalized.page - 1) * built.normalized.limit;
    const [approvals, total] = await Promise.all([
        approvalModel
            .find(built.filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(built.normalized.limit)
            .lean(),
        approvalModel.countDocuments(built.filter)
    ]);

    const validIds = [];
    approvals.forEach((approval) => {
        (Array.isArray(approval.items) ? approval.items : []).forEach((item) => {
            const id = toTrimmedString(item.prodhlomena_oraria_id, 50);
            if (mongoose.isValidObjectId(id)) validIds.push(new mongoose.Types.ObjectId(id));
        });
    });
    const uniqueIds = [...new Map(validIds.map((id) => [String(id), id])).values()];
    const currentRecords = uniqueIds.length
        ? await prodhlomenaModel
              .find(buildApplyDryRunProdhlomenaLookup({ scope: built.scope, objectIds: uniqueIds }))
              .select(`_id kodikos hmeromhnia ${Object.keys(APPLY_DRY_RUN_FIELD_DEFINITIONS).join(' ')}`)
              .lean()
        : [];
    const currentRecordsById = new Map(
        currentRecords.map((record) => [String(record._id), record])
    );
    const report = buildApplyDryRunReport({ approvals, currentRecordsById });
    report.summary.approvals_found = total;
    report.summary.approvals_returned = report.approvals.length;

    return {
        scope: {
            team: built.scope.team,
            company_kod: built.scope.company_kod,
            apo_hmeromhnia: built.normalized.apo_hmeromhnia.key,
            eos_hmeromhnia: built.normalized.eos_hmeromhnia.key
        },
        page: built.normalized.page,
        limit: built.normalized.limit,
        total,
        totalPages: Math.ceil(total / built.normalized.limit),
        ...report
    };
}

module.exports = {
    APPLY_DRY_RUN_DECISION_TYPE,
    APPLY_DRY_RUN_FIELD_DEFINITIONS,
    validateApplyDryRunFilters,
    buildApplyDryRunApprovalFilter,
    buildApplyDryRunProdhlomenaLookup,
    compareProposedValuesWithCurrentRecord,
    buildApplyDryRunReport,
    runPolicyPreviewApplyDryRun
};
