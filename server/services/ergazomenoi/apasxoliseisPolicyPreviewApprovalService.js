const mongoose = require('mongoose');

const ApasxoliseisPolicyPreviewApprovalsModel = require('../../models/apasxoliseisPolicyPreviewApproval');
const {
    REUSE_SCOPE,
    REUSE_STATUS,
    buildReusableMatchCriteriaFromGroup,
    buildReusablePolicyCriteriaV4,
    buildReusableDecisionFingerprint,
    getReusableDecisionEligibility,
    isRuleEffectiveForRow
} = require('./apasxoliseisReusablePolicyDecisionService');
const {
    DECISION_GRAIN: ATOMIC_DECISION_GRAIN,
    CANONICAL_ROLES,
    validateAtomicLinkedSet,
    buildAtomicReusableCriteriaV5,
    validateAtomicReusableDecision,
    isEffectiveForBothMembers,
    isMemberEligible
} = require('./apasxoliseisWeeklyRepoTransferAtomicReusableDecisionService');
const {
    CRITICAL_EMPLOYMENT_DECISION_ROLES,
    assertCriticalEmploymentDecisionRole
} = require('./apasxoliseisCriticalActionAuthorizationService');

const ALLOWED_DECISION_TYPES = Object.freeze([
    'APPROVE_PROPOSAL',
    'APPROVE_PREFILL',
    'MARK_OK',
    'MARK_REVIEWED',
    'REJECT_PROPOSAL',
    'NEEDS_MORE_REVIEW'
]);
const ALLOWED_DECISION_STATUSES = Object.freeze(['RECORDED', 'CANCELLED']);
const REUSABLE_DECISION_ALLOWED_ROLES = new Set(CRITICAL_EMPLOYMENT_DECISION_ROLES);
const MAX_ITEMS = 500;
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const MAX_NESTED_KEYS = 100;
const ORPHAN_REUSABLE_POLICY_CODE = 'ORPHAN_CARD_CONTINUOUS';

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

function notFoundError(message) {
    const error = new Error(message);
    error.statusCode = 404;
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

function sanitizePolicyContext(value, depth = 0) {
    if (depth > 5) throw validationError('Το policy_context έχει μη επιτρεπτό βάθος.');
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizePolicyContext(item, depth + 1));
    const source = asObject(value);
    const keys = Object.keys(source);
    if (keys.length > MAX_NESTED_KEYS) throw validationError('Το policy_context περιέχει υπερβολικά πολλά πεδία.');
    return keys.reduce((result, key) => {
        if (!key || key.startsWith('$') || key.includes('.')) {
            throw validationError('Το policy_context περιέχει μη επιτρεπτό όνομα πεδίου.');
        }
        result[key] = sanitizePolicyContext(source[key], depth + 1);
        return result;
    }, {});
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
        declared_hours: Number(item.declared_hours ?? 0),
        policy_context: sanitizePolicyContext(item.policy_context),
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
    const reuseScope =
        toTrimmedString(source.reuse_scope, 50).toUpperCase() || REUSE_SCOPE.ONE_TIME;

    if (!groupId) throw validationError('Το group_id είναι υποχρεωτικό.');
    if (!groupKey) throw validationError('Το group_key είναι υποχρεωτικό.');
    if (!ALLOWED_DECISION_TYPES.includes(decisionType)) {
        throw validationError('Ο τύπος απόφασης δεν υποστηρίζεται.');
    }
    const decisionGrain = toTrimmedString(group.decision_grain, 100).toUpperCase();
    if (decisionType === 'APPROVE_PROPOSAL' && decisionGrain !== ATOMIC_DECISION_GRAIN) {
        throw validationError('Η έγκριση πρότασης υποστηρίζεται μόνο για ατομικό συνδεδεμένο σύνολο.');
    }
    if (!Object.values(REUSE_SCOPE).includes(reuseScope)) {
        throw validationError('Η εμβέλεια επαναχρησιμοποίησης δεν υποστηρίζεται.');
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
        ypokatasthma: (() => {
            const branch = toTrimmedString(source.ypokatasthma, 20);
            return branch ? branch.padStart(4, '0') : '';
        })(),
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
            reason_code: toTrimmedString(group.reason_code, 150),
            group_type: toTrimmedString(group.group_type, 100).toUpperCase(),
            decision_grain: decisionGrain
        },
        decision_type: decisionType,
        reuse_scope: reuseScope,
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
    const lookup = {
        team: scope.team,
        company_kod: scope.company_kod,
        apo_hmeromhnia: payload.apo_hmeromhnia,
        eos_hmeromhnia: payload.eos_hmeromhnia,
        group_id: payload.group.group_id,
        decision_type: payload.decision_type,
        decision_status: 'RECORDED'
    };

    if (payload.reuse_scope === REUSE_SCOPE.FUTURE_IDENTICAL) {
        lookup.reuse_scope = REUSE_SCOPE.FUTURE_IDENTICAL;
        lookup.reuse_status = REUSE_STATUS.ACTIVE;
    }

    return lookup;
}

async function createPolicyPreviewApprovalRecord({
    session,
    payload,
    authoritativeAtomicGroup = null,
    authoritativeAtomicOverlap = null,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel,
    now = new Date()
}) {
    const scope = validateSessionScope(session);
    let normalized = validatePolicyPreviewApprovalPayload(payload);
    const isAtomic = normalized.group.decision_grain === ATOMIC_DECISION_GRAIN;
    if (
        normalized.reuse_scope === REUSE_SCOPE.FUTURE_IDENTICAL &&
        !REUSABLE_DECISION_ALLOWED_ROLES.has(scope.created_by_user_role.toUpperCase())
    ) {
        const error = new Error(
            'Μόνο HR, Admin ή Supervisor μπορεί να εγκρίνει ίδιες μελλοντικές περιπτώσεις.'
        );
        error.statusCode = 403;
        throw error;
    }
    assertCriticalEmploymentDecisionRole(session);
    let atomicBuilt = null;
    if (isAtomic) {
        if (normalized.reuse_scope === REUSE_SCOPE.ONE_TIME) {
            const error = validationError(
                'Οι εφάπαξ ατομικές αποφάσεις καταγράφονται μόνο στην ειδική ροή μεταφοράς ρεπό.'
            );
            error.code = 'ATOMIC_ONE_TIME_USES_DEDICATED_PIPELINE';
            throw error;
        }
        const decisionValidation = validateAtomicReusableDecision({
            reuseScope: normalized.reuse_scope,
            decisionType: normalized.decision_type
        });
        if (!decisionValidation.valid) {
            const error = validationError(
                'Μόνο η έγκριση πρότασης μπορεί να αποθηκευτεί ως επαναχρησιμοποιήσιμη ατομική απόφαση.'
            );
            error.code = decisionValidation.diagnostic;
            throw error;
        }
        if (!authoritativeAtomicGroup || authoritativeAtomicOverlap?.conflict === true) {
            const error = validationError(
                'Το έγκυρο ατομικό συνδεδεμένο σύνολο του διακομιστή δεν είναι διαθέσιμο ή έχει επικάλυψη.'
            );
            error.code = authoritativeAtomicOverlap?.conflict === true
                ? 'ATOMIC_LINKED_SET_ROW_OVERLAP'
                : 'AUTHORITATIVE_ATOMIC_LINKED_SET_REQUIRED';
            throw error;
        }
        if (
            normalized.group.group_id !== authoritativeAtomicGroup.group_id ||
            normalized.group.group_key !== authoritativeAtomicGroup.group_key
        ) {
            const error = validationError('Η ατομική ομάδα δεν συμφωνεί με την τρέχουσα προβολή του διακομιστή.');
            error.code = 'ATOMIC_LINKED_SET_IDENTITY_MISMATCH';
            throw error;
        }
        const linkedValidation = validateAtomicLinkedSet(authoritativeAtomicGroup);
        if (!linkedValidation.eligible || !linkedValidation.canonical_items.every(isMemberEligible)) {
            const error = validationError('Το τρέχον ατομικό συνδεδεμένο σύνολο δεν είναι κατάλληλο για επαναχρησιμοποίηση.');
            error.code = linkedValidation.diagnostics[0] || 'ATOMIC_LINKED_SET_MEMBER_INELIGIBLE';
            error.diagnostics = linkedValidation.diagnostics;
            throw error;
        }
        atomicBuilt = buildAtomicReusableCriteriaV5(authoritativeAtomicGroup);
        if (!atomicBuilt.fingerprint) {
            throw validationError('Δεν ήταν δυνατή η δημιουργία έγκυρου αποτυπώματος έκδοσης 5 από τον διακομιστή.');
        }
        const authoritativeItems = atomicBuilt.validation.canonical_items.map((item, index) =>
            normalizeApprovalItem({
                ...item,
                preview_id: item.preview_id || item.prodhlomena_oraria_id,
                policy_context: authoritativeAtomicGroup.atomic_reusable_context,
                flags: {
                    ...asObject(item.flags),
                    atomic_role: CANONICAL_ROLES[index]
                }
            }, index));
        normalized = {
            ...normalized,
            ypokatasthma: authoritativeAtomicGroup.ypokatasthma,
            group: {
                ...normalized.group,
                group_type: authoritativeAtomicGroup.group_type,
                decision_grain: authoritativeAtomicGroup.decision_grain,
                policy_code: authoritativeAtomicGroup.policy_code,
                scenario_code: authoritativeAtomicGroup.scenario_code,
                status: authoritativeAtomicGroup.status,
                action_type: authoritativeAtomicGroup.action_type,
                reason_code: authoritativeAtomicGroup.reason_code
            },
            items: authoritativeItems
        };
        if (
            atomicBuilt.criteria.team !== scope.team.toUpperCase() ||
            atomicBuilt.criteria.company !== scope.company_kod.toUpperCase()
        ) {
            const error = validationError('Η έγκυρη ατομική ομάδα του διακομιστή είναι εκτός του πεδίου της συνεδρίας.');
            error.code = 'ATOMIC_LINKED_SET_SCOPE_MISMATCH';
            throw error;
        }
    }
    const reuseMatchCriteria = buildReusableMatchCriteriaFromGroup(
        {
            ...normalized.group,
            ypokatasthma: normalized.ypokatasthma
        },
        normalized.ypokatasthma
    );
    Object.assign(reuseMatchCriteria, {
        team: scope.team,
        company_kod: scope.company_kod,
        decision_type: normalized.decision_type
    });
    const reuseEligibility = getReusableDecisionEligibility({
        group: reuseMatchCriteria,
        decisionType: normalized.decision_type,
        items: normalized.items
    });

    if (!isAtomic && normalized.reuse_scope === REUSE_SCOPE.FUTURE_IDENTICAL &&
        !reuseEligibility.eligible) {
        throw validationError(reuseEligibility.reason);
    }

    const reuseCriteria = isAtomic
        ? [atomicBuilt.criteria]
        : normalized.items.map((item) => buildReusablePolicyCriteriaV4(reuseMatchCriteria, item));
    if (!isAtomic && normalized.reuse_scope === REUSE_SCOPE.FUTURE_IDENTICAL && reuseCriteria.some((criteria) =>
        !criteria.policy_version || !criteria.scenario_version ||
        !criteria.decision_grain || !criteria.rule_branch)) {
        throw validationError(
            'Η πολιτική δεν παρέχει πλήρη έκδοση, grain και rule branch για ασφαλή μελλοντική χρήση.'
        );
    }
    const candidatePolicyFingerprints = isAtomic
        ? [atomicBuilt.fingerprint]
        : [...new Set(reuseCriteria.map(buildReusableDecisionFingerprint))];
    const reuseFingerprints = normalized.reuse_scope === REUSE_SCOPE.FUTURE_IDENTICAL
        ? candidatePolicyFingerprints
        : [];
    const reuseFingerprint = reuseFingerprints[0] || '';
    const existing = await approvalModel
        .findOne(buildRecordedDecisionLookup(scope, normalized))
        .select('_id reuse_scope reuse_effective_from reuse_effective_to')
        .lean();

    const existingDecisionApplies = existing && (
        normalized.reuse_scope !== REUSE_SCOPE.FUTURE_IDENTICAL ||
        (isAtomic
            ? isEffectiveForBothMembers(existing, atomicBuilt.validation.canonical_items)
            : normalized.items.some((item) =>
                isRuleEffectiveForRow(existing, { hmeromhnia: item.hmeromhnia })
            ))
    );
    if (existingDecisionApplies) {
        throw conflictError('Η ίδια καταγεγραμμένη απόφαση υπάρχει ήδη για αυτή την ομάδα.');
    }

    if (normalized.reuse_scope === REUSE_SCOPE.ONE_TIME) {
        const activeReusableCandidates = await approvalModel
            .find({
                team: scope.team,
                company_kod: scope.company_kod,
                ypokatasthma: normalized.ypokatasthma,
                reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL,
                reuse_status: REUSE_STATUS.ACTIVE,
                decision_status: 'RECORDED',
                $or: [
                    {
                        active_policy_keys: mongoose.trusted({
                            $in: candidatePolicyFingerprints
                        })
                    },
                    {
                        reuse_fingerprints: mongoose.trusted({
                            $in: candidatePolicyFingerprints
                        })
                    }
                ]
            })
            .select(
                '_id decision_type reuse_effective_from reuse_effective_to ' +
                    'active_policy_key active_policy_keys reuse_fingerprint reuse_fingerprints'
            )
            .lean();
        const applicableReusable = activeReusableCandidates.find((rule) => isAtomic
            ? isEffectiveForBothMembers(rule, atomicBuilt.validation.canonical_items)
            : normalized.items.some((item) =>
                isRuleEffectiveForRow(rule, { hmeromhnia: item.hmeromhnia })
            ));

        if (applicableReusable) {
            const error = conflictError(
                'Υπάρχει ήδη ενεργή επαναχρησιμοποιήσιμη πολιτική που εφαρμόζεται σε αυτή την περίπτωση και πρέπει πρώτα να ανακληθεί.'
            );
            error.code = 'ACTIVE_REUSABLE_POLICY_ALREADY_APPLIES';
            error.existingApproval = {
                _id: applicableReusable._id,
                decision_type: applicableReusable.decision_type,
                active_policy_key: applicableReusable.active_policy_key
            };
            throw error;
        }
    }

    if (reuseFingerprint) {
        const reusableCandidates = await approvalModel
            .find({
                team: scope.team,
                company_kod: scope.company_kod,
                ypokatasthma: normalized.ypokatasthma,
                reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL,
                reuse_status: REUSE_STATUS.ACTIVE,
                $or: [
                    { active_policy_keys: mongoose.trusted({ $in: reuseFingerprints }) },
                    { reuse_fingerprints: mongoose.trusted({ $in: reuseFingerprints }) }
                ],
                decision_status: 'RECORDED'
            })
            .select(
                '_id decision_type created_at created_by_user_name ' +
                    'reuse_effective_from reuse_effective_to active_policy_key'
            )
            .lean();
        const existingReusable = reusableCandidates.find((rule) => isAtomic
            ? isEffectiveForBothMembers(rule, atomicBuilt.validation.canonical_items)
            : normalized.items.some((item) =>
                isRuleEffectiveForRow(rule, { hmeromhnia: item.hmeromhnia })
            ));

        if (existingReusable) {
            const error = conflictError('Υπάρχει ήδη ενεργή επαναχρησιμοποιήσιμη πολιτική και πρέπει πρώτα να ανακληθεί.');
            error.existingApproval = existingReusable;
            throw error;
        }
    }

    const created = await approvalModel.create({
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
        reuse_scope: normalized.reuse_scope,
        reuse_status:
            normalized.reuse_scope === REUSE_SCOPE.FUTURE_IDENTICAL
                ? REUSE_STATUS.ACTIVE
                : REUSE_STATUS.NOT_APPLICABLE,
        reuse_fingerprint: reuseFingerprint,
        reuse_fingerprints: reuseFingerprints,
        active_policy_key: reuseFingerprint,
        active_policy_keys: reuseFingerprints,
        reuse_match_criteria: reuseFingerprint
            ? isAtomic
                ? {
                      version: 5,
                      decision_grain: ATOMIC_DECISION_GRAIN,
                      linked_set_type: authoritativeAtomicGroup.group_type,
                      linked_member_count: 2,
                      role_contract: [...CANONICAL_ROLES],
                      criteria: atomicBuilt.criteria
                  }
                : { version: 4, variants: reuseCriteria }
            : null,
        reuse_effective_from:
            normalized.reuse_scope === REUSE_SCOPE.FUTURE_IDENTICAL
                ? normalized.apo_hmeromhnia
                : null,
        reuse_effective_to: null,
        items: normalized.items,
        snapshot_summary: buildApprovalAuditSnapshot(normalized),
        created_by_user_id: scope.created_by_user_id,
        created_by_user_name: scope.created_by_user_name,
        created_by_user_role: scope.created_by_user_role,
        source: 'POLICY_PREVIEW_GROUP_UI',
        notes: normalized.notes,
        client_payload_version: normalized.client_payload_version
    });
    if (reuseFingerprint && typeof approvalModel.countDocuments === 'function') {
        const activeCountFilter = {
            team: scope.team,
            company_kod: scope.company_kod,
            ypokatasthma: normalized.ypokatasthma,
            $or: [
                { active_policy_keys: mongoose.trusted({ $in: reuseFingerprints }) },
                { reuse_fingerprints: mongoose.trusted({ $in: reuseFingerprints }) }
            ],
            reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL,
            reuse_status: REUSE_STATUS.ACTIVE,
            decision_status: 'RECORDED'
        };
        if (isAtomic) {
            const memberDates = atomicBuilt.validation.canonical_items
                .map((item) => new Date(`${item.hmeromhnia}T00:00:00.000Z`))
                .sort((left, right) => left - right);
            activeCountFilter.reuse_effective_from = mongoose.trusted({
                $lte: memberDates[0]
            });
            activeCountFilter.$and = [
                { $or: activeCountFilter.$or },
                {
                    $or: [
                        { reuse_effective_to: null },
                        { reuse_effective_to: mongoose.trusted({ $gte: memberDates[1] }) }
                    ]
                }
            ];
            delete activeCountFilter.$or;
        }
        const activeCount = await approvalModel.countDocuments(activeCountFilter);
        if (activeCount > 1) {
            let cancelled;
            try {
                cancelled = await approvalModel.findOneAndUpdate({
                    _id: created._id,
                    reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL,
                    reuse_status: REUSE_STATUS.ACTIVE,
                    decision_status: 'RECORDED'
                }, {
                    $set: {
                        decision_status: 'CANCELLED',
                        reuse_status: REUSE_STATUS.REVOKED,
                        reuse_effective_to: now,
                        cancelled_at: now,
                        cancel_reason_code: 'CONCURRENT_ACTIVE_POLICY_CONFLICT',
                        cancelled_by: 'SYSTEM_POST_CREATE_GUARD'
                    }
                }, { new: true, runValidators: true }).lean();
            } catch (cause) {
                const cancellationError = new Error(
                    'Αποτυχία ασφαλούς ακύρωσης νέας επαναχρησιμοποιήσιμης έγκρισης μετά από ταυτόχρονη σύγκρουση.'
                );
                cancellationError.statusCode = 500;
                cancellationError.code = 'POST_CREATE_CONFLICT_CANCELLATION_FAILED';
                cancellationError.cause = cause;
                throw cancellationError;
            }
            if (!cancelled) {
                const cancellationError = new Error(
                    'Η νέα επαναχρησιμοποιήσιμη έγκριση δεν ακυρώθηκε μετά από ταυτόχρονη σύγκρουση.'
                );
                cancellationError.statusCode = 500;
                cancellationError.code = 'POST_CREATE_CONFLICT_CANCELLATION_FAILED';
                throw cancellationError;
            }
            const error = conflictError(
                'Εντοπίστηκε ταυτόχρονη ενεργή επαναχρησιμοποιήσιμη πολιτική και η νέα εγγραφή ακυρώθηκε με ασφάλεια.'
            );
            error.code = 'MULTIPLE_ACTIVE_REUSABLE_DECISIONS';
            throw error;
        }
    }
    return created;
}

async function revokePolicyPreviewApprovalRecord({
    session,
    approvalId,
    reason,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel,
    now = new Date()
}) {
    const scope = validateSessionScope(session);
    if (!REUSABLE_DECISION_ALLOWED_ROLES.has(scope.created_by_user_role.toUpperCase())) {
        const error = new Error('Δεν έχετε δικαίωμα ανάκλησης επαναχρησιμοποιήσιμης πολιτικής.');
        error.statusCode = 403;
        throw error;
    }
    const id = normalizeOptionalObjectId(approvalId, 'approvalId');
    if (!id) throw validationError('Το approvalId είναι υποχρεωτικό.');
    const revokeReason = toTrimmedString(reason, 1000);
    if (!revokeReason) throw validationError('Η αιτιολογία ανάκλησης είναι υποχρεωτική.');

    const scopedBase = { _id: id, team: scope.team, company_kod: scope.company_kod };
    const existing = await approvalModel.findOne(scopedBase).select(
        '_id reuse_scope reuse_status decision_status ypokatasthma active_policy_key'
    ).lean();
    if (!existing) throw notFoundError('Η επαναχρησιμοποιήσιμη έγκριση δεν βρέθηκε στο ενεργό πεδίο.');
    if (existing.reuse_scope !== REUSE_SCOPE.FUTURE_IDENTICAL ||
        existing.decision_status !== 'RECORDED' || existing.reuse_status !== REUSE_STATUS.ACTIVE ||
        !existing.active_policy_key) {
        throw conflictError('Η έγκριση δεν είναι ενεργή επαναχρησιμοποιήσιμη πολιτική που μπορεί να ανακληθεί.');
    }
    const revoked = await approvalModel.findOneAndUpdate({
        ...scopedBase,
        ypokatasthma: existing.ypokatasthma,
        reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL,
        reuse_status: REUSE_STATUS.ACTIVE,
        decision_status: 'RECORDED'
    }, {
        $set: {
            reuse_status: REUSE_STATUS.REVOKED,
            reuse_effective_to: now,
            revoked_at: now,
            revoked_by_user_id: scope.created_by_user_id,
            revoked_by_user_name: scope.created_by_user_name,
            revoke_reason: revokeReason
        }
    }, { new: true, runValidators: true }).lean();
    if (!revoked) throw conflictError('Η επαναχρησιμοποιήσιμη πολιτική ανακλήθηκε ήδη ή άλλαξε κατάσταση.');
    return {
        approval_id: String(revoked._id),
        reuse_status: revoked.reuse_status,
        revoked_at: revoked.revoked_at,
        revoked_by_user_name: revoked.revoked_by_user_name,
        revoke_reason: revoked.revoke_reason,
        active_policy_key: revoked.active_policy_key
    };
}

async function listActiveReusablePolicyDecisionRecords({
    session,
    ypokatasthma,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel
}) {
    const scope = validateSessionScope(session);
    const branch = toTrimmedString(ypokatasthma, 20);
    if (!branch || branch.toUpperCase() === 'ALL' || branch.includes(',')) return [];

    return approvalModel
        .find({
            team: scope.team,
            company_kod: scope.company_kod,
            ypokatasthma: branch.padStart(4, '0'),
            reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL,
            reuse_status: REUSE_STATUS.ACTIVE,
            decision_status: 'RECORDED'
        })
        .sort({ created_at: -1 })
        .lean();
}

function buildOrphanReusableCriteria(rule = {}) {
    const orphanType = toTrimmedString(rule.orphan_type, 20).toUpperCase();
    const scheduleKind = toTrimmedString(rule.schedule_kind, 20).toUpperCase();
    const policyVersion = toTrimmedString(rule.policy_version, 100);
    const relativeRule = toTrimmedString(rule.rule, 100).toUpperCase();
    const validRule = (scheduleKind === 'CONTINUOUS' && [
        'ACTUAL_START_PLUS_DECLARED_DURATION',
        'ACTUAL_END_MINUS_DECLARED_DURATION'
    ].includes(relativeRule)) ||
        (scheduleKind === 'NON_DECLARED' &&
            orphanType === 'END_ONLY' &&
            relativeRule === 'ACTUAL_END_MINUS_EFFECTIVE_DAILY_AVERAGE');
    if (!policyVersion || !['START_ONLY', 'END_ONLY'].includes(orphanType) || !validRule) {
        throw validationError('Μη έγκυρος επαναχρησιμοποιήσιμος κανόνας ορφανού χτυπήματος.');
    }
    return { version: 6, decision_grain: 'DAILY_ORPHAN_CARD', policy_code:
        ORPHAN_REUSABLE_POLICY_CODE, policy_version: policyVersion,
        orphan_type: orphanType, schedule_kind: scheduleKind, rule: relativeRule };
}

async function createOrphanReusablePolicyDecisionRecord({ session, row, rule, dbSession = null,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel, now = new Date() }) {
    const scope = validateSessionScope(session);
    assertCriticalEmploymentDecisionRole(session);
    const criteria = buildOrphanReusableCriteria(rule);
    const fingerprint = buildReusableDecisionFingerprint(criteria);
    const branch = toTrimmedString(row?.ypokatasthma, 20).padStart(4, '0');
    const date = parseDateOnly(new Date(row?.hmeromhnia).toISOString().slice(0, 10), 'hmeromhnia');
    const duplicateQuery = approvalModel.findOne({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: branch, policy_code: ORPHAN_REUSABLE_POLICY_CODE,
        reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL, reuse_status: REUSE_STATUS.ACTIVE,
        decision_status: 'RECORDED', active_policy_key: fingerprint });
    if (dbSession && typeof duplicateQuery.session === 'function') duplicateQuery.session(dbSession);
    const duplicate = await duplicateQuery.select('_id').lean();
    if (duplicate) return duplicate;
    const document = {
        team: scope.team, company_kod: scope.company_kod, ypokatasthma: branch,
        etos: scope.etos, period_kodikos: toTrimmedString(session.periodInUse, 20),
        period_id: '', apo_hmeromhnia: date, eos_hmeromhnia: date,
        group_id: `ORPHAN:${criteria.orphan_type}:${fingerprint}`,
        group_key: `ORPHAN:${criteria.orphan_type}`, grouping_scope: 'daily-orphan',
        policy_code: ORPHAN_REUSABLE_POLICY_CODE, scenario_code: criteria.orphan_type,
        status: 'APPROVED', action_type: 'ORPHAN_RESOLUTION', reason_code: 'HR_APPROVED',
        decision_type: 'APPROVE_PROPOSAL', decision_status: 'RECORDED',
        reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL, reuse_status: REUSE_STATUS.ACTIVE,
        reuse_fingerprint: fingerprint, reuse_fingerprints: [fingerprint],
        active_policy_key: fingerprint, active_policy_keys: [fingerprint],
        reuse_match_criteria: { version: 6, criteria }, reuse_effective_from: date,
        reuse_effective_to: null,
        items: [{ preview_id: String(row?._id || ''), prodhlomena_oraria_id: row?._id,
            employee_kodikos: toTrimmedString(row?.kodikos, 50), hmeromhnia: date,
            kathgoria_ergasias: toTrimmedString(row?.kathgoria_ergasias, 50),
            kathgoria_ergasias_apologistika: 'ΕΡΓ', declared_hours: Number(row?.ores_ergasias || 0),
            policy_context: criteria, proposed_values: {}, flags: { raw_cards_preserved: true } }],
        snapshot_summary: { items_count: 1, employees_count: 1, first_date: date, last_date: date },
        created_by_user_id: scope.created_by_user_id,
        created_by_user_name: scope.created_by_user_name,
        created_by_user_role: scope.created_by_user_role,
        created_at: now, source: 'ORPHAN_CARD_HR_DECISION', client_payload_version: 'orphan:v1'
    };
    const created = await approvalModel.create([document], dbSession ? { session: dbSession } : {});
    return Array.isArray(created) ? created[0] : created;
}

async function findMatchingOrphanReusablePolicyDecision({ session, ypokatasthma, rule,
    approvalModel = ApasxoliseisPolicyPreviewApprovalsModel, asOfDate = new Date() }) {
    const scope = validateSessionScope(session);
    const criteria = buildOrphanReusableCriteria(rule);
    const fingerprint = buildReusableDecisionFingerprint(criteria);
    return approvalModel.findOne({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: toTrimmedString(ypokatasthma, 20).padStart(4, '0'),
        policy_code: ORPHAN_REUSABLE_POLICY_CODE, decision_status: 'RECORDED',
        reuse_scope: REUSE_SCOPE.FUTURE_IDENTICAL, reuse_status: REUSE_STATUS.ACTIVE,
        active_policy_key: fingerprint, reuse_effective_from: mongoose.trusted({ $lte: asOfDate }),
        $or: [{ reuse_effective_to: null },
            { reuse_effective_to: mongoose.trusted({ $gte: asOfDate }) }]
    }).sort({ created_at: -1 }).lean();
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
    const ypokatasthma = toTrimmedString(source.ypokatasthma, 20);
    const decisionStatus = toTrimmedString(source.decision_status, 50).toUpperCase();
    if (groupId) filter.group_id = groupId;
    if (policyCode) filter.policy_code = policyCode;
    if (ypokatasthma) filter.ypokatasthma = ypokatasthma.padStart(4, '0');
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
    revokePolicyPreviewApprovalRecord,
    listPolicyPreviewApprovalRecords,
    listActiveReusablePolicyDecisionRecords,
    ORPHAN_REUSABLE_POLICY_CODE, buildOrphanReusableCriteria,
    createOrphanReusablePolicyDecisionRecord, findMatchingOrphanReusablePolicyDecision
};
