const mongoose = require('mongoose');

const ApasxoliseisPolicyPreviewApprovalsModel = require('../../models/apasxoliseisPolicyPreviewApproval');

const ALLOWED_DECISION_TYPES = Object.freeze([
    'APPROVE_PREFILL',
    'MARK_OK',
    'MARK_REVIEWED',
    'REJECT_PROPOSAL',
    'NEEDS_MORE_REVIEW'
]);
const ALLOWED_DECISION_STATUSES = Object.freeze(['RECORDED', 'CANCELLED']);
const MAX_ITEMS = 500;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_NESTED_KEYS = 100;

function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function conflictError(message) {
    const error = new Error(message);
    error.statusCode = 409;
    return error;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toTrimmedString(value, maxLength = 250) {
    const normalized = String(value ?? '').trim();
    return normalized.slice(0, maxLength);
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

    return date;
}

function sanitizeSnapshotObject(value, fieldLabel) {
    const source = asObject(value);
    const keys = Object.keys(source);

    if (keys.length > MAX_NESTED_KEYS) {
        throw validationError(`Το ${fieldLabel} περιέχει υπερβολικά πολλά πεδία.`);
    }

    const sanitized = {};
    keys.forEach((key) => {
        if (!key || key.startsWith('$') || key.includes('.')) {
            throw validationError(`Το ${fieldLabel} περιέχει μη επιτρεπτό όνομα πεδίου.`);
        }

        const item = source[key];
        if (
            item !== null &&
            !['string', 'number', 'boolean'].includes(typeof item)
        ) {
            throw validationError(`Το ${fieldLabel} περιέχει μη επιτρεπτή τιμή.`);
        }

        sanitized[key] = typeof item === 'string' ? item.slice(0, 500) : item;
    });

    return sanitized;
}

function normalizeOptionalObjectId(value, fieldLabel) {
    const normalized = toTrimmedString(value, 50);
    if (!normalized) return null;
    if (!mongoose.isValidObjectId(normalized)) {
        throw validationError(`Μη έγκυρη τιμή για ${fieldLabel}.`);
    }
    return normalized;
}

function normalizeApprovalItem(item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw validationError(`Μη έγκυρο item στη θέση ${index + 1}.`);
    }

    const previewId = toTrimmedString(item.preview_id || item.prodhlomena_oraria_id, 100);
    if (!previewId) {
        throw validationError(`Λείπει preview_id στο item ${index + 1}.`);
    }

    const hmeromhnia = parseDateOnly(item.hmeromhnia, `hmeromhnia item ${index + 1}`);
    const cardsHours = item.cards_ores_ergasias;

    if (cardsHours !== null && cardsHours !== undefined && !Number.isFinite(Number(cardsHours))) {
        throw validationError(`Μη έγκυρες ώρες καρτών στο item ${index + 1}.`);
    }

    return {
        preview_id: previewId,
        prodhlomena_oraria_id: normalizeOptionalObjectId(
            item.prodhlomena_oraria_id,
            `prodhlomena_oraria_id item ${index + 1}`
        ),
        employee_id: normalizeOptionalObjectId(item.employee_id, `employee_id item ${index + 1}`),
        employee_kodikos: toTrimmedString(item.employee_kodikos, 50),
        hmeromhnia,
        kathgoria_ergasias: toTrimmedString(item.kathgoria_ergasias, 50),
        kathgoria_ergasias_apologistika: toTrimmedString(
            item.kathgoria_ergasias_apologistika,
            50
        ),
        cards_ores_ergasias:
            cardsHours === null || cardsHours === undefined ? null : Number(cardsHours),
        proposed_values: sanitizeSnapshotObject(item.proposed_values, 'proposed_values'),
        flags: sanitizeSnapshotObject(item.flags, 'flags')
    };
}

function validatePolicyPreviewApprovalPayload(payload = {}) {
    let payloadBytes;
    try {
        payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    } catch (_error) {
        throw validationError('Το payload δεν είναι έγκυρο JSON object.');
    }

    if (payloadBytes > MAX_PAYLOAD_BYTES) {
        throw validationError('Το payload υπερβαίνει το επιτρεπτό μέγεθος.');
    }

    const source = asObject(payload);
    const group = asObject(source.group);
    const groupId = toTrimmedString(group.group_id, 150);
    const groupKey = toTrimmedString(group.group_key, 1000);
    const decisionType = toTrimmedString(source.decision_type, 50).toUpperCase();

    if (!groupId) throw validationError('Το group_id είναι υποχρεωτικό.');
    if (!groupKey) throw validationError('Το group_key είναι υποχρεωτικό.');
    if (!ALLOWED_DECISION_TYPES.includes(decisionType)) {
        throw validationError('Ο τύπος απόφασης δεν υποστηρίζεται.');
    }
    if (!Array.isArray(source.items)) {
        throw validationError('Το items πρέπει να είναι array.');
    }
    if (source.items.length < 1 || source.items.length > MAX_ITEMS) {
        throw validationError(`Το items πρέπει να περιέχει από 1 έως ${MAX_ITEMS} εγγραφές.`);
    }

    const apoHmeromhnia = parseDateOnly(source.apo_hmeromhnia, 'apo_hmeromhnia');
    const eosHmeromhnia = parseDateOnly(source.eos_hmeromhnia, 'eos_hmeromhnia');
    if (apoHmeromhnia > eosHmeromhnia) {
        throw validationError('Η ημερομηνία από δεν μπορεί να είναι μετά την ημερομηνία έως.');
    }

    const items = source.items.map(normalizeApprovalItem);
    const previewIds = new Set();
    items.forEach((item) => {
        if (previewIds.has(item.preview_id)) {
            throw validationError('Το items περιέχει διπλό preview_id.');
        }
        previewIds.add(item.preview_id);

        if (item.hmeromhnia < apoHmeromhnia || item.hmeromhnia > eosHmeromhnia) {
            throw validationError('Η ημερομηνία item είναι εκτός της δηλωμένης περιόδου.');
        }
    });

    return {
        apo_hmeromhnia: apoHmeromhnia,
        eos_hmeromhnia: eosHmeromhnia,
        ypokatasthma: toTrimmedString(source.ypokatasthma, 20),
        period_kodikos: toTrimmedString(source.period_kodikos, 50),
        period_id: toTrimmedString(source.period_id, 100),
        group: {
            group_id: groupId,
            group_key: groupKey,
            grouping_scope: toTrimmedString(group.scope, 50) || 'page',
            policy_code: toTrimmedString(group.policy_code, 150),
            scenario_code: toTrimmedString(group.scenario_code, 150),
            status: toTrimmedString(group.status, 100),
            action_type: toTrimmedString(group.action_type, 100),
            reason_code: toTrimmedString(group.reason_code, 150)
        },
        decision_type: decisionType,
        notes: toTrimmedString(source.notes, 2000),
        client_payload_version: toTrimmedString(source.client_payload_version, 50),
        items
    };
}

function validateSessionScope(session = {}) {
    const scope = {
        team: toTrimmedString(session.userTeam, 100),
        company_kod: toTrimmedString(session.companyInUse, 100),
        etos: toTrimmedString(session.yearInUse, 10),
        created_by_user_id: toTrimmedString(session.userId, 50),
        created_by_user_name: toTrimmedString(
            session.userName || session.username || session.userId,
            150
        ),
        created_by_user_role: toTrimmedString(session.userRole, 50),
        user_status: toTrimmedString(session.userStatus, 50)
    };

    if (!scope.team || !scope.company_kod || !mongoose.isValidObjectId(scope.created_by_user_id)) {
        const error = new Error('Λείπουν απαραίτητα στοιχεία συνεδρίας.');
        error.statusCode = 403;
        throw error;
    }
    if (scope.user_status !== 'A') {
        const error = new Error('Ο χρήστης δεν είναι ενεργός.');
        error.statusCode = 403;
        throw error;
    }

    return scope;
}

function buildApprovalAuditSnapshot(payload) {
    const employees = new Set();
    const dates = [];

    payload.items.forEach((item) => {
        if (item.employee_kodikos) employees.add(item.employee_kodikos);
        dates.push(item.hmeromhnia);
    });

    return {
        items_count: payload.items.length,
        employees_count: employees.size,
        first_date: new Date(Math.min(...dates.map((date) => date.getTime()))),
        last_date: new Date(Math.max(...dates.map((date) => date.getTime())))
    };
}

function buildRecordedDecisionLookup(scope, payload) {
    return {
        team: scope.team,
        company_kod: scope.company_kod,
        apo_hmeromhnia: payload.apo_hmeromhnia,
        eos_hmeromhnia: payload.eos_hmeromhnia,
        group_id: payload.group.group_id,
        decision_type: payload.decision_type,
        decision_status: 'RECORDED'
    };
}

async function createPolicyPreviewApprovalRecord({
    session,
    payload,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel
}) {
    const scope = validateSessionScope(session);
    const normalized = validatePolicyPreviewApprovalPayload(payload);
    const existing = await approvalModel
        .findOne(buildRecordedDecisionLookup(scope, normalized))
        .select('_id')
        .lean();

    if (existing) {
        throw conflictError('Η ίδια καταγεγραμμένη απόφαση υπάρχει ήδη για αυτή την ομάδα.');
    }

    return approvalModel.create({
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: normalized.ypokatasthma,
        etos: scope.etos,
        period_kodikos: normalized.period_kodikos,
        period_id: normalized.period_id,
        apo_hmeromhnia: normalized.apo_hmeromhnia,
        eos_hmeromhnia: normalized.eos_hmeromhnia,
        group_id: normalized.group.group_id,
        group_key: normalized.group.group_key,
        grouping_scope: normalized.group.grouping_scope,
        policy_code: normalized.group.policy_code,
        scenario_code: normalized.group.scenario_code,
        status: normalized.group.status,
        action_type: normalized.group.action_type,
        reason_code: normalized.group.reason_code,
        decision_type: normalized.decision_type,
        decision_status: 'RECORDED',
        items: normalized.items,
        snapshot_summary: buildApprovalAuditSnapshot(normalized),
        created_by_user_id: scope.created_by_user_id,
        created_by_user_name: scope.created_by_user_name,
        created_by_user_role: scope.created_by_user_role,
        source: 'POLICY_PREVIEW_GROUP_UI',
        notes: normalized.notes,
        client_payload_version: normalized.client_payload_version
    });
}

function buildPolicyPreviewApprovalListFilter({ session, filters = {} }) {
    const scope = validateSessionScope(session);
    const source = asObject(filters);
    const filter = {
        team: scope.team,
        company_kod: scope.company_kod
    };

    if (source.apo_hmeromhnia || source.eos_hmeromhnia) {
        const apo = parseDateOnly(source.apo_hmeromhnia, 'apo_hmeromhnia');
        const eos = parseDateOnly(source.eos_hmeromhnia, 'eos_hmeromhnia');
        if (apo > eos) throw validationError('Μη έγκυρο εύρος ημερομηνιών.');
        filter.apo_hmeromhnia = mongoose.trusted({ $gte: apo });
        filter.eos_hmeromhnia = mongoose.trusted({ $lte: eos });
    }

    const groupId = toTrimmedString(source.group_id, 150);
    const policyCode = toTrimmedString(source.policy_code, 150);
    const decisionStatus = toTrimmedString(source.decision_status, 50).toUpperCase();
    if (groupId) filter.group_id = groupId;
    if (policyCode) filter.policy_code = policyCode;
    if (decisionStatus) {
        if (!ALLOWED_DECISION_STATUSES.includes(decisionStatus)) {
            throw validationError('Η κατάσταση απόφασης δεν υποστηρίζεται.');
        }
        filter.decision_status = decisionStatus;
    }

    return filter;
}

async function listPolicyPreviewApprovalRecords({
    session,
    filters,
    page = 1,
    limit = 50,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel
}) {
    const filter = buildPolicyPreviewApprovalListFilter({ session, filters });
    const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const [records, total] = await Promise.all([
        approvalModel.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
        approvalModel.countDocuments(filter)
    ]);

    return {
        records,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
    };
}

module.exports = {
    ALLOWED_DECISION_TYPES,
    MAX_ITEMS,
    validatePolicyPreviewApprovalPayload,
    validateSessionScope,
    buildApprovalAuditSnapshot,
    buildRecordedDecisionLookup,
    buildPolicyPreviewApprovalListFilter,
    createPolicyPreviewApprovalRecord,
    listPolicyPreviewApprovalRecords
};
