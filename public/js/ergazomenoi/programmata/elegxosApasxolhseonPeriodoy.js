const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

function userCanReviewEdit() {
    return document.getElementById('canReviewEdit')?.value === '1';
}

function userCanRecordRepoTransferDecision() {
    return document.getElementById('canRecordRepoTransferDecision')?.value === '1';
}

function userCanRecordCanonicalDecision() {
    return document.getElementById('canRecordRepoTransferDecision')?.value === '1';
}

function userCanManageReusablePolicyApproval() {
    return document.getElementById('canManageReusablePolicyApproval')?.value === '1';
}

function userCanApplyRepoTransferDecision() {
    return document.getElementById('canApplyRepoTransferDecision')?.value === '1';
}

function num(value) {
    return Number(value || 0);
}

function hours(value) {
    return num(value).toFixed(2);
}

function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;

    const v = String(value).trim();

    return v !== '' && v !== '-' && v !== '0' && v !== '0.0' && v !== '0.00';
}

function hasPositiveNumber(value) {
    return Number(value || 0) > 0;
}

function intervalText(apo, eos) {
    const a = String(apo || '').trim();
    const e = String(eos || '').trim();

    if (!a && !e) return '-';

    return `${a || ''} - ${e || ''}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const scenarioCodeLabels = {
    UNKNOWN_PATTERN_REQUIRES_REVIEW: 'Μη ταξινομημένο μοτίβο - προς έλεγχο',
    DECLARED_REPO_WITH_CARDS: 'Δηλωμένο ρεπό με κάρτες',
    DECLARED_WORK_NO_CARDS_LEAVE: 'Εργασία χωρίς κάρτες - άδεια',
    DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED: 'Εργασία χωρίς κάρτες - υποχρεωτική αργία',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED:
        'Μη υποχρεωτική αργία - εταιρεία κλειστή',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS:
        'Μη υποχρεωτική αργία - εταιρεία λειτουργεί',
    ZERO_LENGTH_CARD_INTERVAL: 'Μηδενικό διάστημα κάρτας',
    DECLARED_NON_WORK_WITH_CARDS: 'Μη εργασία με κάρτες',
    UNSCHEDULED_DAY_WITH_CARDS: 'Μη προδηλωμένη ημέρα με κάρτες',
    SPLIT_SHIFT_MATCHED_WITH_DEVIATION: 'Σπαστό με απόκλιση',
    REPO_TRANSFER_WITHIN_WEEK: 'Πιθανή μεταφορά ρεπό'
};

const scenarioConfidenceLabels = {
    HIGH: 'Υψηλή',
    MEDIUM: 'Μεσαία',
    LOW: 'Χαμηλή'
};

const scenarioDecisionStatusLabels = {
    PENDING_REVIEW: 'Προς έλεγχο',
    CLASSIFIED_ONLY: 'Ταξινομημένο'
};

const scenarioReasonLabels = {
    DECLARED_WORK_WITHOUT_CARDS: 'Δηλωμένη εργασία χωρίς κάρτες',
    DECLARED_LEAVE_FOUND: 'Βρέθηκε άδεια',
    HOLIDAY_REQUIRED_FOUND: 'Βρέθηκε υποχρεωτική αργία',
    HOLIDAY_OPTIONAL_COMPANY_WORKS: 'Μη υποχρεωτική αργία - εταιρεία λειτουργεί',
    HOLIDAY_OPTIONAL_COMPANY_CLOSED: 'Μη υποχρεωτική αργία - εταιρεία κλειστή',
    ZERO_LENGTH_CARD_INTERVAL_FOUND: 'Βρέθηκε μηδενικό διάστημα κάρτας',
    SPLIT_SHIFT_DEVIATION_FOUND: 'Βρέθηκε σπαστό με απόκλιση',
    DECLARED_REPO_WITH_CARDS: 'Δηλωμένο ρεπό με κάρτες',
    DECLARED_NON_WORK_WITH_CARDS: 'Μη εργασία με κάρτες',
    UNSCHEDULED_DAY_WITH_CARDS: 'Μη προδηλωμένη ημέρα με κάρτες',
    REPO_TRANSFER_CANDIDATE: 'Πιθανή μεταφορά ρεπό',
    LEGAL_CLASSIFICATION_REQUIRED: 'Απαιτείται νομοθετική ταξινόμηση',
    UNKNOWN_PATTERN: 'Δεν βρέθηκε ασφαλής αντιστοίχιση γνωστού μοτίβου'
};

const policyPreviewStatusLabels = {
    OK: {
        label: 'OK',
        description: 'Εντάξει',
        badgeClass: 'text-bg-success'
    },
    RESOLVED_BY_POLICY: {
        label: 'Επιλύθηκε από πολιτική',
        description: 'Η περίπτωση εξηγήθηκε από γνωστή πολιτική χωρίς αλλαγή δεδομένων.',
        badgeClass: 'text-bg-success'
    },
    PREFILLED_PENDING_APPROVAL: {
        label: 'Προσυμπληρωμένο / αναμονή ελέγχου',
        description: 'Προσυμπληρωμένο / αναμονή ελέγχου',
        badgeClass: 'text-bg-warning'
    },
    NEEDS_REVIEW: {
        label: 'Χρειάζεται έλεγχο',
        description: 'Χρειάζεται έλεγχο',
        badgeClass: 'text-bg-danger'
    },
    UNKNOWN_PATTERN: {
        label: 'Μη ταξινομημένο μοτίβο',
        description: 'Η περίπτωση δεν αντιστοιχίστηκε σε διαθέσιμη πολιτική και παραμένει για έλεγχο.',
        badgeClass: 'text-bg-secondary'
    },
    CONFLICT_AMBIGUOUS: {
        label: 'Αμφίσημη σύγκρουση στοιχείων',
        description: 'Υπάρχουν αντικρουόμενα στοιχεία ή περισσότερες από μία πιθανές ταξινομήσεις.',
        badgeClass: 'text-bg-danger'
    }
};

const policyPreviewPolicyLabels = {
    NO_APOLOGISTIKO_BIBLIO_OK: 'Δεν αφορά απολογιστικό βιβλίο',
    CARD_NOT_REQUIRED_DECLARED_SCHEDULE_OK: 'Δεν απαιτείται κάρτα για προδηλωμένο ωράριο',
    UNSCHEDULED_DAY_WITH_COMPLETE_CARDS:
        'Μη προδηλωμένη ημέρα με πλήρεις κάρτες',
    DECLARED_REPO_OR_NON_WORK_WITH_CARDS:
        'Ρεπό, μη εργασία ή μη προδηλωμένη ημέρα με κάρτες',
    NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY: 'Εργασία χωρίς κάρτες λόγω άδειας ή αργίας',
    WEEKLY_REPO_BALANCE: 'Ισορροπία εβδομαδιαίων ρεπό',
    SPLIT_SHIFT_MINIMUM_REST: 'Ελάχιστη ανάπαυση σε σπαστό ωράριο',
    INTERDAY_MINIMUM_REST: 'Ελάχιστη ανάπαυση μεταξύ διαδοχικών ημερών',
    UNKNOWN: 'Δεν αντιστοιχίστηκε διαθέσιμη πολιτική'
};

const policyPreviewScenarioLabels = {
    UNKNOWN_PATTERN_REQUIRES_REVIEW: 'Μη ταξινομημένο μοτίβο που χρειάζεται έλεγχο',
    DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED:
        'Εργασία χωρίς κάρτες σε υποχρεωτική αργία',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS:
        'Εργασία χωρίς κάρτες σε προαιρετική αργία με λειτουργία εταιρείας',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED:
        'Εργασία χωρίς κάρτες σε προαιρετική αργία με κλειστή εταιρεία',
    DECLARED_WORK_NO_CARDS_LEAVE: 'Εργασία χωρίς κάρτες λόγω άδειας',
    DECLARED_REPO_WITH_CARDS: 'Δηλωμένο ρεπό με κάρτες',
    DECLARED_NON_WORK_WITH_CARDS: 'Δηλωμένη μη εργασία με κάρτες',
    UNSCHEDULED_DAY_WITH_CARDS: 'Μη προδηλωμένη ημέρα με κάρτες',
    ZERO_LENGTH_CARD_INTERVAL: 'Μηδενικό διάστημα κάρτας',
    SPLIT_SHIFT_MATCHED_WITH_DEVIATION: 'Σπαστό ωράριο με απόκλιση',
    REPO_TRANSFER_WITHIN_WEEK: 'Πιθανή μεταφορά ρεπό εντός εβδομάδας',
    SPLIT_SHIFT_REST_VIOLATION: 'Ανάπαυση σπαστού ωραρίου κάτω από 3 ώρες',
    INTERDAY_REST_VIOLATION: 'Ημερήσια ανάπαυση κάτω από 11 ώρες',
    SPLIT_SHIFT_REST_TECHNICAL_PENDING:
        'Ο έλεγχος ανάπαυσης σπαστού αναμένει πλήρη στοιχεία καρτών',
    INTERDAY_REST_TECHNICAL_PENDING:
        'Ο έλεγχος ημερήσιας ανάπαυσης αναμένει πλήρη στοιχεία καρτών',
    UNKNOWN: 'Δεν αντιστοιχίστηκε διαθέσιμο σενάριο'
};

const policyPreviewActionLabels = {
    REVIEW_ONLY: 'Μόνο για έλεγχο',
    SUGGESTION: 'Πρόταση προς αξιολόγηση',
    PREFILL: 'Προσυμπλήρωση',
    AUTO_APPLY: 'Αυτόματη εφαρμογή όπου επιτρέπεται',
    OK: 'Καμία ενέργεια',
    UNKNOWN: 'Δεν προβλέπεται ενέργεια'
};

const policyPreviewReasonLabels = {
    DECLARED_WORK_WITHOUT_CARDS: 'Προδηλωμένη εργασία χωρίς κάρτες',
    UNKNOWN_PATTERN: 'Δεν βρέθηκε ασφαλής αντιστοίχιση γνωστού μοτίβου',
    NO_APOLOGISTIKO_REVIEW_REQUIRED: 'Απαιτείται έλεγχος μη απολογιστικού βιβλίου',
    DECLARED_LEAVE_FOUND: 'Βρέθηκε δηλωμένη άδεια',
    HOLIDAY_REQUIRED_FOUND: 'Βρέθηκε υποχρεωτική αργία',
    HOLIDAY_OPTIONAL_COMPANY_WORKS:
        'Βρέθηκε προαιρετική αργία κατά την οποία η εταιρεία λειτουργεί',
    HOLIDAY_OPTIONAL_COMPANY_CLOSED:
        'Βρέθηκε προαιρετική αργία κατά την οποία η εταιρεία είναι κλειστή',
    ZERO_LENGTH_CARD_INTERVAL_FOUND: 'Βρέθηκε μηδενικό διάστημα κάρτας',
    SPLIT_SHIFT_DEVIATION_FOUND: 'Βρέθηκε απόκλιση σε σπαστό ωράριο',
    DECLARED_REPO_WITH_CARDS: 'Βρέθηκε προδηλωμένο ρεπό με κάρτες',
    DECLARED_NON_WORK_WITH_CARDS: 'Βρέθηκε προδηλωμένη μη εργασία με κάρτες',
    UNSCHEDULED_DAY_WITH_CARDS: 'Βρέθηκε μη προδηλωμένη ημέρα με πλήρεις κάρτες',
    REPO_TRANSFER_CANDIDATE: 'Βρέθηκε πιθανή μεταφορά ρεπό εντός εβδομάδας',
    LEGAL_CLASSIFICATION_REQUIRED: 'Απαιτείται έλεγχος νομικής ταξινόμησης',
    CARD_NOT_REQUIRED: 'Δεν απαιτείται κάρτα εργασίας',
    EMPLOYEE_CARD_NOT_REQUIRED: 'Δεν απαιτείται κάρτα εργασίας',
    NO_APOLOGISTIKO_BIBLIO: 'Δεν αφορά απολογιστικό βιβλίο',
    SPLIT_REST_BELOW_MINIMUM: 'Η ανάπαυση μεταξύ τμημάτων είναι μικρότερη από 3 ώρες',
    SPLIT_INTERVALS_OVERLAP: 'Τα τμήματα του σπαστού ωραρίου επικαλύπτονται',
    INTERDAY_REST_BELOW_MINIMUM: 'Η ανάπαυση μεταξύ ημερών είναι μικρότερη από 11 ώρες',
    INTERDAY_INTERVALS_OVERLAP: 'Τα διαστήματα εργασίας διαδοχικών ημερών επικαλύπτονται',
    CARD_VERIFICATION_PENDING: 'Αναμένονται πλήρη και επαληθεύσιμα χτυπήματα καρτών',
    UNKNOWN: 'Δεν καταγράφηκε ειδική αιτιολογία'
};

const policyPreviewFlagLabels = {
    has_cards: 'Υπάρχουν κάρτες',
    is_holiday: 'Αργία',
    is_mandatory_holiday: 'Υποχρεωτική αργία',
    is_optional_holiday: 'Προαιρετική αργία',
    is_locked: 'Κλειδωμένο',
    has_manual_override: 'Χειροκίνητη παρέμβαση',
    blocked: 'Μπλοκαρισμένο',
    requires_human_approval: 'Απαιτείται ανθρώπινος έλεγχος',
    batch_approvable: 'Δυνατή μαζική έγκριση'
};

const policyPreviewFieldLabels = {
    employee_kodikos: 'Κωδικός',
    hmeromhnia: 'Ημ/νία',
    kathgoria_ergasias: 'Προδηλωμένο',
    kathgoria_ergasias_apologistika: 'Απολογιστικό',
    cards_ores_ergasias: 'Ώρες καρτών',
    prodhlomena_oraria_id: 'ID εγγραφής',
    proposed_values: 'Προτεινόμενες τιμές',
    flags: 'Ενδείξεις'
};

const policyPreviewDecisionLabels = Object.freeze({
    APPROVE_PROPOSAL: 'Έγκριση πρότασης',
    APPROVE_PREFILL: 'Έγκριση πρότασης για μελλοντική εφαρμογή',
    MARK_OK: 'Καταγραφή ως OK',
    MARK_REVIEWED: 'Καταγραφή ως ελεγμένο',
    REJECT_PROPOSAL: 'Απόρριψη πρότασης',
    NEEDS_MORE_REVIEW: 'Χρειάζεται περαιτέρω έλεγχο'
});

const policyPreviewDecisionButtons = Object.freeze([
    { type: 'MARK_REVIEWED', className: 'policy-preview-decision-success' },
    { type: 'NEEDS_MORE_REVIEW', className: 'policy-preview-decision-warning' },
    { type: 'REJECT_PROPOSAL', className: 'policy-preview-decision-danger' },
    { type: 'APPROVE_PREFILL', className: 'policy-preview-decision-primary' }
]);

const scenarioProposedUpdateFillableFields = new Set([
    'apo_ora_01_apologistika',
    'eos_ora_01_apologistika',
    'apo_ora_02_apologistika',
    'eos_ora_02_apologistika',
    'apo_ora_03_apologistika',
    'eos_ora_03_apologistika',
    'ores_ergasias_apologistika',
    'ores_apoysias_apologistika',
    'ores_nyxtas_apologistika',
    'ores_argion_prosayxhsh_apologistika',
    'ores_argion_ergasia_apologistika',
    'ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika',
    'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika',
    'ores_yperergasias_argion_nyxtas_apologistika',
    'ores_nominhs_yperorias_apologistika',
    'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika',
    'ores_paranomhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_nyxtas_apologistika',
    'ores_paranomhs_yperorias_argion_apologistika',
    'ores_paranomhs_yperorias_argion_nyxtas_apologistika',
    'repo_apologistika',
    'adeia_apologistika',
    'astheneia_apologistika',
    'kyriakes_apologistika',
    'kathgoria_adeias_apologistika'
]);

let currentReviewRows = [];
let currentReviewDeviations = [];
let currentPendingDeviationWeeks = [];
let currentLegacyDeviations = [];
let currentPolicyPreviewRowsById = new Map();
let currentPolicyPreviewGrouping = null;
let currentAtomicRepoTransferProjection = null;
let currentRepoTransferDecisionsByProposalId = new Map();
const repoTransferDecisionSubmitting = new Set();
const repoTransferApplySubmitting = new Set();
const repoTransferApplyRequestIds = new Map();
let currentPolicyPreviewApprovalRecords = [];
let currentPolicyPreviewApprovalTotal = 0;
let currentPolicyPreviewApprovalsByGroupId = new Map();
let currentPolicyPreviewApprovalsError = '';
let currentPolicyPreviewBaseParams = null;
let policyPreviewApprovalSubmitting = false;
let currentApprovalHistoryExpanded = false;
let currentPolicyPreviewApplyDryRun = null;
let currentPolicyPreviewApplyDryRunError = '';
let currentPolicyPreviewApplyDryRunExpanded = false;
let currentHrReviewProjection = null;
let currentHrPendingGroups = [];
let currentHrCompletedGroups = [];
let currentHrReviewLoaded = false;
let currentHrReviewLoading = false;
const currentApprovalHistoryFilters = {
    decisionType: '',
    userName: '',
    searchText: ''
};

const reviewFilterDefinitions = [
    { key: 'onlyApologistiko', id: 'only_apologistiko', label: 'Μόνο Απολογιστικό' },
    { key: 'onlyNight', id: 'only_nyxta', label: 'Μόνο Νύχτα' },
    { key: 'onlyHoliday', id: 'only_argia', label: 'Μόνο Αργία' },
    { key: 'onlyYperergasia', id: 'only_yperergasia', label: 'Μόνο Υπερεργασία' },
    { key: 'onlyScenarioReview', id: 'scenarioRequiresReviewOnly', label: 'Μόνο προς έλεγχο' }
];

function rowIdentityKey(value) {
    if (value === null || value === undefined) return '';

    return String(value).trim();
}

const policyPreviewDecisionStatuses = new Set([
    'NEEDS_REVIEW',
    'PREFILLED_PENDING_APPROVAL',
    'CONFLICT_AMBIGUOUS'
]);

function isPolicyPreviewDecisionStatus(status) {
    return policyPreviewDecisionStatuses.has(String(status || '').trim());
}

function attachPolicyPreviewResults(rows = [], previewRows = []) {
    currentPolicyPreviewRowsById = new Map(
        (Array.isArray(previewRows) ? previewRows : [])
            .filter((previewRow) => {
                const sourceId = rowIdentityKey(previewRow?.prodhlomena_oraria_id);
                const previewId = rowIdentityKey(previewRow?.preview_id);

                return !previewId || previewId === sourceId;
            })
            .map((previewRow) => [
                rowIdentityKey(previewRow?.prodhlomena_oraria_id),
                previewRow
            ])
            .filter(([id]) => Boolean(id))
    );

    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const preview = currentPolicyPreviewRowsById.get(
            rowIdentityKey(row?._id || row?.id)
        );
        row.policyResult = preview?.policyResult || null;
    });
}

function scenarioLabel(decision = {}) {
    const code = String(decision.scenario_code || '').trim();

    if (!code) return '';
    if (decision.requires_review === true) return 'ΠΡΟΣ ΕΛΕΓΧΟ';

    return scenarioCodeLabels[code] || code;
}

function scenarioTitle(decision = {}) {
    const code = String(decision.scenario_code || '').trim();
    const label = scenarioCodeLabels[code] || code;

    if (!code) return '';

    return `${label} / ${code}`;
}

function scenarioConfidenceLabel(confidence) {
    const key = String(confidence || '').trim();

    return scenarioConfidenceLabels[key] || key;
}

function scenarioDecisionStatusLabel(status) {
    const key = String(status || '').trim();

    return scenarioDecisionStatusLabels[key] || key;
}

function scenarioReasonLabel(reason) {
    const key = String(reason || '').trim();

    return scenarioReasonLabels[key] || key;
}

function buildRepoTransferReviewRowStates() {
    const states = new Map();

    currentRepoTransferDecisionsByProposalId.forEach((record) => {
        const history = record?.applied_history;
        if (!history || record?.current_execution?.execution_status !== 'APPLIED') return;

        [
            ['source', history.source],
            ['target', history.target]
        ].forEach(([role, item]) => {
            const id = rowIdentityKey(item?.prodhlomena_oraria_id);
            if (!id) return;

            states.set(id, {
                applied: true,
                pending: false,
                role
            });
        });
    });

    const groups = Array.isArray(currentAtomicRepoTransferProjection?.groups)
        ? currentAtomicRepoTransferProjection.groups
        : [];
    groups.forEach((group) => {
        if (isHrReviewGroupCompleted(group)) return;

        (group.items || []).forEach((item) => {
            const id = rowIdentityKey(item?.prodhlomena_oraria_id);
            if (!id || states.has(id)) return;

            states.set(id, {
                applied: false,
                pending: true,
                role:
                    item?.role === 'TARGET_BECOMES_REPO'
                        ? 'target'
                        : item?.role === 'SOURCE_BECOMES_WORK'
                          ? 'source'
                          : ''
            });
        });
    });

    return states;
}

function renderScenarioBadge(row, repoTransferState) {
    if (repoTransferState?.applied === true && repoTransferState.role === 'target') {
        return `
            <div class="review-scenario-badge-row">
                <span class="review-scenario-badge review-scenario-badge-applied">
                    ΕΦΑΡΜΟΣΤΗΚΕ
                </span>
            </div>
        `;
    }

    const reusableDecision = row?.policyResult?.reusable_decision;
    if (reusableDecision?.approval_id) {
        const approvedBy = reusableDecision.approved_by_user_name || 'HR';
        const approvedAt = formatPolicyPreviewDateTime(reusableDecision.approved_at);
        return `
            <div class="review-scenario-badge-row">
                <span class="review-scenario-badge review-scenario-badge-classified"
                      title="${escapeHtml(`Εγκρίθηκε από ${approvedBy} στις ${approvedAt}`)}">
                    ΒΑΣΕΙ ΠΑΛΑΙΟΤΕΡΗΣ ΕΓΚΡΙΣΗΣ HR
                </span>
            </div>
        `;
    }

    const decision = row?.scenarioDecision;

    if (!decision || !decision.scenario_code) return '';
    if (
        row?.policyResult?.result_status &&
        !isPolicyPreviewDecisionStatus(row.policyResult.result_status)
    ) return '';
    if (decision.display_labels?.show_badge === false) return '';
    if (
        decision.requires_review === true &&
        repoTransferState !== undefined &&
        repoTransferState?.pending !== true
    ) return '';

    const label = scenarioLabel(decision);
    const badgeClass =
        decision.requires_review === true
            ? 'review-scenario-badge review-scenario-badge-review'
            : 'review-scenario-badge review-scenario-badge-classified';
    const title = scenarioTitle(decision);
    return `
        <div class="review-scenario-badge-row">
            <span class="${badgeClass}" title="${escapeHtml(title)}">
                ${escapeHtml(label)}
            </span>
        </div>
    `;
}

function isScenarioReviewRow(row) {
    const policyStatus = row?.policyResult?.result_status;

    if (policyStatus) return isPolicyPreviewDecisionStatus(policyStatus);

    return row?.scenarioDecision?.requires_review === true;
}

function scenarioReviewOnlyEnabled() {
    return document.getElementById('scenarioRequiresReviewOnly')?.checked === true;
}

function getActiveReviewFilters() {
    return reviewFilterDefinitions.reduce((filters, filter) => {
        filters[filter.key] = document.getElementById(filter.id)?.checked === true;
        return filters;
    }, {});
}

function getActiveReviewFilterLabels(filters = getActiveReviewFilters()) {
    return reviewFilterDefinitions
        .filter((filter) => filters[filter.key] === true)
        .map((filter) => filter.label);
}

function isAnyReviewFilterActive(filters = getActiveReviewFilters()) {
    return Object.values(filters).some(Boolean);
}

function rowPassesActiveReviewFilters(row, filters, holidayLikeDateSet) {
    if (filters.onlyApologistiko && row.apologistiko_biblio !== true) return false;

    if (filters.onlyNight && !hasPositiveNumber(row.ores_nyxtas_apologistika)) return false;

    if (filters.onlyHoliday && !hasPositiveNumber(calculateHolidayDisplayHours(row, holidayLikeDateSet))) {
        return false;
    }

    if (filters.onlyYperergasia && !(sumYperergasia(row) > 0)) return false;

    if (filters.onlyScenarioReview && !isScenarioReviewRow(row)) return false;

    return true;
}

function getVisibleReviewRows(rows = currentReviewRows) {
    const filters = getActiveReviewFilters();

    if (!isAnyReviewFilterActive(filters)) return rows;

    const holidayLikeDateSet = buildHolidayLikeDateSet(rows);

    return rows.filter((row) => rowPassesActiveReviewFilters(row, filters, holidayLikeDateSet));
}

function updateReviewFilterLayoutState() {
    const cardBody = document.querySelector('.review-card-body');

    if (!cardBody) return;

    cardBody.classList.toggle('review-filters-active', isAnyReviewFilterActive());
}

function updateScenarioReviewFilterNotice() {
    const notice = document.getElementById('scenarioRequiresReviewOnlyNotice');

    if (!notice) return;

    const filters = getActiveReviewFilters();
    const activeFilterLabels = getActiveReviewFilterLabels(filters);

    if (!isAnyReviewFilterActive(filters)) {
        notice.classList.add('d-none');
        notice.textContent = '';
        return;
    }

    const visibleCount = getVisibleReviewRows().length;
    const totalCount = currentReviewRows.length;
    const prefix = activeFilterLabels.length === 1 ? 'Ενεργό φίλτρο' : 'Ενεργά φίλτρα';

    notice.classList.remove('d-none');
    notice.textContent = `${prefix}: ${activeFilterLabels.join(', ')} (${visibleCount}/${totalCount}).`;
}

function renderCurrentReviewRows() {
    renderReviewRows(getVisibleReviewRows(), [
        ...currentReviewDeviations,
        ...currentPendingDeviationWeeks,
        ...currentLegacyDeviations
    ]);
    updateScenarioReviewFilterNotice();
    updateReviewFilterLayoutState();
}

function bindReviewFilterChangeListeners() {
    reviewFilterDefinitions.forEach((filter) => {
        const checkbox = document.getElementById(filter.id);

        if (!checkbox || checkbox.dataset.reviewFilterListenerBound === '1') return;

        checkbox.addEventListener('change', () => {
            renderCurrentReviewRows();
        });

        checkbox.dataset.reviewFilterListenerBound = '1';
    });
}

function ensureScenarioReviewFilterControl() {
    const filtersRow = document.querySelector('.review-filters-sticky .row.form-group');

    if (!filtersRow) return;

    if (document.getElementById('scenarioRequiresReviewOnly')) {
        bindReviewFilterChangeListeners();
        updateReviewFilterLayoutState();
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'col-auto d-flex align-items-center gap-2';

    const label = document.createElement('label');
    label.className = 'col-form-label label-font-size mb-0';
    label.htmlFor = 'scenarioRequiresReviewOnly';
    label.textContent = 'Μόνο προς έλεγχο';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input custom-checkbox checkbox-class mt-0';
    checkbox.id = 'scenarioRequiresReviewOnly';
    checkbox.name = 'scenarioRequiresReviewOnly';

    wrapper.appendChild(label);
    wrapper.appendChild(checkbox);
    filtersRow.appendChild(wrapper);

    const notice = document.createElement('div');
    notice.id = 'scenarioRequiresReviewOnlyNotice';
    notice.className = 'col-12 small text-muted d-none';
    filtersRow.appendChild(notice);

    bindReviewFilterChangeListeners();
    updateReviewFilterLayoutState();
}

function ensureReviewCardElevation() {
    const reviewCard = document.querySelector('.review-card-body')?.closest('.card');

    reviewCard?.classList.add('z-depth-5');
}

function formatScenarioValue(value) {
    if (value === true) return 'ΝΑΙ';
    if (value === false) return 'ΟΧΙ';
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
}

function renderScenarioList(items = [], labelFn = (value) => value) {
    const listItems = (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .map(
            (item) => `
                <li>
                    ${escapeHtml(labelFn(item))}
                    <small class="text-muted">(${escapeHtml(item)})</small>
                </li>
            `
        );

    if (listItems.length === 0) return '';

    return `<ul class="review-scenario-list mb-0">${listItems.join('')}</ul>`;
}

function renderScenarioProposedUpdates(proposedUpdates = {}) {
    const entries = Object.entries(proposedUpdates || {});

    if (entries.length === 0) return '';

    const canFillAnyField = entries.some(([field]) => canFillScenarioProposedUpdate(field));

    return `
        <div class="review-scenario-subsection">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                <div class="fw-semibold">Προτεινόμενες αλλαγές</div>
                ${
                    canFillAnyField
                        ? `
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                id="fillScenarioProposedUpdatesBtn">
                                Γέμισμα πεδίων από πρόταση
                            </button>
                        `
                        : ''
                }
            </div>
            <div class="small text-muted mb-2">
                Το γέμισμα πεδίων δεν αποθηκεύει αλλαγές. Για αποθήκευση απαιτείται το υπάρχον κουμπί αποθήκευσης.
            </div>
            <table class="table table-sm table-bordered mb-0">
                <thead>
                    <tr>
                        <th>Πεδίο</th>
                        <th>Προτεινόμενη τιμή</th>
                        <th>Τύπος</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries
                        .map(
                            ([field, value]) => {
                                const canFillField = canFillScenarioProposedUpdate(field);
                                const fillabilityLabel = canFillField
                                    ? 'Μπορεί να γεμίσει πεδίο'
                                    : 'Μόνο προβολή';
                                const fillabilityClass = canFillField
                                    ? 'text-bg-success'
                                    : 'text-bg-secondary';

                                return `
                                    <tr>
                                        <td>${escapeHtml(auditLabel(field))}</td>
                                        <td>${escapeHtml(formatScenarioValue(value))}</td>
                                        <td>
                                            <span class="badge ${fillabilityClass}">
                                                ${fillabilityLabel}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }
                        )
                        .join('')}
                </tbody>
            </table>
        </div>
    `;
}

function canFillScenarioProposedUpdate(field) {
    const key = String(field || '').trim();

    return scenarioProposedUpdateFillableFields.has(key);
}

function setScenarioProposedUpdateField(field, value) {
    const key = String(field || '').trim();

    if (!canFillScenarioProposedUpdate(key)) return false;

    if (key === 'kathgoria_adeias_apologistika') {
        const hidden = document.getElementById('edit_kathgoria_adeias_apologistika_hidden');
        const select = document.getElementById('edit_kathgoria_adeias_apologistika');
        const normalizedValue = String(value ?? '');

        if (!hidden && !select) return false;

        if (hidden) hidden.value = normalizedValue;

        if (select?.tomselect) {
            select.tomselect.addOption({
                value: normalizedValue,
                label: normalizedValue,
                text: normalizedValue
            });
            select.tomselect.setValue(normalizedValue, true);
        } else if (select) {
            select.value = normalizedValue;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return true;
    }

    const input = document.getElementById(`edit_${key}`);

    if (!input) return false;

    if (input.type === 'checkbox') {
        input.checked = value === true || value === 'true' || value === 1 || value === '1';
    } else {
        input.value = value ?? '';
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
}

function fillScenarioProposedUpdates(row) {
    const proposedUpdates = row?.scenarioDecision?.proposed_updates || {};
    const entries = Object.entries(proposedUpdates);
    let filledCount = 0;

    entries.forEach(([field, value]) => {
        if (setScenarioProposedUpdateField(field, value)) {
            filledCount += 1;
        }
    });

    const reasonField = document.getElementById('edit_reason');
    if (reasonField && !reasonField.value.trim() && filledCount > 0) {
        reasonField.value = 'Γέμισμα πεδίων από προτεινόμενη ταξινόμηση σεναρίου.';
    }

    if (filledCount > 0 && window.Swal?.fire) {
        Swal.fire({
            icon: 'info',
            title: 'Πρόταση σεναρίου',
            text: `Συμπληρώθηκαν ${filledCount} πεδίο/πεδία στο modal. Η αποθήκευση δεν έγινε αυτόματα.`
        });
    }
}

function renderScenarioFactsSummary(factsSummary = {}) {
    if (!factsSummary || Object.keys(factsSummary).length === 0) return '';

    const items = [
        ['Προδηλωμένο', factsSummary.declared_category],
        ['Ώρες καρτών', factsSummary.card_hours],
        ['Έχει κάρτες', factsSummary.has_cards],
        ['Αργία', factsSummary.is_holiday],
        ['Κλειδωμένη', factsSummary.is_locked]
    ];

    return `
        <div class="review-scenario-facts">
            ${items
                .map(
                    ([label, value]) => `
                        <span class="review-scenario-fact">
                            ${escapeHtml(label)}: ${escapeHtml(formatScenarioValue(value))}
                        </span>
                    `
                )
                .join('')}
        </div>
    `;
}

function renderScenarioDetailsSection(row) {
    const decision = row?.scenarioDecision;

    if (!decision) return '';

    const code = String(decision.scenario_code || '').trim();
    const label = scenarioCodeLabels[code] || code || '-';
    const confidence = scenarioConfidenceLabel(decision.confidence);
    const status = scenarioDecisionStatusLabel(decision.decision_status);
    const reviewText =
        decision.requires_review === true ? 'ΠΡΟΣ ΕΛΕΓΧΟ' : 'Δεν απαιτείται έλεγχος';
    const reasonsHtml = renderScenarioList(decision.reasons, scenarioReasonLabel);
    const warningsHtml = renderScenarioList(decision.warnings);
    const proposedUpdatesHtml = renderScenarioProposedUpdates(decision.proposed_updates);
    const factsSummaryHtml = renderScenarioFactsSummary(row.scenarioFactsSummary);

    return `
        <div class="review-modal-section" id="reviewScenarioDetails">
            <div class="review-modal-section-title">Ταξινόμηση Σεναρίου</div>

            <div class="review-scenario-summary">
                <span class="review-badge">${escapeHtml(label)}</span>
                ${code ? `<span class="review-badge">${escapeHtml(code)}</span>` : ''}
                ${confidence ? `<span class="review-badge">Βεβαιότητα αντιστοίχισης: ${escapeHtml(confidence)}</span>` : ''}
                ${status ? `<span class="review-badge">Κατάσταση: ${escapeHtml(status)}</span>` : ''}
                <span class="review-badge">${escapeHtml(reviewText)}</span>
            </div>

            ${
                reasonsHtml
                    ? `
                        <div class="review-scenario-subsection">
                            <div class="fw-semibold mb-1">Λόγοι</div>
                            ${reasonsHtml}
                        </div>
                    `
                    : ''
            }

            ${
                warningsHtml
                    ? `
                        <div class="review-scenario-subsection">
                            <div class="fw-semibold mb-1">Προειδοποιήσεις</div>
                            ${warningsHtml}
                        </div>
                    `
                    : ''
            }

            ${proposedUpdatesHtml}
            ${factsSummaryHtml}
        </div>
    `;
}

function intervalTextHtml(apo, eos) {
    const a = String(apo || '').trim();
    const e = String(eos || '').trim();

    if (!a && !e) return '-';

    return `${escapeHtml(a || '')} - ${escapeHtml(e || '')}`;
}

function renderIntervalCell(row, apoPrefix, eosPrefix, suffix = '') {
    const lines = [1, 2, 3]
        .map((n) => {
            const p = pairNo(n);
            const apo = row[`${apoPrefix}_${p}${suffix}`];
            const eos = row[`${eosPrefix}_${p}${suffix}`];

            if (!hasMeaningfulValue(apo) && !hasMeaningfulValue(eos)) {
                return '';
            }

            return `<div class="review-interval-line">${intervalTextHtml(apo, eos)}</div>`;
        })
        .filter(Boolean);

    return lines.length > 0 ? lines.join('') : '-';
}

function tdClass(className) {
    return className ? ` class="${className}"` : '';
}

function isApologistikoIntervalPresent(row) {
    return (
        hasMeaningfulValue(row.apo_ora_01_apologistika) ||
        hasMeaningfulValue(row.eos_ora_01_apologistika) ||
        hasMeaningfulValue(row.apo_ora_02_apologistika) ||
        hasMeaningfulValue(row.eos_ora_02_apologistika) ||
        hasMeaningfulValue(row.apo_ora_03_apologistika) ||
        hasMeaningfulValue(row.eos_ora_03_apologistika)
    );
}

function hasValidCardInterval(row = {}) {
    return [1, 2, 3].some((n) => {
        const p = pairNo(n);
        return (
            timeToMinutes(row[`cards_apo_ora_${p}`]) !== null &&
            timeToMinutes(row[`cards_eos_ora_${p}`]) !== null
        );
    });
}

function yperoriaCellClass(row) {
    if (sumParanomiYperoria(row) > 0) return 'cell-paranomi-yperoria';
    if (sumNomimiYperoria(row) > 0) return 'cell-nomimi-yperoria';

    return '';
}

function timeToMinutes(value) {
    const v = String(value || '').trim();

    if (!/^\d{2}:\d{2}$/.test(v)) return null;

    const [hh, mm] = v.split(':').map(Number);

    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

    return hh * 60 + mm;
}

function dateKey(value) {
    if (!value) return '';

    const dt = new Date(value);

    if (isNaN(dt.getTime())) return '';

    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function addDaysKey(value, daysToAdd) {
    const dt = new Date(value);

    if (isNaN(dt.getTime())) return '';

    dt.setDate(dt.getDate() + daysToAdd);

    return dateKey(dt);
}

function isSundayDate(value) {
    const dt = new Date(value);

    if (isNaN(dt.getTime())) return false;

    return dt.getDay() === 0;
}

function isHolidayLikeRow(row) {
    return row.argia === true || row.kyriakes_apologistika === true || isSundayDate(row.hmeromhnia);
}

function buildHolidayLikeDateSet(rows) {
    const set = new Set();

    (rows || []).forEach((row) => {
        if (isHolidayLikeRow(row)) {
            const key = dateKey(row.hmeromhnia);

            if (key) set.add(key);
        }
    });

    return set;
}

function calculateHolidayDisplayHours(row, holidayLikeDateSet = new Set()) {
    const recordedHolidayHours =
        num(row.ores_argion_prosayxhsh_apologistika) + num(row.ores_argion_ergasia_apologistika);

    if (recordedHolidayHours > 0) {
        return recordedHolidayHours;
    }

    const rowDateKey = dateKey(row.hmeromhnia);
    const nextDateKey = addDaysKey(row.hmeromhnia, 1);

    const currentDayIsHoliday = isHolidayLikeRow(row) || holidayLikeDateSet.has(rowDateKey);
    const nextDayIsHoliday = holidayLikeDateSet.has(nextDateKey);

    const fullCardsHours = num(row.cards_ores_ergasias);

    let partialHolidayMinutes = 0;

    [1, 2, 3].forEach((n) => {
        const p = pairNo(n);
        const start = timeToMinutes(row[`cards_apo_ora_${p}`]);
        const end = timeToMinutes(row[`cards_eos_ora_${p}`]);

        if (start === null || end === null) return;

        const crossesMidnight = end <= start;

        if (currentDayIsHoliday) {
            if (!crossesMidnight) {
                partialHolidayMinutes += end - start;
                return;
            }

            if (nextDayIsHoliday) {
                // Η τρέχουσα μέρα είναι Κυριακή/αργία και η επόμενη είναι επίσης αργία:
                // όλο το διάστημα θεωρείται αργία.
                partialHolidayMinutes += 1440 - start + end;
                return;
            }

            // Η τρέχουσα μέρα είναι Κυριακή/αργία αλλά η επόμενη όχι:
            // μετράμε μόνο μέχρι 23:59/24:00.
            partialHolidayMinutes += 1440 - start;
            return;
        }

        if (crossesMidnight && nextDayIsHoliday) {
            // Η τρέχουσα μέρα δεν είναι αργία, αλλά μετά τα μεσάνυχτα μπαίνουμε
            // σε Κυριακή/αργία: μετράμε 00:00 έως ώρα αποχώρησης.
            partialHolidayMinutes += end;
        }
    });

    const calculatedHours = +(partialHolidayMinutes / 60).toFixed(2);

    if (calculatedHours > 0) {
        if (currentDayIsHoliday && nextDayIsHoliday && fullCardsHours > 0) {
            return fullCardsHours;
        }

        return calculatedHours;
    }

    if (currentDayIsHoliday && fullCardsHours > 0) {
        return fullCardsHours;
    }

    return 0;
}

function formatDate(value) {
    if (!value) return '';

    const dt = new Date(value);

    if (isNaN(dt.getTime())) return '';

    const days = ['Κυ', 'Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα'];
    const dayName = days[dt.getUTCDay()];

    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();

    return `${dayName}   ${day}/${month}/${year}`;
}

function renderReviewDateCell(row = {}) {
    const formattedDate = escapeHtml(formatDate(row.hmeromhnia));
    const description = String(row.holiday_description || '').trim();

    if (!description) return `<div>${formattedDate}</div>`;

    let tooltip = '';
    if (row.holiday_is_mandatory === true) {
        tooltip = 'Υποχρεωτική αργία';
    } else if (row.holiday_is_optional === true) {
        tooltip = row.holiday_company_operates === true
            ? 'Μη υποχρεωτική αργία — η εταιρεία λειτουργεί'
            : 'Μη υποχρεωτική αργία — η εταιρεία είναι κλειστή';
    }
    const titleAttribute = tooltip ? ` title="${escapeHtml(tooltip)}"` : '';

    return `<div>${formattedDate}</div><span class="review-holiday-description-badge"${titleAttribute}>${escapeHtml(description)}</span>`;
}

function renderSixthDayCardsBadge(row = {}) {
    if (row.is_sixth_day !== true) return '';

    const rawRate = row.sixth_day_premium_rate;
    const parsedRate =
        rawRate === null || rawRate === undefined || String(rawRate).trim() === ''
            ? null
            : Number(String(rawRate).replace(',', '.'));
    const rateLabel = Number.isFinite(parsedRate)
        ? `${String(parsedRate).replace('.', ',')}%`
        : 'ποσοστό εκκρεμεί';

    return `<span class="badge text-bg-warning d-block mt-1 review-sixth-day-badge">6η ημέρα · ${escapeHtml(rateLabel)}</span>`;
}

function employeeGroupKey(row) {
    // return [row.ypokatasthma || '', row.kodikos || ''].join('|');
    return String(row.kodikos || '').trim();
}

function effectiveWorkHoursValue(row) {
    if (row.ores_ergasias_apologistika !== null && row.ores_ergasias_apologistika !== undefined) {
        return num(row.ores_ergasias_apologistika);
    }

    return num(row.cards_ores_ergasias);
}

// function breakSubtractedHoursValue(row) {
//     const diff = num(row.cards_ores_ergasias) - effectiveWorkHoursValue(row);

//     return diff > 0.004 ? +diff.toFixed(2) : 0;
// }

function breakSubtractedHoursValue(row) {
    return 0;
}

function renderHoursCell(row) {
    const effectiveHours = effectiveWorkHoursValue(row);
    const rawCardHours = num(row.cards_ores_ergasias);
    const breakHours = breakSubtractedHoursValue(row);

    if (breakHours <= 0) {
        return `<div class="fw-semibold">${hours(effectiveHours)}</div>`;
    }

    return `
        <div class="fw-semibold">${hours(effectiveHours)}</div>
        <small class="review-hours-note">
            Κάρτες ${hours(rawCardHours)} − διάλ. ${hours(breakHours)}
        </small>
    `;
}

function ensureReviewTableStructure() {
    const table = document.getElementById('resultsTable');

    if (!table) return;

    table.querySelectorAll('thead tr').forEach((tr) => {
        const headers = Array.from(tr.children);

        if (headers.some((th) => th.dataset.autoColumn === 'apoysies')) return;

        const hoursHeader = headers.find((th) => th.textContent.trim() === 'Ώρες');

        if (!hoursHeader) return;

        const th = document.createElement('th');
        th.dataset.autoColumn = 'apoysies';
        th.textContent = 'Απουσίες';

        hoursHeader.after(th);
    });

    if (!document.getElementById('reviewDynamicCellStyles')) {
        const style = document.createElement('style');
        style.id = 'reviewDynamicCellStyles';
        style.textContent = `
            .cell-apoysia {
                background-color: #dc3545 !important;
                color: #ffffff !important;
                font-weight: 700;
            }

            .cell-break-subtracted {
                background-color: #edf6ff !important;
                color: #12344d !important;
            }

            .cell-repo-day {
                background-color: #fff3cd !important;
                color: #856404 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-repo-day-applied {
                background-color: #198754 !important;
                color: #ffffff !important;
                border: 2px solid #0f5132 !important;
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
                font-weight: 800;
                text-align: center;
            }

            .cell-declared-repo-day {
                background-color: #f1f3f5 !important;
                color: #495057 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-non-work-day {
                background-color: #e9ecef !important;
                color: #495057 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-no-card-adeia {
                background-color: #fff9c4 !important;
                color: #000000 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-no-card-argia {
                background-color: #ffd8a8 !important;
                color: #000000 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-adeia-suggestion {
                background-color: #fdebd0 !important;
                color: #7f3300 !important;
                font-weight: 700;
            }

            .review-warning-badge {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                border-radius: 999px;
                background-color: #fff3cd;
                color: #856404;
                font-weight: 700;
                border: 1px solid #ffe69c;
                margin-left: 0.5rem;
                white-space: nowrap;
            }

            .review-adeia-badge {
                display: inline-block;
                padding: 0.25rem 0.55rem;
                border-radius: 999px;
                background-color: #fdebd0;
                color: #7f3300;
                border: 1px solid #f7c98b;
                font-weight: 700;
                margin-left: 0.4rem;
                white-space: nowrap;
            }

            .review-scenario-badge-row {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
                width: 100%;
                min-width: 0;
                gap: 0.25rem;
                margin-top: 0.25rem;
            }

            .review-scenario-badge {
                display: inline-block;
                box-sizing: border-box;
                max-width: 100%;
                padding: 0.18rem 0.35rem;
                border-radius: 999px;
                font-size: 0.72rem;
                font-weight: 700;
                line-height: 1.2;
                white-space: normal;
                overflow-wrap: break-word;
                word-break: normal;
                text-align: center;
                vertical-align: middle;
            }

            .review-scenario-badge-review {
                background-color: #fff3cd;
                border: 1px solid #ffe69c;
                color: #856404;
            }

            .review-scenario-badge-classified {
                background-color: #e7f1ff;
                border: 1px solid #b6d4fe;
                color: #084298;
            }

            .review-scenario-badge-applied {
                background-color: #ffffff;
                border: 1px solid #ffffff;
                color: #0f5132;
            }

            .review-scenario-confidence {
                display: inline-block;
                padding: 0.08rem 0.35rem;
                border-radius: 999px;
                border: 1px solid #ced4da;
                color: #495057;
                background-color: #f8f9fa;
                font-size: 0.68rem;
                font-weight: 600;
                line-height: 1.25;
                white-space: nowrap;
            }

            .review-scenario-summary,
            .review-scenario-facts {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
                align-items: center;
            }

            .review-scenario-subsection {
                margin-top: 0.75rem;
            }

            .review-scenario-list {
                padding-left: 1.25rem;
            }

            .review-scenario-fact {
                display: inline-block;
                padding: 0.18rem 0.45rem;
                border-radius: 0.25rem;
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                font-size: 0.8rem;
            }

            .review-card-body {
                max-height: calc(100vh - 12rem);
                overflow-y: auto;
            }

            .policy-preview-card .card-body {
                padding: 0.65rem 0.75rem;
            }

            .policy-preview-main-accordion {
                overflow: hidden;
            }

            .policy-preview-main-summary {
                display: grid;
                grid-template-columns: 1rem minmax(13rem, auto) minmax(0, 1fr) auto;
                align-items: center;
                gap: 0.65rem;
                padding: 0.65rem 0.75rem;
                cursor: pointer;
                list-style: none;
                background-color: #f8f9fa;
            }

            .policy-preview-main-summary::-webkit-details-marker {
                display: none;
            }

            .policy-preview-main-summary::before {
                content: '▸';
                font-size: 0.9rem;
                grid-column: 1;
            }

            .policy-preview-main-summary > .fw-semibold {
                grid-column: 2;
            }

            .policy-preview-main-accordion[open] > .policy-preview-main-summary::before {
                content: '▾';
            }

            .policy-preview-main-summary .policy-preview-summary-meta {
                grid-column: 3;
            }

            .policy-preview-main-toggle-label {
                grid-column: 4;
                color: #495057;
                font-size: 0.75rem;
                font-weight: 600;
                white-space: nowrap;
            }

            .policy-preview-main-content {
                border-top: 1px solid #dee2e6;
            }

            .policy-preview-diagnostics-accordion {
                border: 1px solid #dee2e6;
                border-radius: 0.35rem;
                padding: 0.5rem 0.6rem;
                background-color: #f8f9fa;
            }

            .policy-preview-diagnostics-accordion > summary {
                cursor: pointer;
                font-weight: 600;
            }

            .policy-preview-group-card {
                padding: 0.45rem 0.55rem;
                margin-bottom: 0.45rem;
            }

            .policy-preview-group-card.policy-preview-group-highlight {
                border-color: #0d6efd !important;
                background-color: #e7f1ff;
                box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
                transition: background-color 0.25s ease, box-shadow 0.25s ease;
            }

            .policy-preview-group-header {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 0.5rem;
                align-items: start;
            }

            .policy-preview-group-meta,
            .policy-preview-summary-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
                align-items: center;
            }

            .policy-preview-code {
                font-size: 0.72rem;
            }

            .policy-preview-group-items {
                max-height: 240px;
                overflow-y: auto;
                overflow-x: auto;
                position: relative;
            }

            .policy-preview-group-items.d-none {
                display: none !important;
            }

            .policy-preview-items-table {
                min-width: 760px;
                font-size: 0.68rem;
            }

            .policy-preview-items-table th,
            .policy-preview-items-table td {
                padding: 0.2rem 0.3rem;
                white-space: nowrap;
                vertical-align: top;
            }

            .policy-preview-items-table thead th {
                position: sticky;
                top: 0;
                z-index: 3;
                background: #f8f9fa;
                box-shadow: 0 1px 0 #dee2e6;
            }

            .policy-preview-compact-values {
                display: flex;
                flex-wrap: wrap;
                gap: 0.25rem;
                max-width: 24rem;
                white-space: normal;
            }

            .policy-preview-value-chip {
                display: inline-flex;
                gap: 0.2rem;
                align-items: center;
                padding: 0.08rem 0.35rem;
                border: 1px solid #dee2e6;
                border-radius: 0.25rem;
                background-color: #f8f9fa;
                line-height: 1.25;
            }

            .policy-preview-toggle {
                min-width: 5.5rem;
                white-space: nowrap;
                background-color: #ffd8a8;
                border-color: #f08c00;
                color: #111111;
                font-weight: 600;
            }

            .policy-preview-toggle:hover,
            .policy-preview-toggle:focus {
                background-color: #ffa94d;
                border-color: #e67700;
                color: #111111;
            }

            .policy-preview-group-line {
                font-size: 0.78rem;
                line-height: 1.25;
                margin-top: 0.1rem;
            }

            .policy-preview-details-btn {
                padding: 0.12rem 0.4rem;
                font-size: 0.68rem;
                line-height: 1.2;
                background-color: #cff4fc;
                border-color: #0dcaf0;
                color: #055160;
                font-weight: 600;
            }

            .policy-preview-details-btn:hover,
            .policy-preview-details-btn:focus {
                background-color: #0dcaf0;
                border-color: #0aa2c0;
                color: #052c65;
            }

            .policy-preview-history-toggle,
            .policy-preview-dry-run-toggle,
            .policy-preview-history-group-btn {
                background-color: #e2e3e5;
                border-color: #6c757d;
                color: #41464b;
                font-weight: 600;
            }

            .policy-preview-history-toggle:hover,
            .policy-preview-history-toggle:focus,
            .policy-preview-dry-run-toggle:hover,
            .policy-preview-dry-run-toggle:focus,
            .policy-preview-history-group-btn:hover,
            .policy-preview-history-group-btn:focus {
                background-color: #6c757d;
                border-color: #565e64;
                color: #ffffff;
            }

            .policy-preview-approval-panel {
                margin-top: 0.5rem;
                padding: 0.45rem 0.55rem;
                border: 1px solid #dee2e6;
                border-radius: 0.35rem;
                background-color: #f8f9fa;
            }

            .policy-preview-approval-details {
                display: flex;
                flex-wrap: wrap;
                gap: 0.25rem 0.75rem;
                font-size: 0.75rem;
            }

            .policy-preview-decision-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 0.3rem;
                margin-top: 0.4rem;
            }

            .policy-preview-decision-btn {
                font-size: 0.7rem;
                line-height: 1.2;
            }

            .policy-preview-decision-success {
                background-color: #d1e7dd;
                border-color: #198754;
                color: #0f5132;
            }

            .policy-preview-decision-success:not(:disabled):hover,
            .policy-preview-decision-success:not(:disabled):focus {
                background-color: #198754;
                border-color: #198754;
                color: #ffffff;
            }

            .policy-preview-decision-warning {
                background-color: #fff3cd;
                border-color: #ffc107;
                color: #664d03;
            }

            .policy-preview-decision-warning:not(:disabled):hover,
            .policy-preview-decision-warning:not(:disabled):focus {
                background-color: #ffc107;
                border-color: #ffc107;
                color: #212529;
            }

            .policy-preview-decision-danger {
                background-color: #f8d7da;
                border-color: #dc3545;
                color: #842029;
            }

            .policy-preview-decision-danger:not(:disabled):hover,
            .policy-preview-decision-danger:not(:disabled):focus {
                background-color: #dc3545;
                border-color: #dc3545;
                color: #ffffff;
            }

            .policy-preview-decision-primary {
                background-color: #cfe2ff;
                border-color: #0d6efd;
                color: #084298;
            }

            .policy-preview-decision-primary:not(:disabled):hover,
            .policy-preview-decision-primary:not(:disabled):focus {
                background-color: #0d6efd;
                border-color: #0d6efd;
                color: #ffffff;
            }

            .policy-preview-decision-info {
                background-color: #cff4fc;
                border-color: #0dcaf0;
                color: #055160;
            }

            .policy-preview-decision-info:not(:disabled):hover,
            .policy-preview-decision-info:not(:disabled):focus {
                background-color: #0dcaf0;
                border-color: #0dcaf0;
                color: #052c65;
            }

            .policy-preview-decision-btn:disabled {
                opacity: 0.65;
                cursor: not-allowed;
            }

            .policy-preview-history-card {
                margin-top: 0.65rem;
                border: 1px solid #dee2e6;
                border-radius: 0.4rem;
                background-color: #ffffff;
            }

            .policy-preview-history-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                padding: 0.5rem 0.6rem;
                background-color: #f8f9fa;
            }

            .policy-preview-history-summary {
                display: flex;
                flex-wrap: wrap;
                gap: 0.3rem;
                padding: 0 0.6rem 0.5rem;
                background-color: #f8f9fa;
            }

            .policy-preview-history-content {
                padding: 0.55rem 0.6rem 0.65rem;
                border-top: 1px solid #dee2e6;
            }

            .policy-preview-history-filters {
                display: grid;
                grid-template-columns: minmax(10rem, 0.8fr) minmax(10rem, 0.8fr) minmax(14rem, 1.4fr);
                gap: 0.4rem;
                margin-bottom: 0.5rem;
            }

            .policy-preview-history-table-wrapper {
                max-height: 280px;
                overflow: auto;
                position: relative;
            }

            .policy-preview-history-table {
                min-width: 1050px;
                font-size: 0.7rem;
            }

            .policy-preview-history-table th,
            .policy-preview-history-table td {
                padding: 0.25rem 0.35rem;
                vertical-align: top;
            }

            .policy-preview-history-table thead th {
                position: sticky;
                top: 0;
                z-index: 3;
                background-color: #f8f9fa;
                box-shadow: 0 1px 0 #dee2e6;
                white-space: nowrap;
            }

            .policy-preview-history-notes {
                max-width: 18rem;
                white-space: normal;
                overflow-wrap: anywhere;
            }

            .policy-preview-history-details-items {
                overflow-x: auto;
                overflow-y: visible;
            }

            .policy-preview-approval-details-swal {
                max-height: 82vh;
                overflow: hidden;
            }

            .policy-preview-approval-details-swal-body {
                max-height: 62vh;
                overflow-y: auto;
                overflow-x: hidden;
            }

            .policy-preview-dry-run-swal {
                max-height: 85vh;
                overflow: hidden;
            }

            .policy-preview-dry-run-swal-body {
                max-height: 65vh;
                overflow-y: auto;
                overflow-x: hidden;
            }

            .policy-preview-dry-run-items {
                overflow: visible;
            }

            @media (max-width: 991.98px) {
                .policy-preview-main-summary {
                    grid-template-columns: 1rem 1fr auto;
                }

                .policy-preview-main-summary .policy-preview-summary-meta {
                    grid-column: 2 / -1;
                }

                .policy-preview-main-toggle-label {
                    grid-column: 3;
                }

                .policy-preview-history-filters {
                    grid-template-columns: 1fr;
                }
            }

            .review-card-body.review-filters-active .results-table-wrapper {
                max-height: calc(100vh - 430px - 4rem);
            }

            .review-hours-note {
                display: block;
                margin-top: 2px;
                font-size: 0.72rem;
                line-height: 1.1;
                color: inherit;
                white-space: nowrap;
            }

            .review-interval-line {
                line-height: 1.2;
                white-space: nowrap;
            }

            .review-interval-line + .review-interval-line {
                margin-top: 2px;
            }
        `;
        document.head.appendChild(style);
    }
}

function createEmptyTotals() {
    return {
        ores_ergasias_apologistika: 0,
        ores_apoysias_apologistika: 0,
        ores_nyxtas_apologistika: 0,
        ores_argion_prosayxhsh_apologistika: 0,
        ores_argion_ergasia_apologistika: 0,
        ores_prostheths_ergasias_apologistika: 0,
        yperergasia: 0,
        nomimiYperoria: 0,
        paranomiYperoria: 0
    };
}

function sumYperergasia(row) {
    return (
        num(row.ores_yperergasias_apologistika) +
        num(row.ores_yperergasias_nyxtas_apologistika) +
        num(row.ores_yperergasias_argion_apologistika) +
        num(row.ores_yperergasias_argion_nyxtas_apologistika)
    );
}

function sumNomimiYperoria(row) {
    return (
        num(row.ores_nominhs_yperorias_apologistika) +
        num(row.ores_nominhs_yperorias_nyxtas_apologistika) +
        num(row.ores_nominhs_yperorias_argion_apologistika) +
        num(row.ores_nominhs_yperorias_argion_nyxtas_apologistika)
    );
}

function sumParanomiYperoria(row) {
    return (
        num(row.ores_paranomhs_yperorias_apologistika) +
        num(row.ores_paranomhs_yperorias_nyxtas_apologistika) +
        num(row.ores_paranomhs_yperorias_argion_apologistika) +
        num(row.ores_paranomhs_yperorias_argion_nyxtas_apologistika)
    );
}

function addRowToTotals(totals, row) {
    totals.ores_ergasias_apologistika += effectiveWorkHoursValue(row);
    totals.ores_apoysias_apologistika += num(row.ores_apoysias_apologistika);
    totals.ores_nyxtas_apologistika += num(row.ores_nyxtas_apologistika);
    totals.ores_argion_prosayxhsh_apologistika += num(row.ores_argion_prosayxhsh_apologistika);
    totals.ores_argion_ergasia_apologistika += num(row.ores_argion_ergasia_apologistika);
    totals.ores_prostheths_ergasias_apologistika += num(row.ores_prostheths_ergasias_apologistika);
    totals.yperergasia += sumYperergasia(row);
    totals.nomimiYperoria += sumNomimiYperoria(row);
    totals.paranomiYperoria += sumParanomiYperoria(row);
}

function appendEmployeeTotalsRow(tbody, totals, groupId) {
    const tr = document.createElement('tr');
    tr.classList.add('employee-subtotal-row');
    tr.classList.add('d-none');
    tr.dataset.groupId = groupId;

    tr.innerHTML = `
        <td colspan="6" class="fw-bold text-end">
            Σύνολα εργαζομένου
        </td>
        <td class="fw-bold">${hours(totals.ores_ergasias_apologistika)}</td>
        <td class="fw-bold ${hasPositiveNumber(totals.ores_apoysias_apologistika) ? 'cell-apoysia cell-apoysia-total' : 'cell-apoysia-total'}">
            ${hours(totals.ores_apoysias_apologistika)}
        </td>        
        <td class="fw-bold">${hours(totals.ores_nyxtas_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_argion_prosayxhsh_apologistika + totals.ores_argion_ergasia_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_prostheths_ergasias_apologistika)}</td>
        <td class="fw-bold">${hours(totals.yperergasia)}</td>
        <td class="fw-bold">${hours(totals.nomimiYperoria + totals.paranomiYperoria)}</td>
    `;

    tbody.appendChild(tr);
}

function buildDeviationsByKodikos(deviations = []) {
    const map = new Map();

    deviations.forEach((dev) => {
        const kodikos = String(dev.kodikos || '').trim();
        if (!kodikos) return;
        if (!map.has(kodikos)) map.set(kodikos, []);
        map.get(kodikos).push(dev);
    });

    return map;
}

function employmentTypeLabel(value) {
    const v = String(value ?? '').trim();

    switch (v) {
        case '0':
            return 'Πλήρης';
        case '1':
            return 'Μερική';
        case '2':
            return 'Εκ Περιτροπής';
        default:
            return v || '-';
    }
}

function renderDeviationProfileCell(dev) {
    const effectiveRepo =
        dev.effective_expected_repo ??
        dev.expected_repo ??
        '';
    const weeklyWorkdays = Number(dev.effective_weekly_workdays || 0);
    const effectiveType = employmentTypeLabel(dev.effective_typos_apasxolhshs);
    const effectiveDate = dev.effective_profile_date ? formatDate(dev.effective_profile_date) : '';
    const hasReadableEmploymentType =
        effectiveType && effectiveType !== '-' && !/^\d+$/.test(String(effectiveType));

    if (!dev.profile_changed_inside_week) {
        return `
            ${hasReadableEmploymentType ? `<div>${escapeHtml(effectiveType)}</div>` : ''}
            ${weeklyWorkdays ? `<small class="text-muted d-block">Συμβατικές ημέρες εργασίας: ${escapeHtml(weeklyWorkdays)}</small>` : ''}
            <small class="text-muted">Αναμενόμενες ημέρες μη εργασίας: ${escapeHtml(effectiveRepo)}</small>
        `;
    }

    return `
        <div class="fw-bold text-warning-emphasis">Τελικό προφίλ εβδομάδας</div>
        ${hasReadableEmploymentType ? `<div>${escapeHtml(effectiveType)}</div>` : ''}
        ${weeklyWorkdays ? `<div>${escapeHtml(weeklyWorkdays)} συμβατικές ημέρες εργασίας</div>` : ''}
        <div>${escapeHtml(effectiveRepo)} αναμενόμενες ημέρες μη εργασίας</div>
        ${
            effectiveDate
                ? `<small class="text-muted">Ισχύει από: ${escapeHtml(effectiveDate)}</small>`
                : ''
        }
    `;
}

function renderDeviationNoteCell(dev) {
    if (dev.status === 'OPEN_WEEK_PENDING_COMPLETION') {
        return `
            <span class="badge text-bg-info">Αναμονή ολοκλήρωσης</span>
            <div class="small mt-1">
                Η εβδομάδα ${escapeHtml(formatDate(dev.week_apo || dev.weekStart))}–${escapeHtml(formatDate(dev.week_eos || dev.weekEnd))}
                δεν έχει ακόμη ολοκληρωθεί και θα επανελεγχθεί μετά την Κυριακή.
            </div>
        `;
    }

    if (dev.is_legacy_policy === true) {
        return `
            <span class="badge text-bg-secondary">Ιστορική εγγραφή παλιάς πολιτικής</span>
            ${dev.note ? `<div class="small mt-1">${escapeHtml(dev.note)}</div>` : ''}
        `;
    }

    if (dev.profile_changed_inside_week) {
        const excessRepo =
            Number(dev.actual_repo ?? dev.pragmatikaRepo ?? 0) -
            Number(dev.expected_repo ?? 0);
        const excessText =
            excessRepo > 0
                ? `<div>Πλεονάζοντα ρεπό: <strong>${escapeHtml(excessRepo)}</strong></div>`
                : '';

        return `
            <div class="fw-bold text-warning-emphasis">
                ⚠ Αλλαγή όρων εργασίας μέσα στην εβδομάδα
            </div>
            <small class="text-muted">
                Η εβδομάδα απαιτεί απόφαση HR επειδή άλλαξαν κρίσιμοι όροι εργασίας.
            </small>
            ${excessText}
            ${dev.note ? `<div class="small mt-1">${escapeHtml(dev.note)}</div>` : ''}
        `;
    }

    const sixthDayText = dev.sixth_day_date
        ? `<div><strong>6η ημέρα:</strong> ${escapeHtml(formatDate(dev.sixth_day_date))}</div>`
        : '';
    const seventhDayText = dev.seventh_day_date
        ? `<div class="text-danger"><strong>7η ημέρα:</strong> ${escapeHtml(
              formatDate(dev.seventh_day_date)
          )}</div>`
        : '';
    const sixthDayReasonLabels = {
        MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE:
            'Λείπει ή δεν είναι έγκυρο το ποσοστό προσαύξησης 6ης ημέρας.',
        ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION:
            'Το ποσοστό προσαύξησης 6ης ημέρας είναι μηδενικό χωρίς έγκυρη εξαίρεση.',
        SIXTH_DAY_CANDIDATE_NOT_DETERMINISTIC:
            'Δεν μπορεί να επιλεγεί με ασφάλεια η ημερομηνία της 6ης ημέρας.'
    };
    const sixthDayDecisionText = Array.isArray(dev.sixth_seventh_day_reasons)
        ? dev.sixth_seventh_day_reasons
              .map((reason) => sixthDayReasonLabels[reason] || reason)
              .filter(Boolean)
              .map(
                  (reason) =>
                      `<div class="small text-warning-emphasis">${escapeHtml(reason)}</div>`
              )
              .join('')
        : '';
    const noteText = dev.note ? `<div>${escapeHtml(dev.note)}</div>` : '';

    return sixthDayText || seventhDayText || sixthDayDecisionText || noteText
        ? `${sixthDayText}${seventhDayText}${sixthDayDecisionText}${noteText}`
        : '-';
}

function hasProfileChangeDeviation(deviations = []) {
    return (
        Array.isArray(deviations) &&
        deviations.some((dev) => dev.profile_changed_inside_week === true)
    );
}

function hasAdeiaSuggestion(row) {
    return hasMeaningfulValue(row?.kathgoria_adeias_apologistika);
}

function hasAdeiaSuggestionInRows(rows = []) {
    return Array.isArray(rows) && rows.some((row) => hasAdeiaSuggestion(row));
}

function appendEmployeeDeviationRows(tbody, deviations, groupId) {
    if (!Array.isArray(deviations) || deviations.length === 0) return;

    const wrapperTr = document.createElement('tr');
    wrapperTr.classList.add('employee-deviation-row');
    wrapperTr.classList.add('d-none');
    wrapperTr.dataset.groupId = groupId;

    const rowsHtml = deviations
        .map(
            (dev) => `
                <tr
                    class="${
                        dev.is_legacy_policy === true
                            ? 'table-secondary'
                            : dev.status === 'OPEN_WEEK_PENDING_COMPLETION'
                              ? 'table-info'
                              : dev.profile_changed_inside_week
                                ? 'table-warning'
                                : ''
                    }"
                    data-week-policy="${dev.is_legacy_policy === true ? 'LEGACY' : 'MONDAY_SUNDAY'}"
                >
                    <td>${formatDate(dev.week_apo || dev.weekStart)}</td>
                    <td>${formatDate(dev.week_eos || dev.weekEnd)}</td>
                    <td class="text-end">${escapeHtml(dev.expected_repo ?? '-')}</td>
                    <td class="text-end fw-bold">${escapeHtml(dev.actual_repo ?? dev.pragmatikaRepo ?? '-')}</td>
                    <td class="text-end">${escapeHtml(dev.resolved_repo ?? dev.actual_repo ?? '-')}</td>
                    <td class="text-end">${escapeHtml(dev.actual_workdays ?? '-')}</td>
                    <td class="text-end">${escapeHtml(dev.sixth_day_count ?? 0)}</td>
                    <td class="text-end">${escapeHtml(dev.seventh_day_count ?? 0)}</td>
                    <td>${dev.status === 'OPEN_WEEK_PENDING_COMPLETION' || dev.is_legacy_policy === true ? '-' : renderDeviationProfileCell(dev)}</td>
                    <td>${renderDeviationNoteCell(dev)}${
                        dev.repo_transfer_status === 'NEEDS_REVIEW' &&
                        Array.isArray(dev.repo_transfer_reasons) && dev.repo_transfer_reasons.length
                            ? `<div class="small text-muted mt-1">${escapeHtml(dev.repo_transfer_reasons.join(', '))}</div>`
                            : ''
                    }${dev.status === 'NEEDS_HR_DECISION'
                        ? `<div class="mt-2"><button type="button" class="btn btn-sm btn-outline-primary canonical-decision-open"
                            data-employee-kodikos="${escapeHtml(dev.kodikos || '')}"
                            data-ypokatasthma="${escapeHtml(dev.ypokatasthma || '')}"
                            data-week-start="${escapeHtml(String(dev.week_apo || dev.weekStart || '').slice(0, 10))}">Καταγραφή απόφασης</button></div>`
                        : ''}</td>
                </tr>
            `
        )
        .join('');

    wrapperTr.innerHTML = `
        <td colspan="13" class="p-2 bg-warning-subtle">
            <div class="fw-bold mb-1">
                Αποκλίσεις εβδομαδιαίων ρεπό
                <span class="badge text-bg-light border ms-1">Εβδομάδα Δευτέρα–Κυριακή</span>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered mb-0 bg-white">
                    <thead class="table-light">
                        <tr>
                            <th>Από</th>
                            <th>Έως</th>
                            <th class="text-end">Αναμενόμενα ρεπό</th>
                            <th class="text-end">Πραγματικά ρεπό</th>
                            <th class="text-end">Προτεινόμενα/επιλυμένα ρεπό</th>
                            <th class="text-end">Πραγματικές ημέρες εργασίας</th>
                            <th class="text-end">6η ημέρα</th>
                            <th class="text-end">7η ημέρα/παράβαση</th>
                            <th>Profile</th>
                            <th>Σχόλιο</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </td>
    `;

    tbody.appendChild(wrapperTr);
    wrapperTr.querySelectorAll('.canonical-decision-open').forEach((button) => {
        button.addEventListener('click', () => openCanonicalDecisionPanel(button.dataset));
    });
}

const canonicalApplicabilityLabels = {
    APPLICABLE: 'Ενεργή απόφαση',
    STALE: 'Η απόφαση χρειάζεται επανέλεγχο επειδή άλλαξαν τα δεδομένα',
    CONFLICT: 'Υπάρχουν αντικρουόμενες αποφάσεις — απαιτείται έλεγχος',
    NOT_FOUND: 'Δεν υπάρχει ενεργή απόφαση'
};

const canonicalStatusLabels = {
    NEEDS_HR_DECISION: 'Απαιτείται απόφαση',
    READY: 'Ολοκληρωμένο',
    NOT_APPLICABLE: 'Δεν εφαρμόζεται'
};

const canonicalReasonLabels = {
    PROFILE_CHANGED_INSIDE_WEEK: 'Αλλαγή όρων εργασίας μέσα στην εβδομάδα',
    CARD_VERIFICATION_PENDING: 'Εκκρεμεί επιβεβαίωση στοιχείων κάρτας',
    CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC:
        'Δεν μπορούν να προσδιοριστούν με βεβαιότητα οι δύο ημέρες ανάπαυσης/ρεπό της εβδομάδας',
    CANONICAL_DECISION_STALE:
        'Η προηγούμενη απόφαση χρειάζεται επανέλεγχο επειδή άλλαξαν τα δεδομένα',
    CANONICAL_DECISION_CONFLICT: 'Υπάρχουν αντικρουόμενες αποφάσεις',
    CANONICAL_DECISION_OUTCOME_NOT_CONSUMABLE:
        'Η συγκεκριμένη απόφαση δεν μπορεί να εφαρμοστεί στον υπολογισμό',
    CANONICAL_DECISION_PROFILE_REFERENCE_INVALID:
        'Το επιλεγμένο προφίλ εργασίας δεν είναι πλέον έγκυρο',
    CANONICAL_DECISION_APPLIED_TRANSFER_CONFLICT:
        'Η απόφαση συγκρούεται με ήδη εφαρμοσμένη μεταφορά ρεπό',
    CANONICAL_DECISION_CLASSIFICATION_INVALID:
        'Η επιλεγμένη ταξινόμηση ημερών δεν είναι συμβατή με την εβδομάδα',
    CANONICAL_DECISION_REPO_IDENTITIES_INVALID:
        'Οι επιλεγμένες ημέρες ανάπαυσης/ρεπό δεν είναι συμβατές με την εβδομάδα',
    INVALID_OR_INCOMPLETE_MONDAY_SUNDAY_WEEK:
        'Η εβδομάδα δεν περιέχει πλήρη στοιχεία από Δευτέρα έως Κυριακή',
    FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION:
        'Υπάρχει εργασία με κάρτα σε ημέρα πλήρους άδειας',
    SIXTH_DAY_CANDIDATE_NOT_DETERMINISTIC:
        'Δεν μπορεί να προσδιοριστεί με βεβαιότητα η 6η ημέρα',
    MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE:
        'Λείπει ή δεν είναι έγκυρο το ποσοστό προσαύξησης 6ης ημέρας',
    ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION:
        'Το ποσοστό προσαύξησης 6ης ημέρας είναι μηδενικό χωρίς καταχωρημένη εξαίρεση',
    CATEGORY_REPO_CONFLICT:
        'Η κατηγορία ημέρας δεν συμφωνεί με την ένδειξη ημέρας ανάπαυσης/ρεπό',
    INVALID_DECLARED_HOURS: 'Οι δηλωμένες ώρες δεν είναι έγκυρες',
    INVALID_CARD_HOURS: 'Οι ώρες κάρτας δεν είναι έγκυρες',
    INVALID_EXPLICIT_HOURLY_LEAVE_HOURS: 'Οι ώρες ωριαίας άδειας δεν είναι έγκυρες',
    EXPLICIT_HOURLY_LEAVE_EXCEEDS_DECLARED_BALANCE:
        'Οι ώρες ωριαίας άδειας υπερβαίνουν το διαθέσιμο δηλωμένο υπόλοιπο',
    UNSUPPORTED_DAILY_CATEGORY: 'Η κατηγορία ημέρας δεν υποστηρίζεται για αυτόματο υπολογισμό'
};

const canonicalDecisionTypeLabels = {
    PROFILE_CHANGED_INSIDE_WEEK: 'Επιλογή προφίλ εργασίας',
    CARD_VERIFICATION_PENDING: 'Τεκμηρίωση στοιχείων κάρτας',
    CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC: 'Επιλογή ημερών ανάπαυσης/ρεπό',
    CLASSIFICATION_BY_DATE: 'Ταξινόμηση ημερών'
};

const canonicalProfileSourceLabels = {
    CURRENT_EMPLOYEE: 'Τρέχον προφίλ εργαζομένου',
    ERG_AKTUAL: 'Τρέχον προφίλ εργαζομένου',
    ISTORIKO: 'Ιστορικό προφίλ εργασίας'
};

const canonicalActorRoleLabels = {
    A: 'Διαχειριστής',
    S: 'Επόπτης',
    HR: 'Υπεύθυνος Ανθρώπινου Δυναμικού'
};

function canonicalStatusLabel(value) {
    return canonicalStatusLabels[String(value || '').trim()] || 'Απαιτείται έλεγχος';
}

function canonicalReasonLabel(value) {
    return canonicalReasonLabels[String(value || '').trim()] || 'Απαιτείται πρόσθετος έλεγχος';
}

function canonicalDecisionTypeLabel(value) {
    return canonicalDecisionTypeLabels[String(value || '').trim()] || 'Απόφαση εβδομαδιαίου ελέγχου';
}

function canonicalDecisionRequestId() {
    if (window.crypto?.randomUUID) return `canonical:${window.crypto.randomUUID()}`;
    return `canonical:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function canonicalDecisionParams(scope) {
    return new URLSearchParams({
        employee_kodikos: scope.employeeKodikos || scope.employee_kodikos || '',
        ypokatasthma: scope.ypokatasthma || '',
        week_start: scope.weekStart || scope.week_start || ''
    });
}

function renderCanonicalDecisionHistory(records = []) {
    if (!records.length) return '<div class="text-muted small">Δεν υπάρχει ιστορικό αποφάσεων.</div>';
    return `<div class="table-responsive"><table class="table table-sm table-bordered">
        <thead><tr><th>Ημερομηνία</th><th>Χρήστης</th><th>Ρόλος</th><th>Τύπος</th><th>Κατάσταση</th><th>Σημειώσεις</th></tr></thead>
        <tbody>${records.map((record) => `<tr>
            <td>${escapeHtml(record.created_at ? new Date(record.created_at).toLocaleString('el-GR') : '-')}</td>
            <td>${escapeHtml(record.actor?.name || '-')}</td><td>${escapeHtml(canonicalActorRoleLabels[record.actor?.role] || 'Εξουσιοδοτημένος χρήστης')}</td>
            <td>${escapeHtml(canonicalDecisionTypeLabel(record.decision_type))}</td>
            <td>${escapeHtml(canonicalApplicabilityLabels[record.applicability] || 'Απαιτείται έλεγχος')}</td>
            <td>${escapeHtml(record.notes || '-')}</td></tr>`).join('')}</tbody></table></div>`;
}

function canonicalDecisionActionOptions(context) {
    const actions = context.supported_actions || {};
    const options = [];
    if (actions.profile) options.push(['PROFILE_CHANGED_INSIDE_WEEK', 'Επιλογή προφίλ εργασίας']);
    if (actions.card_documentary) options.push(['CARD_VERIFICATION_PENDING', 'Καταγραφή τεκμηρίου κάρτας (δεν επιλύει ώρες)']);
    if (actions.repo_identities) options.push(['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', 'Επιλογή δύο ημερών ανάπαυσης/ρεπό']);
    if (actions.classification_by_date) options.push(['CLASSIFICATION_BY_DATE', 'Ταξινόμηση ημερών']);
    return options;
}

function renderCanonicalDecisionEditor(context) {
    if (!userCanRecordCanonicalDecision()) {
        return '<div class="alert alert-secondary mb-0">Έχετε πρόσβαση προβολής. Η καταγραφή απόφασης απαιτεί δικαιώματα Διαχειριστή, Επόπτη ή Υπεύθυνου Ανθρώπινου Δυναμικού.</div>';
    }
    if (!context.index_readiness?.ready) {
        return '<div class="alert alert-secondary mb-0">Η καταγραφή αποφάσεων δεν είναι προσωρινά διαθέσιμη.</div>';
    }
    const options = canonicalDecisionActionOptions(context);
    if (!options.length) return '<div class="alert alert-warning mb-0">Δεν υπάρχει ασφαλής διαθέσιμη ενέργεια για τις τρέχουσες αιτίες.</div>';
    const profiles = (context.profile_candidates || []).map((candidate, index) =>
        `<option value="${index}">${escapeHtml(canonicalProfileSourceLabels[candidate.source] || 'Προφίλ εργασίας')}${candidate.effective_date ? ` · ${escapeHtml(formatDate(candidate.effective_date))}` : ''}</option>`).join('');
    const repoDates = (context.current_repo_candidate_dates || []).map((date) =>
        `<label class="form-check form-check-inline"><input class="form-check-input canonical-repo-date" type="checkbox" value="${escapeHtml(date)}"><span class="form-check-label">${escapeHtml(formatDate(date))}</span></label>`).join('');
    const classifications = (context.week_rows || []).map((row) =>
        `<div class="input-group input-group-sm mb-1"><span class="input-group-text">${escapeHtml(formatDate(row.date))}</span>
        <select class="form-select canonical-classification" data-date="${escapeHtml(row.date)}">
        <option value="NORMAL">Κανονική ημέρα</option><option value="SIXTH">6η ημέρα</option><option value="SEVENTH">7η ημέρα</option></select></div>`).join('');
    return `<form id="canonicalDecisionForm">
        <label class="form-label">Τύπος απόφασης</label>
        <select class="form-select form-select-sm mb-3" id="canonicalDecisionType">${options.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('')}</select>
        <div class="canonical-decision-input" data-type="PROFILE_CHANGED_INSIDE_WEEK"><label class="form-label">Επιλογή προφίλ εργασίας</label><select class="form-select form-select-sm" id="canonicalProfileCandidate">${profiles}</select></div>
        <div class="canonical-decision-input d-none" data-type="CARD_VERIFICATION_PENDING"><div class="alert alert-warning py-2">Η απόφαση είναι μόνο τεκμηριωτική. Η διόρθωση των στοιχείων κάρτας απαιτείται πριν επιλυθεί ο υπολογισμός.</div><label class="form-label">Αναφορά τεκμηρίου/διόρθωσης</label><input class="form-control form-control-sm" id="canonicalCardEvidence" maxlength="500"></div>
        <div class="canonical-decision-input d-none" data-type="CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC"><div class="mb-2">Επιλέξτε ακριβώς δύο έγκυρες ημέρες ανάπαυσης/ρεπό:</div>${repoDates || '<span class="text-muted">Δεν υπάρχουν διαθέσιμες ημέρες ανάπαυσης/ρεπό.</span>'}</div>
        <div class="canonical-decision-input d-none" data-type="CLASSIFICATION_BY_DATE"><div class="small text-muted mb-2">Η επιλογή θα ελεγχθεί από το σύστημα ώστε η εβδομαδιαία ταξινόμηση να είναι πλήρης και συνεπής.</div>${classifications}</div>
        <label class="form-label mt-3">Σημειώσεις</label><textarea class="form-control form-control-sm" id="canonicalDecisionNotes" maxlength="2000"></textarea>
        <button class="btn btn-primary btn-sm mt-3" type="submit">Καταγραφή απόφασης</button>
        <div id="canonicalDecisionFeedback" class="small mt-2"></div>
    </form>`;
}

function canonicalDecisionPayload(context, type) {
    if (type === 'PROFILE_CHANGED_INSIDE_WEEK') {
        const candidate = context.profile_candidates?.[Number(document.getElementById('canonicalProfileCandidate')?.value)];
        if (!candidate) throw new Error('Δεν επιλέχθηκε έγκυρο προφίλ εργασίας.');
        return { profile_outcome: 'USE_PROFILE',
            profile_reference: { effective_date: candidate.effective_date, source: candidate.source },
            selected_profile_reference: candidate.reference,
            selected_profile_fingerprint: candidate.selected_profile_fingerprint };
    }
    if (type === 'CARD_VERIFICATION_PENDING') {
        const evidence = document.getElementById('canonicalCardEvidence')?.value.trim();
        if (!evidence) throw new Error('Απαιτείται αναφορά τεκμηρίου.');
        return { verified: true, evidence_reference: evidence, corrected_row_ids: [] };
    }
    if (type === 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC') {
        const dates = [...document.querySelectorAll('.canonical-repo-date:checked')].map((item) => item.value);
        if (dates.length !== 2) throw new Error('Επιλέξτε ακριβώς δύο ημερομηνίες.');
        return { current_repo_identities: dates };
    }
    const map = {};
    document.querySelectorAll('.canonical-classification').forEach((select) => { map[select.dataset.date] = select.value; });
    return { classification_by_date: map };
}

async function openCanonicalDecisionPanel(scope) {
    const modalElement = document.getElementById('canonicalDecisionModal');
    const container = document.getElementById('canonicalDecisionContainer');
    if (!modalElement || !container) return;
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
    container.innerHTML = '<div class="text-muted">Φόρτωση τρέχουσας κατάστασης…</div>';
    try {
        const params = canonicalDecisionParams(scope);
        const [currentResponse, historyResponse] = await Promise.all([
            fetch(`/api/prodhlomena-oraria/review/canonical-decisions/current?${params}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } }),
            fetch(`/api/prodhlomena-oraria/review/canonical-decisions?${params}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        ]);
        const current = await currentResponse.json();
        const history = await historyResponse.json();
        if (!currentResponse.ok || !current.success) throw new Error(current.message || 'Αποτυχία φόρτωσης.');
        container.innerHTML = `<div class="row g-3"><div class="col-lg-6">
            <div><strong>${escapeHtml(current.employee?.kodikos || '')} ${escapeHtml(current.employee?.eponymo || '')} ${escapeHtml(current.employee?.onoma || '')}</strong></div>
            <div>Εβδομάδα: ${escapeHtml(formatDate(current.scope.week_start))}–${escapeHtml(formatDate(current.scope.week_end))}</div>
            <div class="mt-2"><span class="badge text-bg-warning">${escapeHtml(canonicalStatusLabel(current.canonical.status))}</span></div>
            <div class="small mt-2">${(current.canonical.reasons || []).map((reason) => `<div>${escapeHtml(canonicalReasonLabel(reason))}</div>`).join('')}</div>
            <div class="alert alert-light border mt-3">${escapeHtml(canonicalApplicabilityLabels[current.applicability] || 'Απαιτείται έλεγχος')}</div>
        </div><div class="col-lg-6">${renderCanonicalDecisionEditor(current)}</div></div>
        <hr><h6>Ιστορικό αποφάσεων</h6><div class="small text-muted mb-2">Οι καταχωρημένες αποφάσεις διατηρούνται στο ιστορικό.</div>${renderCanonicalDecisionHistory(history.records || [])}`;
        const typeSelect = document.getElementById('canonicalDecisionType');
        const showType = () => document.querySelectorAll('.canonical-decision-input').forEach((node) => node.classList.toggle('d-none', node.dataset.type !== typeSelect?.value));
        typeSelect?.addEventListener('change', showType); showType();
        document.getElementById('canonicalDecisionForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const feedback = document.getElementById('canonicalDecisionFeedback');
            try {
                const type = typeSelect.value;
                const response = await fetch('/api/prodhlomena-oraria/review/canonical-decisions', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
                        'CSRF-Token': csrfToken, 'x-csrf-token': csrfToken },
                    body: JSON.stringify({ ypokatasthma: current.scope.ypokatasthma,
                        employee_kodikos: current.scope.employee_kodikos,
                        week_start: current.scope.week_start,
                        request_id: canonicalDecisionRequestId(), decision_type: type,
                        decision_payload: canonicalDecisionPayload(current, type),
                        notes: document.getElementById('canonicalDecisionNotes')?.value || '' })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || 'Η καταγραφή απέτυχε.');
                feedback.className = 'small mt-2 text-success';
                feedback.textContent = `${result.message} Η επανεκτέλεση υπολογισμού γίνεται από το υπάρχον κουμπί.`;
                setTimeout(() => openCanonicalDecisionPanel(current.scope), 500);
            } catch (error) {
                feedback.className = 'small mt-2 text-danger'; feedback.textContent = error.message;
            }
        });
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
    }
}

function appendGrandTotalsRow(tbody, totals) {
    const tr = document.createElement('tr');
    tr.classList.add('grand-total-row');

    tr.innerHTML = `
        <td colspan="6" class="fw-bold text-end">
            Γενικά σύνολα φίλτρου
        </td>
        <td class="fw-bold">${hours(totals.ores_ergasias_apologistika)}</td>
        <td class="fw-bold ${hasPositiveNumber(totals.ores_apoysias_apologistika) ? 'cell-apoysia' : ''}">${hours(totals.ores_apoysias_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_nyxtas_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_argion_prosayxhsh_apologistika + totals.ores_argion_ergasia_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_prostheths_ergasias_apologistika)}</td>
        <td class="fw-bold">${hours(totals.yperergasia)}</td>
        <td class="fw-bold">${hours(totals.nomimiYperoria + totals.paranomiYperoria)}</td>
    `;

    tbody.appendChild(tr);
}

function buildScenarioReviewParams(baseParams, page) {
    const params = new URLSearchParams({
        apo_hmeromhnia: baseParams.get('apo_hmeromhnia') || '',
        eos_hmeromhnia: baseParams.get('eos_hmeromhnia') || '',
        ypokatasthma: baseParams.get('ypokatasthma') || '',
        kodikos: baseParams.get('kodikos') || '',
        page: String(page),
        limit: '200'
    });

    return params;
}

async function fetchScenarioClassifications(baseParams) {
    const scenarioRows = [];
    const maxPages = 50;
    let totalPages = 1;

    for (let page = 1; page <= totalPages && page <= maxPages; page += 1) {
        const params = buildScenarioReviewParams(baseParams, page);
        const response = await fetch(`/api/prodhlomena-oraria/review/scenarios?${params.toString()}`, {
            method: 'GET',
            headers: {
                'CSRF-Token': csrfToken
            }
        });

        const payload = await response.json();

        if (!payload.success) {
            throw new Error(payload.message || 'Αποτυχία ανάκτησης scenario classifications.');
        }

        scenarioRows.push(...(payload.rows || []));

        const payloadTotalPages = Number(payload.totalPages || 0);
        const payloadTotal = Number(payload.total || 0);
        const payloadLimit = Number(payload.limit || 200);

        totalPages =
            payloadTotalPages > 0
                ? payloadTotalPages
                : payloadTotal > 0
                  ? Math.ceil(payloadTotal / payloadLimit)
                  : page;

        if ((payload.rows || []).length === 0) break;
    }

    return scenarioRows;
}

function buildScenarioClassificationsMap(scenarioRows = []) {
    const scenarioByProdhlomenaId = new Map();

    scenarioRows.forEach((scenarioRow) => {
        const key = rowIdentityKey(scenarioRow.prodhlomena_oraria_id);

        if (!key) return;

        scenarioByProdhlomenaId.set(key, scenarioRow);
    });

    return scenarioByProdhlomenaId;
}

function attachScenarioClassifications(rows = [], scenarioByProdhlomenaId = new Map()) {
    rows.forEach((row) => {
        const scenarioRow = scenarioByProdhlomenaId.get(rowIdentityKey(row._id));

        if (!scenarioRow) return;

        row.scenarioDecision = scenarioRow.decision || null;
        row.scenarioFactsSummary = scenarioRow.facts_summary || null;
    });
}

function isAutoCalculatedLeavePresentation(row = {}) {
    const provenance = String(row.leave_provenance || '').trim();
    if (provenance === 'POSSIBLE_LEAVE') return true;
    if (provenance === 'AUTO_CALCULATED_LEAVE') return true;
    if (provenance === 'HR_DECLARED_LEAVE') return false;
    if (row.is_auto_calculated_leave === true) return true;

    const declaredCategory = String(
        row.kathgoria_ergasias_original ?? row.kathgoria_ergasias ?? ''
    ).trim();
    const apologistikoCategory = String(
        row.kathgoria_ergasias_apologistika || ''
    ).trim();

    return (
        declaredCategory === 'ΕΡΓ' &&
        num(row.ores_ergasias) > 0 &&
        num(row.cards_ores_ergasias) === 0 &&
        row.adeia_apologistika === true &&
        String(row.kathgoria_adeias_apologistika || '').trim() === 'ΑΔΑΛ' &&
        (apologistikoCategory === '' || apologistikoCategory === 'ΑΔΕΙΑ') &&
        row.adeia !== true &&
        !hasMeaningfulValue(row.kathgoria_adeias) &&
        num(row.ores_apoysias) === 0
    );
}

function resolveReviewIsFullTimePresentation(row = {}) {
    if (
        row.effective_is_full_time === true ||
        row.effective_is_full_time === 'true' ||
        row.effective_is_full_time === 1 ||
        row.effective_is_full_time === '1'
    ) {
        return true;
    }
    if (
        row.effective_is_full_time === false ||
        row.effective_is_full_time === 'false' ||
        row.effective_is_full_time === 0 ||
        row.effective_is_full_time === '0'
    ) {
        return false;
    }

    const employmentType = [
        row.effective_kathestos_apasxolhshs,
        row.effective_typos_apasxolhshs,
        row.kathestos_apasxolhshs,
        row.typos_apasxolhshs
    ]
        .map((value) => String(value ?? '').trim())
        .find(Boolean) || '';
    if (employmentType === '0') return true;
    if (employmentType === '1' || employmentType === '2') return false;

    const reviewPhaseCode = String(
        row.review_phase_code ?? row.review_kathestos_code ?? ''
    ).trim();
    if (reviewPhaseCode === '1' || reviewPhaseCode === '2') return false;
    return true;
}

function resolveReviewApologistikoPresentation(row = {}, derived = {}) {
    const persistedCategory = String(
        row.kathgoria_ergasias_apologistika || ''
    ).trim();
    const hasActualCards =
        num(row.cards_ores_ergasias) > 0 || hasValidCardInterval(row);
    const hasDeclaredWork =
        num(row.ores_ergasias) > 0 ||
        [1, 2, 3].some((n) => {
            const p = pairNo(n);
            return (
                hasMeaningfulValue(row[`apo_ora_${p}`]) ||
                hasMeaningfulValue(row[`eos_ora_${p}`])
            );
        });
    const invalidPersistedNonWork =
        persistedCategory === 'ΜΕ' &&
        hasDeclaredWork &&
        hasActualCards;

    if (invalidPersistedNonWork) {
        return {
            text: derived.apologistikoText || '',
            className: isApologistikoIntervalPresent(row)
                ? 'cell-apologistiko'
                : '',
            source: 'derived'
        };
    }

    const persistedRepo =
        row.repo_apologistika === true ||
        (persistedCategory === 'ΑΝ' && derived.isApologistikoRepoRow === true);

    if (persistedRepo) {
        return {
            text: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ',
            className: 'cell-repo-day',
            source: 'persisted'
        };
    }

    if (persistedCategory === 'ΜΕ' || derived.isApologistikoNonWorkRow) {
        return {
            text: 'ΜΗ ΕΡΓΑΣΙΑ',
            className: 'cell-non-work-day',
            source: 'persisted'
        };
    }

    if (isAutoCalculatedLeavePresentation(row)) {
        return {
            text: 'ΠΙΘΑΝΗ ΑΔΕΙΑ',
            className: 'cell-adeia-suggestion',
            source: 'derived'
        };
    }

    if (persistedCategory) {
        return {
            text: derived.apologistikoText || persistedCategory,
            className: isApologistikoIntervalPresent(row)
                ? 'cell-apologistiko'
                : '',
            source: 'persisted'
        };
    }

    const noCardsDisplayStatus = String(
        row.noCardsDisplayStatus || row.no_cards_display_status || ''
    ).trim();
    if (noCardsDisplayStatus === 'ΑΔΕΙΑ' || noCardsDisplayStatus === 'ΑΡΓΙΑ') {
        return {
            text: noCardsDisplayStatus,
            className:
                noCardsDisplayStatus === 'ΑΔΕΙΑ'
                    ? 'cell-no-card-adeia'
                    : 'cell-no-card-argia',
            source: 'derived'
        };
    }

    if (derived.isApologistikoRepoRow) {
        return {
            text: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ',
            className: 'cell-repo-day',
            source: 'derived'
        };
    }

    return {
        text: derived.apologistikoText || '',
        className: isApologistikoIntervalPresent(row)
            ? 'cell-apologistiko'
            : hasAdeiaSuggestion(row)
              ? 'cell-adeia-suggestion'
              : '',
        source: 'derived'
    };
}

function resolveReviewRowPresentation(
    row = {},
    derived = {},
    repoTransferState = null
) {
    const declaredCategory = String(
        row.kathgoria_ergasias_original || row.kathgoria_ergasias || ''
    ).trim();
    const hasActualCards =
        num(row.cards_ores_ergasias) > 0 || hasValidCardInterval(row);
    const isAppliedRow = repoTransferState?.applied === true;
    const isOriginalDeclaredRepo =
        declaredCategory === 'ΑΝ' &&
        !hasActualCards &&
        !isAppliedRow;
    const isOriginalDeclaredNonWork =
        declaredCategory === 'ΜΕ' &&
        !hasActualCards &&
        !isAppliedRow;
    const isOriginalDeclaredNeutral =
        isOriginalDeclaredRepo || isOriginalDeclaredNonWork;
    const apologistiko = isOriginalDeclaredNeutral
        ? {
            text: '-',
            className: '',
            source: isOriginalDeclaredRepo
                ? 'declared_repo_neutral'
                : 'declared_non_work_neutral'
        }
        : resolveReviewApologistikoPresentation(row, derived);
    const isAppliedRepoTarget =
        isAppliedRow &&
        repoTransferState.role === 'target' &&
        apologistiko.text === 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ';

    return {
        declared: {
            text: derived.declaredText || '-',
            className: derived.declaredClass || ''
        },
        apologistiko: {
            ...apologistiko,
            className: isAppliedRepoTarget
                ? 'cell-repo-day-applied'
                : apologistiko.className
        },
        badgeState: isOriginalDeclaredNeutral ? {} : repoTransferState || {},
        isAppliedRow,
        isAppliedRepoTarget,
        isOriginalDeclaredRepo,
        isOriginalDeclaredNonWork,
        isOriginalDeclaredNeutral
    };
}

function setEmployeeGroupExpanded(groupTr, expanded) {
    const groupId = String(groupTr?.dataset?.groupId || '');
    if (!groupId) return;

    groupTr.classList.toggle('collapsed', !expanded);
    groupTr.classList.toggle('expanded', expanded);
    groupTr.setAttribute('aria-expanded', String(expanded));

    document.querySelectorAll(
        `tr.employee-detail-row[data-group-id="${groupId}"],
         tr.employee-subtotal-row[data-group-id="${groupId}"],
         tr.employee-deviation-row[data-group-id="${groupId}"]`
    ).forEach((row) => row.classList.toggle('d-none', !expanded));
}

function toggleEmployeeGroupAccordion(groupTr) {
    const willExpand = groupTr.classList.contains('collapsed');

    if (willExpand) {
        document.querySelectorAll(
            '#resultsTable tbody tr.employee-group-row[aria-expanded="true"]'
        ).forEach((otherGroup) => {
            if (otherGroup !== groupTr) setEmployeeGroupExpanded(otherGroup, false);
        });
    }

    setEmployeeGroupExpanded(groupTr, willExpand);
}

function renderReviewRows(rows = [], deviations = []) {
    ensureReviewTableStructure();

    const repoTransferRowStates = buildRepoTransferReviewRowStates();
    const deviationsByKodikos = buildDeviationsByKodikos(deviations);
    const rowsByKodikos = new Map();
    rows.forEach((row) => {
        const key = employeeGroupKey(row);
        if (!rowsByKodikos.has(key)) rowsByKodikos.set(key, []);
        rowsByKodikos.get(key).push(row);
    });
    const holidayLikeDateSet = buildHolidayLikeDateSet(rows);

    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = '';

    let currentGroup = '';
    let currentGroupId = '';
    let employeeTotals = createEmptyTotals();
    let grandTotals = createEmptyTotals();
    let currentGroupRows = [];

    for (const row of rows) {
        const groupKey = employeeGroupKey(row);

        if (groupKey !== currentGroup) {
            if (currentGroup !== '') {
                appendEmployeeTotalsRow(tbody, employeeTotals, currentGroupId);
                appendEmployeeDeviationRows(
                    tbody,
                    deviationsByKodikos.get(currentGroup) || [],
                    currentGroupId
                );
                employeeTotals = createEmptyTotals();
                currentGroupRows = [];
            }

            currentGroup = groupKey;

            const groupId = `group-${String(groupKey).replace(/[^a-zA-Z0-9]/g, '-')}`;
            currentGroupId = groupId;

            const groupTr = document.createElement('tr');
            groupTr.classList.add('table-secondary', 'employee-group-row', 'collapsed');
            groupTr.dataset.groupId = groupId;
            groupTr.style.cursor = 'pointer';
            groupTr.tabIndex = 0;
            groupTr.setAttribute('role', 'button');
            groupTr.setAttribute('aria-expanded', 'false');

            const groupDeviations = deviationsByKodikos.get(groupKey) || [];
            const groupHasProfileChange = hasProfileChangeDeviation(groupDeviations);
            const groupHasAdeiaSuggestion = hasAdeiaSuggestionInRows(rowsByKodikos.get(groupKey) || []);

            groupTr.innerHTML = `
                <td colspan="13" class="fw-bold">
                    ${row.ypokatasthma || ''}
                    |
                    ${row.kodikos || ''}
                    |
                    ${row.eponymo || ''}
                    ${row.onoma || ''}
                    ${groupHasProfileChange ? '<span class="review-warning-badge">⚠ Αλλαγή όρων</span>' : ''}
                    ${groupHasAdeiaSuggestion ? '<span class="review-adeia-badge">⚠ Έλεγχος άδειας</span>' : ''}
                </td>
            `;

            groupTr.addEventListener('click', () => toggleEmployeeGroupAccordion(groupTr));
            groupTr.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;

                event.preventDefault();
                toggleEmployeeGroupAccordion(groupTr);
            });

            tbody.appendChild(groupTr);
        }

        const tr = document.createElement('tr');
        tr.classList.add('employee-detail-row');
        tr.classList.add('d-none');
        tr.dataset.groupId = currentGroupId;

        if (row.is_locked) {
            tr.classList.add('row-locked');
        }

        // Cell-level coloring is applied below in the <td> elements.

        tr.style.cursor = 'pointer';

        const apologistikoText = renderIntervalCell(row, 'apo_ora', 'eos_ora', '_apologistika');

        const effectiveKathgoria =
            row.kathgoria_ergasias_apologistika &&
            String(row.kathgoria_ergasias_apologistika).trim() !== ''
                ? String(row.kathgoria_ergasias_apologistika).trim()
                : String(row.kathgoria_ergasias || '').trim();

        const isFullTimeProfile = resolveReviewIsFullTimePresentation(row);

        const isApologistikoRepoRow =
            row.apologistiko_biblio === true &&
            effectiveKathgoria === 'ΑΝ' &&
            num(row.cards_ores_ergasias) === 0 &&
            isFullTimeProfile;

        const isApologistikoNonWorkRow =
            row.apologistiko_biblio === true &&
            (effectiveKathgoria === 'ΜΕ' || (effectiveKathgoria === 'ΑΝ' && !isFullTimeProfile)) &&
            num(row.cards_ores_ergasias) === 0;

        const repoTransferState =
            repoTransferRowStates.get(rowIdentityKey(row._id)) || null;

        const isDeclaredRestOrNonWork =
            row.apologistiko_biblio !== true &&
            num(row.ores_ergasias) === 0 &&
            num(row.cards_ores_ergasias) === 0;

        const declaredText = isDeclaredRestOrNonWork
            ? isFullTimeProfile
                ? 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ'
                : 'ΜΗ ΕΡΓΑΣΙΑ'
            : renderIntervalCell(row, 'apo_ora', 'eos_ora');

        const declaredClass = isDeclaredRestOrNonWork
            ? isFullTimeProfile
                ? 'cell-declared-repo-day'
                : 'cell-non-work-day'
            : '';
        const rowPresentation = resolveReviewRowPresentation(
            row,
            {
                apologistikoText,
                isApologistikoRepoRow,
                isApologistikoNonWorkRow,
                declaredText,
                declaredClass
            },
            repoTransferState
        );

        if (rowPresentation.isAppliedRow) {
            tr.classList.add('row-repo-transfer-applied');
            tr.dataset.repoTransferRole = repoTransferState.role;
        }

        const argiaHoursValue = hours(calculateHolidayDisplayHours(row, holidayLikeDateSet));

        const yperoriaTotal = sumNomimiYperoria(row) + sumParanomiYperoria(row);

        tr.innerHTML = `
            <td>${renderReviewDateCell(row)}</td>
            <td>${row.ypokatasthma || ''}</td>
            <td>${row.kodikos || ''}</td>
            <td${tdClass(rowPresentation.declared.className)}>${rowPresentation.declared.text}</td>
            <td>
                ${renderIntervalCell(row, 'cards_apo_ora', 'cards_eos_ora')}
                ${renderSixthDayCardsBadge(row)}
            </td>
            <td${tdClass(rowPresentation.apologistiko.className)}>
                ${rowPresentation.apologistiko.text}
                ${renderScenarioBadge(row, rowPresentation.badgeState)}
            </td>
            <td${tdClass(breakSubtractedHoursValue(row) > 0 ? 'cell-break-subtracted' : '')}>
                ${renderHoursCell(row)}
            </td>
            <td${tdClass(hasPositiveNumber(row.ores_apoysias_apologistika) ? 'cell-apoysia' : '')}>
                ${hours(row.ores_apoysias_apologistika)}
            </td>
            <td${tdClass(hasPositiveNumber(row.ores_nyxtas_apologistika) ? 'cell-nyxta' : '')}>
                ${hours(row.ores_nyxtas_apologistika)}
            </td>
            <td${tdClass(hasPositiveNumber(argiaHoursValue) ? 'cell-argia' : '')}>
                ${argiaHoursValue}
            </td>
            <td${tdClass(hasPositiveNumber(row.ores_prostheths_ergasias_apologistika) ? 'cell-prostheti' : '')}>
                ${hours(row.ores_prostheths_ergasias_apologistika)}
            </td>
            <td${tdClass(sumYperergasia(row) > 0 ? 'cell-yperergasia' : '')}>
                ${hours(sumYperergasia(row))}
            </td>
            <td${tdClass(yperoriaCellClass(row))}>
                ${hours(yperoriaTotal)}
            </td>
        `;

        tr.addEventListener('click', () => {
            showDetailsModal(row);
        });

        addRowToTotals(employeeTotals, row);
        addRowToTotals(grandTotals, row);
        currentGroupRows.push(row);

        tbody.appendChild(tr);
    }

    if (currentGroup !== '') {
        appendEmployeeTotalsRow(tbody, employeeTotals, currentGroupId);
        appendEmployeeDeviationRows(
            tbody,
            deviationsByKodikos.get(currentGroup) || [],
            currentGroupId
        );
        appendGrandTotalsRow(tbody, grandTotals);
    }
}

function getPolicyPreviewStatusLabel(status) {
    const key = String(status || '').trim();

    return (
        policyPreviewStatusLabels[key] || {
            label: formatPolicyPreviewUnknownCode(key),
            description: formatPolicyPreviewUnknownCode(key),
            badgeClass: 'text-bg-secondary'
        }
    );
}

function getPolicyPreviewScopeLabel(scope) {
    const key = String(scope || '').trim();

    if (key === 'page') return 'Τρέχουσα σελίδα';

    return key || '-';
}

function formatPolicyPreviewDate(value) {
    if (!value) return '-';

    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
    }

    const dt = new Date(value);

    if (Number.isNaN(dt.getTime())) return '-';

    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();

    return `${day}/${month}/${year}`;
}

function formatPolicyPreviewHours(value) {
    if (value === null || value === undefined || value === '') return '-';

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) return '-';

    return numericValue.toFixed(2);
}

function sanitizePolicyPreviewCode(value) {
    return String(value || '')
        .trim()
        .replace(/[^A-Za-z0-9_.:-]/g, '')
        .slice(0, 80);
}

function formatPolicyPreviewUnknownCode(value) {
    const key = sanitizePolicyPreviewCode(value);
    return key ? `Μη χαρτογραφημένο αποτέλεσμα (${key})` : '-';
}

function getPolicyPreviewPolicyLabel(policyCode) {
    const key = String(policyCode || '').trim() || 'UNKNOWN';

    return policyPreviewPolicyLabels[key] || formatPolicyPreviewUnknownCode(key);
}

function getPolicyPreviewScenarioLabel(scenarioCode) {
    const key = String(scenarioCode || '').trim() || 'UNKNOWN';

    return (
        policyPreviewScenarioLabels[key] || formatPolicyPreviewUnknownCode(key)
    );
}

function getPolicyPreviewActionLabel(actionType) {
    const key = String(actionType || '').trim() || 'UNKNOWN';

    return policyPreviewActionLabels[key] || formatPolicyPreviewUnknownCode(key);
}

function getPolicyPreviewReasonLabel(reasonCode) {
    const key = String(reasonCode || '').trim() || 'UNKNOWN';

    return policyPreviewReasonLabels[key] || formatPolicyPreviewUnknownCode(key);
}

function getPolicyPreviewFlagLabel(flagKey) {
    const key = String(flagKey || '').trim();

    return policyPreviewFlagLabels[key] || formatPolicyPreviewUnknownCode(key);
}

function getPolicyPreviewFieldLabel(fieldKey) {
    const key = String(fieldKey || '').trim();
    const auditFieldLabel = auditLabel(key);

    if (policyPreviewFieldLabels[key]) return policyPreviewFieldLabels[key];
    if (auditFieldLabel && auditFieldLabel !== key) return auditFieldLabel;

    return formatPolicyPreviewUnknownCode(key);
}

function getPolicyPreviewGroupTitle(group = {}) {
    const policyLabel = getPolicyPreviewPolicyLabel(group.policy_code);
    const scenarioLabel = getPolicyPreviewScenarioLabel(group.scenario_code);

    if (policyPreviewPolicyLabels[String(group.policy_code || '').trim() || 'UNKNOWN']) {
        return policyLabel;
    }
    if (policyPreviewScenarioLabels[String(group.scenario_code || '').trim() || 'UNKNOWN']) {
        return scenarioLabel;
    }

    return getPolicyPreviewStatusLabel(group.status).label;
}

function renderPolicyPreviewGroupDescription(group = {}) {
    const statusLabel = getPolicyPreviewStatusLabel(group.status).label;
    const policyLabel = getPolicyPreviewPolicyLabel(group.policy_code);
    const scenarioLabel = getPolicyPreviewScenarioLabel(group.scenario_code);
    const actionLabel = getPolicyPreviewActionLabel(group.action_type);
    const reasonLabel = getPolicyPreviewReasonLabel(group.reason_code);

    return [
        ['Κατάσταση', statusLabel],
        ['Πολιτική', policyLabel],
        ['Σενάριο', scenarioLabel],
        ['Ενέργεια', actionLabel],
        ['Αιτιολογία', reasonLabel]
    ]
        .filter(([, value]) => value && value !== '-')
        .map(([label, value]) => `${label}: ${value}`)
        .join(' · ');
}

function buildPolicyPreviewParams(baseParams) {
    return new URLSearchParams({
        apo_hmeromhnia: baseParams.get('apo_hmeromhnia') || '',
        eos_hmeromhnia: baseParams.get('eos_hmeromhnia') || '',
        ypokatasthma: baseParams.get('ypokatasthma') || '',
        kodikos: baseParams.get('kodikos') || '',
        page: '1',
        limit: '200'
    });
}

async function fetchPolicyPreviewGrouping(baseParams) {
    const params = buildPolicyPreviewParams(baseParams);
    const response = await fetch(`/api/prodhlomena-oraria/review/policies/preview?${params.toString()}`, {
        method: 'GET',
        headers: {
            'CSRF-Token': csrfToken
        }
    });
    const payload = await response.json();

    if (!payload.success) {
        throw new Error(payload.message || 'Αποτυχία ανάκτησης ομαδοποίησης πολιτικών.');
    }

    return {
        grouping: payload.grouping || null,
        atomicGroupProjection: payload.atomic_group_projection || null,
        previewRows: Array.isArray(payload.rows) ? payload.rows : []
    };
}

function buildPolicyPreviewApprovalsParams(baseParams) {
    return new URLSearchParams({
        apo_hmeromhnia: baseParams.get('apo_hmeromhnia') || '',
        eos_hmeromhnia: baseParams.get('eos_hmeromhnia') || '',
        ypokatasthma: baseParams.get('ypokatasthma') || '',
        decision_status: 'RECORDED',
        page: '1',
        limit: '200'
    });
}

async function fetchPolicyPreviewApprovals(baseParams) {
    const params = buildPolicyPreviewApprovalsParams(baseParams);
    const response = await fetch(
        `/api/prodhlomena-oraria/review/policies/approvals?${params.toString()}`,
        {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'CSRF-Token': csrfToken
            }
        }
    );
    const payload = await response.json();

    if (!response.ok || !payload.success) {
        throw new Error(
            payload.message || 'Δεν ήταν δυνατή η ανάκτηση των καταγεγραμμένων αποφάσεων.'
        );
    }

    return {
        records: Array.isArray(payload.records) ? payload.records : [],
        total: Number(payload.total) || 0
    };
}

function buildPolicyPreviewApplyDryRunParams(baseParams) {
    return new URLSearchParams({
        apo_hmeromhnia: baseParams.get('apo_hmeromhnia') || '',
        eos_hmeromhnia: baseParams.get('eos_hmeromhnia') || '',
        page: '1',
        limit: '20'
    });
}

async function fetchPolicyPreviewApplyDryRun(baseParams) {
    const params = buildPolicyPreviewApplyDryRunParams(baseParams);
    const response = await fetch(
        `/api/prodhlomena-oraria/review/policies/apply-dry-run?${params.toString()}`,
        {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'CSRF-Token': csrfToken
            }
        }
    );
    const payload = await response.json();

    if (!response.ok || !payload.success) {
        throw new Error('Δεν ήταν δυνατή η ανάκτηση της προεπισκόπησης εφαρμογής.');
    }

    return payload;
}

function buildPolicyPreviewApprovalsMap(records = []) {
    const approvalsByGroupId = new Map();

    records.forEach((record) => {
        if (String(record?.decision_status || '').trim() !== 'RECORDED') return;

        const groupId = String(record?.group_id || '').trim();
        if (!groupId) return;

        const existing = approvalsByGroupId.get(groupId) || {
            latest: null,
            historyDecisionTypes: new Set(),
            blockingDecisionTypes: new Set(),
            count: 0
        };
        const decisionType = String(record?.decision_type || '').trim();
        const reuseScope = String(record?.reuse_scope || '').trim();
        const reuseStatus = String(record?.reuse_status || '').trim();
        const blocksNewDecision =
            reuseScope !== 'FUTURE_IDENTICAL' || reuseStatus === 'ACTIVE';

        if (decisionType) existing.historyDecisionTypes.add(decisionType);
        if (decisionType && blocksNewDecision) {
            existing.blockingDecisionTypes.add(decisionType);
        }
        existing.count += 1;

        const existingTime = new Date(existing.latest?.created_at || 0).getTime() || 0;
        const recordTime = new Date(record.created_at || 0).getTime() || 0;
        if (!existing.latest || recordTime > existingTime) existing.latest = record;

        approvalsByGroupId.set(groupId, existing);
    });

    return approvalsByGroupId;
}

async function refreshPolicyPreviewApprovals(baseParams) {
    const result = await fetchPolicyPreviewApprovals(baseParams);
    currentPolicyPreviewApprovalRecords = result.records;
    currentPolicyPreviewApprovalTotal = result.total;
    currentPolicyPreviewApprovalsByGroupId = buildPolicyPreviewApprovalsMap(result.records);
    currentPolicyPreviewApprovalsError = '';
}

function formatPolicyPreviewDateTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '-';

    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(
        2,
        '0'
    )}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes()
    ).padStart(2, '0')}`;
}

function getPolicyPreviewDecisionLabel(decisionType) {
    const key = String(decisionType || '').trim();
    return policyPreviewDecisionLabels[key] || 'Άγνωστη απόφαση';
}

function getPolicyPreviewDecisionButtons(group = {}) {
    const hasProposal = (Array.isArray(group.items) ? group.items : []).some(
        (item) => Object.keys(item?.proposed_values || {}).length > 0
    );
    const buttons = policyPreviewDecisionButtons.filter(({ type }) =>
        hasProposal
            ? type !== 'MARK_REVIEWED'
            : ['MARK_REVIEWED', 'NEEDS_MORE_REVIEW'].includes(type)
    );

    if (String(group.status || '').trim() === 'OK') {
        buttons.splice(1, 0, { type: 'MARK_OK', className: 'policy-preview-decision-info' });
    }

    return buttons;
}

function getPolicyPreviewDecisionStatusLabel(status) {
    const key = String(status || '').trim();
    if (key === 'RECORDED') return 'Καταγεγραμμένη';
    if (key === 'CANCELLED') return 'Ακυρωμένη';
    return '-';
}

function getPolicyPreviewHistoryUsers() {
    return [
        ...new Set(
            currentPolicyPreviewApprovalRecords
                .map((record) => String(record?.created_by_user_name || '').trim())
                .filter(Boolean)
        )
    ].sort((left, right) => left.localeCompare(right, 'el', { sensitivity: 'base' }));
}

function getFilteredPolicyPreviewApprovalRecords() {
    const decisionType = currentApprovalHistoryFilters.decisionType;
    const userName = currentApprovalHistoryFilters.userName;
    const searchText = currentApprovalHistoryFilters.searchText.trim().toLocaleLowerCase('el');

    return currentPolicyPreviewApprovalRecords.filter((record) => {
        if (decisionType && record.decision_type !== decisionType) return false;
        if (userName && record.created_by_user_name !== userName) return false;
        if (!searchText) return true;

        const searchableText = [
            record.notes,
            record.policy_code,
            getPolicyPreviewPolicyLabel(record.policy_code),
            record.scenario_code,
            getPolicyPreviewScenarioLabel(record.scenario_code),
            record.action_type,
            getPolicyPreviewActionLabel(record.action_type),
            record.reason_code,
            getPolicyPreviewReasonLabel(record.reason_code),
            record.group_id,
            record.created_by_user_name
        ]
            .map((value) => String(value || '').toLocaleLowerCase('el'))
            .join(' ');

        return searchableText.includes(searchText);
    });
}

function getPolicyPreviewApprovalRecordCounts(record = {}) {
    const items = Array.isArray(record.items) ? record.items : [];
    const employeeCount = new Set(
        items.map((item) => String(item?.employee_kodikos || '').trim()).filter(Boolean)
    ).size;

    return {
        items: Number(record.snapshot_summary?.items_count) || items.length,
        employees: Number(record.snapshot_summary?.employees_count) || employeeCount
    };
}

function truncatePolicyPreviewHistoryText(value, maxLength = 90) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) return text || '-';
    return `${text.slice(0, maxLength - 1)}…`;
}

function renderPolicyPreviewApprovalHistorySummary() {
    const records = currentPolicyPreviewApprovalRecords;

    if (records.length === 0) {
        return '<span class="small text-muted">Δεν υπάρχουν καταγεγραμμένες αποφάσεις για την τρέχουσα περίοδο.</span>';
    }

    const recordedCount = records.filter((record) => record.decision_status === 'RECORDED').length;
    const countsByDecision = records.reduce((counts, record) => {
        const key = String(record?.decision_type || '').trim();
        if (key) counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {});
    const countsByUser = records.reduce((counts, record) => {
        const key = String(record?.created_by_user_name || '').trim();
        if (key) counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {});
    const latestRecord = [...records].sort(
        (left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0)
    )[0];

    return `
        <span class="badge text-bg-light border">Σύνολο αποφάσεων: ${escapeHtml(
            currentPolicyPreviewApprovalTotal
        )}</span>
        <span class="badge text-bg-light border">Καταγεγραμμένες: ${escapeHtml(
            recordedCount
        )}</span>
        ${Object.entries(countsByDecision)
            .map(
                ([type, count]) => `
                    <span class="badge text-bg-light border">
                        ${escapeHtml(getPolicyPreviewDecisionLabel(type))}: ${escapeHtml(count)}
                    </span>
                `
            )
            .join('')}
        ${Object.entries(countsByUser)
            .map(
                ([userName, count]) => `
                    <span class="badge text-bg-light border">
                        ${escapeHtml(userName)}: ${escapeHtml(count)}
                    </span>
                `
            )
            .join('')}
        <span class="badge text-bg-light border">
            Τελευταία καταγραφή: ${escapeHtml(formatPolicyPreviewDateTime(latestRecord?.created_at))}
        </span>
    `;
}

function renderPolicyPreviewApprovalHistoryResults() {
    const records = getFilteredPolicyPreviewApprovalRecords();

    if (records.length === 0) {
        return '<div class="small text-muted border rounded p-2">Δεν βρέθηκαν αποφάσεις για τα επιλεγμένα φίλτρα.</div>';
    }

    return `
        <div class="small text-muted mb-1">Εμφανίζονται ${escapeHtml(records.length)} εγγραφές.</div>
        <div class="policy-preview-history-table-wrapper">
            <table class="table table-sm table-bordered align-middle mb-0 policy-preview-history-table">
                <thead>
                    <tr>
                        <th>Ημερομηνία / ώρα</th>
                        <th>Απόφαση</th>
                        <th>Χρήστης</th>
                        <th>Ομάδα / κατάσταση</th>
                        <th>Πολιτική</th>
                        <th>Σενάριο</th>
                        <th>Εγγραφές</th>
                        <th>Εργαζόμενοι</th>
                        <th>Σημειώσεις</th>
                        <th>Ενέργειες</th>
                    </tr>
                </thead>
                <tbody>
                    ${records
                        .map((record) => {
                            const counts = getPolicyPreviewApprovalRecordCounts(record);
                            return `
                                <tr>
                                    <td>${escapeHtml(formatPolicyPreviewDateTime(record.created_at))}</td>
                                    <td>${escapeHtml(getPolicyPreviewDecisionLabel(record.decision_type))}</td>
                                    <td>${escapeHtml(record.created_by_user_name || '-')}</td>
                                    <td title="${escapeHtml(record.group_id || '')}">${escapeHtml(
                                        getPolicyPreviewStatusLabel(record.status).label
                                    )}</td>
                                    <td title="${escapeHtml(record.policy_code || '')}">${escapeHtml(
                                        getPolicyPreviewPolicyLabel(record.policy_code)
                                    )}</td>
                                    <td title="${escapeHtml(record.scenario_code || '')}">${escapeHtml(
                                        getPolicyPreviewScenarioLabel(record.scenario_code)
                                    )}</td>
                                    <td>${escapeHtml(counts.items)}</td>
                                    <td>${escapeHtml(counts.employees)}</td>
                                    <td class="policy-preview-history-notes" title="${escapeHtml(
                                        record.notes || ''
                                    )}">${escapeHtml(truncatePolicyPreviewHistoryText(record.notes))}</td>
                                    <td class="text-nowrap">
                                        <button
                                            type="button"
                                            class="btn btn-sm policy-preview-details-btn policy-preview-history-details-btn"
                                            data-approval-id="${escapeHtml(record._id || '')}">
                                            Λεπτομέρειες
                                        </button>
                                        <button
                                            type="button"
                                            class="btn btn-sm btn-outline-secondary policy-preview-history-group-btn"
                                            data-group-id="${escapeHtml(record.group_id || '')}">
                                            Άνοιγμα ομάδας
                                        </button>
                                    </td>
                                </tr>
                            `;
                        })
                        .join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderPolicyPreviewApprovalHistoryContent() {
    const users = getPolicyPreviewHistoryUsers();
    const limitNote =
        currentPolicyPreviewApprovalTotal > currentPolicyPreviewApprovalRecords.length
            ? '<div class="small text-muted mb-2">Εμφανίζονται έως 200 καταγεγραμμένες αποφάσεις για την τρέχουσα περίοδο.</div>'
            : '';

    return `
        ${limitNote}
        <div class="policy-preview-history-filters">
            <div>
                <label class="form-label small mb-1" for="policyPreviewHistoryDecisionFilter">Απόφαση</label>
                <select class="form-select form-select-sm" id="policyPreviewHistoryDecisionFilter">
                    <option value="">Όλες οι αποφάσεις</option>
                    ${Object.entries(policyPreviewDecisionLabels)
                        .map(
                            ([type, label]) => `
                                <option value="${escapeHtml(type)}" ${
                                    currentApprovalHistoryFilters.decisionType === type ? 'selected' : ''
                                }>${escapeHtml(label)}</option>
                            `
                        )
                        .join('')}
                </select>
            </div>
            <div>
                <label class="form-label small mb-1" for="policyPreviewHistoryUserFilter">Χρήστης</label>
                <select class="form-select form-select-sm" id="policyPreviewHistoryUserFilter">
                    <option value="">Όλοι οι χρήστες</option>
                    ${users
                        .map(
                            (userName) => `
                                <option value="${escapeHtml(userName)}" ${
                                    currentApprovalHistoryFilters.userName === userName ? 'selected' : ''
                                }>${escapeHtml(userName)}</option>
                            `
                        )
                        .join('')}
                </select>
            </div>
            <div>
                <label class="form-label small mb-1" for="policyPreviewHistorySearch">Αναζήτηση</label>
                <input
                    type="search"
                    class="form-control form-control-sm"
                    id="policyPreviewHistorySearch"
                    value="${escapeHtml(currentApprovalHistoryFilters.searchText)}"
                    placeholder="Σημειώσεις, πολιτική ή σενάριο">
            </div>
        </div>
        <div id="policyPreviewApprovalHistoryResults">
            ${renderPolicyPreviewApprovalHistoryResults()}
        </div>
    `;
}

function renderPolicyPreviewApprovalHistorySection() {
    return `
        <section class="policy-preview-history-card" aria-labelledby="policyPreviewHistoryTitle">
            <div class="policy-preview-history-header">
                <div class="fw-semibold" id="policyPreviewHistoryTitle">Ιστορικό Αποφάσεων Ελέγχου</div>
                <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary policy-preview-history-toggle"
                    aria-expanded="${String(currentApprovalHistoryExpanded)}">
                    ${currentApprovalHistoryExpanded ? 'Απόκρυψη' : 'Εμφάνιση'}
                </button>
            </div>
            <div class="policy-preview-history-summary">
                ${renderPolicyPreviewApprovalHistorySummary()}
            </div>
            <div class="policy-preview-history-content ${
                currentApprovalHistoryExpanded ? '' : 'd-none'
            }">
                ${renderPolicyPreviewApprovalHistoryContent()}
            </div>
        </section>
    `;
}

function showPolicyPreviewApprovalHistoryDetails(record = {}) {
    const items = Array.isArray(record.items) ? record.items : [];
    const visibleItems = items.slice(0, 50);
    const counts = getPolicyPreviewApprovalRecordCounts(record);
    const html = `
        <div class="text-start">
            <table class="table table-sm table-bordered align-middle mb-3">
                <tbody>
                    <tr><th>Απόφαση</th><td>${escapeHtml(
                        getPolicyPreviewDecisionLabel(record.decision_type)
                    )}</td></tr>
                    <tr><th>Κατάσταση</th><td>${escapeHtml(
                        getPolicyPreviewDecisionStatusLabel(record.decision_status)
                    )}</td></tr>
                    <tr><th>ID ομάδας</th><td><span class="small text-muted">${escapeHtml(
                        record.group_id || '-'
                    )}</span></td></tr>
                    <tr><th>Χρήστης</th><td>${escapeHtml(
                        record.created_by_user_name || '-'
                    )}</td></tr>
                    <tr><th>Ημερομηνία</th><td>${escapeHtml(
                        formatPolicyPreviewDateTime(record.created_at)
                    )}</td></tr>
                    <tr><th>Περίοδος</th><td>${escapeHtml(
                        formatPolicyPreviewDate(record.apo_hmeromhnia)
                    )} – ${escapeHtml(formatPolicyPreviewDate(record.eos_hmeromhnia))}</td></tr>
                    <tr><th>Πολιτική</th><td title="${escapeHtml(
                        record.policy_code || ''
                    )}">${escapeHtml(getPolicyPreviewPolicyLabel(record.policy_code))}</td></tr>
                    <tr><th>Σενάριο</th><td title="${escapeHtml(
                        record.scenario_code || ''
                    )}">${escapeHtml(getPolicyPreviewScenarioLabel(record.scenario_code))}</td></tr>
                    <tr><th>Ενέργεια</th><td title="${escapeHtml(
                        record.action_type || ''
                    )}">${escapeHtml(getPolicyPreviewActionLabel(record.action_type))}</td></tr>
                    <tr><th>Αιτιολογία</th><td title="${escapeHtml(
                        record.reason_code || ''
                    )}">${escapeHtml(getPolicyPreviewReasonLabel(record.reason_code))}</td></tr>
                    <tr><th>Εγγραφές</th><td>${escapeHtml(counts.items)}</td></tr>
                    <tr><th>Εργαζόμενοι</th><td>${escapeHtml(counts.employees)}</td></tr>
                    <tr><th>Σημειώσεις</th><td>${escapeHtml(record.notes || '-')}</td></tr>
                </tbody>
            </table>
            <div class="fw-semibold mb-1">Snapshot εγγραφών</div>
            <div class="table-responsive policy-preview-history-details-items">
                <table class="table table-sm table-bordered align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Κωδικός</th>
                            <th>Ημ/νία</th>
                            <th>Προδηλωμένο</th>
                            <th>Απολογιστικό</th>
                            <th>Ώρες καρτών</th>
                            <th>Προτεινόμενες τιμές</th>
                            <th>Ενδείξεις</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visibleItems
                            .map(
                                (item) => `
                                    <tr>
                                        <td>${escapeHtml(item.employee_kodikos || '-')}</td>
                                        <td>${escapeHtml(formatPolicyPreviewDate(item.hmeromhnia))}</td>
                                        <td>${escapeHtml(item.kathgoria_ergasias || '-')}</td>
                                        <td>${escapeHtml(
                                            item.kathgoria_ergasias_apologistika || '-'
                                        )}</td>
                                        <td>${escapeHtml(
                                            formatPolicyPreviewHours(item.cards_ores_ergasias)
                                        )}</td>
                                        <td>${renderPolicyPreviewCompactValues(
                                            item.proposed_values
                                        )}</td>
                                        <td>${renderPolicyPreviewFlags(item.flags)}</td>
                                    </tr>
                                `
                            )
                            .join('')}
                    </tbody>
                </table>
            </div>
            ${
                items.length > visibleItems.length
                    ? `<div class="small text-muted mt-1">Εμφανίζονται τα πρώτα ${escapeHtml(
                          visibleItems.length
                      )} από ${escapeHtml(items.length)} items.</div>`
                    : ''
            }
        </div>
    `;

    Swal.fire({
        title: 'Λεπτομέρειες καταγεγραμμένης απόφασης',
        html,
        width: '72rem',
        confirmButtonText: 'Κλείσιμο',
        customClass: {
            popup: 'policy-preview-approval-details-swal',
            htmlContainer: 'policy-preview-approval-details-swal-body'
        }
    });
}

function openPolicyPreviewGroupFromHistory(root, groupId) {
    const normalizedGroupId = String(groupId || '').trim();
    const groupCard = [...root.querySelectorAll('.policy-preview-group-card')].find(
        (card) => String(card.dataset.groupId || '').trim() === normalizedGroupId
    );

    if (!normalizedGroupId || !groupCard) {
        Swal.fire({
            icon: 'info',
            title: 'Η ομάδα δεν είναι διαθέσιμη',
            text: 'Η ομάδα δεν υπάρχει στην τρέχουσα σελίδα αποτελεσμάτων.'
        });
        return;
    }

    const itemsContainer = groupCard.querySelector('.policy-preview-group-items');
    const toggleButton = groupCard.querySelector('.policy-preview-group-toggle');

    if (itemsContainer?.classList.contains('d-none')) {
        itemsContainer.classList.remove('d-none');
        toggleButton?.setAttribute('aria-expanded', 'true');
        if (toggleButton) toggleButton.textContent = 'Κλείσιμο';
    }

    groupCard.classList.remove('policy-preview-group-highlight');
    window.requestAnimationFrame(() => {
        groupCard.classList.add('policy-preview-group-highlight');
        groupCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    window.setTimeout(() => {
        groupCard.classList.remove('policy-preview-group-highlight');
    }, 3000);
}

function bindPolicyPreviewHistoryDetails(root) {
    root.querySelectorAll('.policy-preview-history-details-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const approvalId = String(button.dataset.approvalId || '').trim();
            const record = currentPolicyPreviewApprovalRecords.find(
                (entry) => String(entry?._id || '').trim() === approvalId
            );

            if (record) showPolicyPreviewApprovalHistoryDetails(record);
        });
    });

    root.querySelectorAll('.policy-preview-history-group-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const groupsRoot =
                root.closest('#policyPreviewGroupsContainer') ||
                document.getElementById('policyPreviewGroupsContainer');

            if (groupsRoot) openPolicyPreviewGroupFromHistory(groupsRoot, button.dataset.groupId);
        });
    });
}

function updatePolicyPreviewApprovalHistoryResults(container) {
    const results = container.querySelector('#policyPreviewApprovalHistoryResults');
    if (!results) return;

    results.innerHTML = renderPolicyPreviewApprovalHistoryResults();
    bindPolicyPreviewHistoryDetails(results);
}

function bindPolicyPreviewApprovalHistoryEvents(container) {
    const toggle = container.querySelector('.policy-preview-history-toggle');
    const content = container.querySelector('.policy-preview-history-content');

    toggle?.addEventListener('click', () => {
        currentApprovalHistoryExpanded = !currentApprovalHistoryExpanded;
        content?.classList.toggle('d-none', !currentApprovalHistoryExpanded);
        toggle.setAttribute('aria-expanded', String(currentApprovalHistoryExpanded));
        toggle.textContent = currentApprovalHistoryExpanded ? 'Απόκρυψη' : 'Εμφάνιση';
    });

    container
        .querySelector('#policyPreviewHistoryDecisionFilter')
        ?.addEventListener('change', (event) => {
            currentApprovalHistoryFilters.decisionType = event.target.value;
            updatePolicyPreviewApprovalHistoryResults(container);
        });

    container
        .querySelector('#policyPreviewHistoryUserFilter')
        ?.addEventListener('change', (event) => {
            currentApprovalHistoryFilters.userName = event.target.value;
            updatePolicyPreviewApprovalHistoryResults(container);
        });

    container.querySelector('#policyPreviewHistorySearch')?.addEventListener('input', (event) => {
        currentApprovalHistoryFilters.searchText = event.target.value;
        updatePolicyPreviewApprovalHistoryResults(container);
    });

    bindPolicyPreviewHistoryDetails(container);
}

const policyPreviewApplyDryRunItemStatusLabels = Object.freeze({
    WOULD_CHANGE: 'Θα άλλαζε',
    NO_CHANGE: 'Ήδη ίδιο',
    SKIPPED: 'Παραλείφθηκε'
});

const policyPreviewApplyDryRunFieldActionLabels = Object.freeze({
    WOULD_SET: 'Θα οριστεί',
    ALREADY_SAME: 'Ήδη ίδια',
    SKIPPED: 'Παραλείφθηκε'
});

function getPolicyPreviewApplyDryRunItemStatusLabel(status) {
    const key = String(status || '').trim();
    return policyPreviewApplyDryRunItemStatusLabels[key] || 'Άγνωστη κατάσταση';
}

function getPolicyPreviewApplyDryRunFieldActionLabel(action) {
    const key = String(action || '').trim();
    return policyPreviewApplyDryRunFieldActionLabels[key] || 'Άγνωστη ενέργεια';
}

function formatPolicyPreviewDryRunReason(reason) {
    const text = String(reason || '').trim();
    if (!text) return '-';

    const exactTranslations = {
        'Δεν υπάρχουν proposed_values για αξιολόγηση.':
            'Δεν υπάρχουν προτεινόμενες τιμές για αξιολόγηση.',
        'Μη έγκυρο prodhlomena_oraria_id.':
            'Μη έγκυρο ID εγγραφής προδηλωμένου ωραρίου.',
        'Το πεδίο δεν υποστηρίζεται από το dry-run apply allowlist.':
            'Το πεδίο δεν υποστηρίζεται από τη λίστα πεδίων της προεπισκόπησης εφαρμογής.'
    };

    if (exactTranslations[text]) return exactTranslations[text];

    return text
        .replaceAll('proposed_values', 'προτεινόμενες τιμές')
        .replaceAll('field_diffs', 'διαφορές πεδίων')
        .replaceAll('prodhlomena_oraria_id', 'ID εγγραφής προδηλωμένου ωραρίου')
        .replaceAll('dry-run apply allowlist', 'λίστα υποστηριζόμενων πεδίων της προεπισκόπησης')
        .replaceAll('current_value', 'τρέχουσα τιμή')
        .replaceAll('proposed_value', 'προτεινόμενη τιμή');
}

function getPolicyPreviewApplyDryRunGroupLabel(groupId) {
    const normalizedGroupId = String(groupId || '').trim();
    const groups = Array.isArray(currentPolicyPreviewGrouping?.groups)
        ? currentPolicyPreviewGrouping.groups
        : [];
    const group = groups.find(
        (entry) => String(entry?.group_id || '').trim() === normalizedGroupId
    );

    if (!group) return 'Ομάδα εκτός τρέχουσας σελίδας';
    return `${getPolicyPreviewGroupTitle(group)} · ${getPolicyPreviewStatusLabel(group.status).label}`;
}

function getPolicyPreviewApplyDryRunSummaryValue(summary, key) {
    const value = Number(summary?.[key]);
    return Number.isFinite(value) ? value : 0;
}

function renderPolicyPreviewApplyDryRunSummary(summary = {}) {
    const entries = [
        ['Εγκρίσεις που βρέθηκαν', 'approvals_found'],
        ['Εγκρίσεις που εμφανίζονται', 'approvals_returned'],
        ['Εγγραφές', 'items_total'],
        ['Θα άλλαζαν', 'items_with_changes'],
        ['Ήδη ίδιες', 'items_without_changes'],
        ['Παραλείφθηκαν', 'items_skipped'],
        ['Πεδία συνολικά', 'fields_total'],
        ['Πεδία που θα άλλαζαν', 'fields_would_change'],
        ['Πεδία ήδη ίδια', 'fields_already_same'],
        ['Πεδία που παραλείφθηκαν', 'fields_skipped']
    ];

    return entries
        .map(
            ([label, key]) => `
                <span class="badge text-bg-light border">
                    ${escapeHtml(label)}: ${escapeHtml(
                        getPolicyPreviewApplyDryRunSummaryValue(summary, key)
                    )}
                </span>
            `
        )
        .join('');
}

function formatPolicyPreviewApplyDryRunValue(value, field = '') {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'ΝΑΙ' : 'ΟΧΙ';

    const fieldKey = String(field || '').trim();
    if (fieldKey.startsWith('ores_') && Number.isFinite(Number(value))) {
        return Number(value).toFixed(2);
    }

    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (_error) {
            return '-';
        }
    }

    return String(value).trim() || '-';
}

function getPolicyPreviewApplyDryRunApprovalCounts(approval = {}) {
    const summary = approval.summary || {};
    return {
        items: getPolicyPreviewApplyDryRunSummaryValue(summary, 'items_total'),
        changes: getPolicyPreviewApplyDryRunSummaryValue(summary, 'items_with_changes'),
        same: getPolicyPreviewApplyDryRunSummaryValue(summary, 'items_without_changes'),
        skipped: getPolicyPreviewApplyDryRunSummaryValue(summary, 'items_skipped')
    };
}

function renderPolicyPreviewApplyDryRunApprovals() {
    const approvals = Array.isArray(currentPolicyPreviewApplyDryRun?.approvals)
        ? currentPolicyPreviewApplyDryRun.approvals
        : [];

    if (approvals.length === 0) {
        return `
            <div class="small text-muted border rounded p-2">
                Δεν υπάρχουν εγκεκριμένες προτάσεις για προεπισκόπηση εφαρμογής στην τρέχουσα περίοδο.
            </div>
        `;
    }

    return `
        <div class="policy-preview-history-table-wrapper">
            <table class="table table-sm table-bordered align-middle mb-0 policy-preview-history-table">
                <thead>
                    <tr>
                        <th>Ημερομηνία απόφασης</th>
                        <th>Χρήστης</th>
                        <th>Ομάδα</th>
                        <th>Σημειώσεις</th>
                        <th>Εγγραφές</th>
                        <th>Θα άλλαζαν</th>
                        <th>Ήδη ίδιες</th>
                        <th>Παραλείφθηκαν</th>
                        <th>Λεπτομέρειες</th>
                    </tr>
                </thead>
                <tbody>
                    ${approvals
                        .map((approval, approvalIndex) => {
                            const counts = getPolicyPreviewApplyDryRunApprovalCounts(approval);
                            return `
                                <tr>
                                    <td>${escapeHtml(
                                        formatPolicyPreviewDateTime(approval.created_at)
                                    )}</td>
                                    <td>${escapeHtml(approval.created_by_user_name || '-')}</td>
                                    <td title="${escapeHtml(approval.group_id || '')}">${escapeHtml(
                                        getPolicyPreviewApplyDryRunGroupLabel(approval.group_id)
                                    )}</td>
                                    <td title="${escapeHtml(approval.notes || '')}">${escapeHtml(
                                        truncatePolicyPreviewHistoryText(approval.notes)
                                    )}</td>
                                    <td>${escapeHtml(counts.items)}</td>
                                    <td>${escapeHtml(counts.changes)}</td>
                                    <td>${escapeHtml(counts.same)}</td>
                                    <td>${escapeHtml(counts.skipped)}</td>
                                    <td class="text-nowrap">
                                        <button
                                            type="button"
                                            class="btn btn-sm policy-preview-details-btn policy-preview-dry-run-details-btn"
                                            data-approval-index="${escapeHtml(approvalIndex)}">
                                            Λεπτομέρειες
                                        </button>
                                    </td>
                                </tr>
                            `;
                        })
                        .join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderPolicyPreviewApplyDryRunSection() {
    if (currentPolicyPreviewApplyDryRunError) {
        return `
            <section class="policy-preview-history-card" aria-labelledby="policyPreviewDryRunTitle">
                <div class="policy-preview-history-header">
                    <div class="fw-semibold" id="policyPreviewDryRunTitle">
                        Προεπισκόπηση Εφαρμογής Εγκεκριμένων Προτάσεων
                    </div>
                </div>
                <div class="alert alert-warning py-1 px-2 small m-2">
                    ${escapeHtml(currentPolicyPreviewApplyDryRunError)}
                </div>
            </section>
        `;
    }

    const summary = currentPolicyPreviewApplyDryRun?.summary || {};
    return `
        <section class="policy-preview-history-card" aria-labelledby="policyPreviewDryRunTitle">
            <div class="policy-preview-history-header">
                <div class="fw-semibold" id="policyPreviewDryRunTitle">
                    Προεπισκόπηση Εφαρμογής Εγκεκριμένων Προτάσεων
                </div>
                <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary policy-preview-dry-run-toggle"
                    aria-expanded="${String(currentPolicyPreviewApplyDryRunExpanded)}">
                    ${currentPolicyPreviewApplyDryRunExpanded ? 'Απόκρυψη' : 'Εμφάνιση'}
                </button>
            </div>
            <div class="alert alert-info py-1 px-2 small mx-2 mt-2 mb-1">
                Η προεπισκόπηση είναι μόνο ενημερωτική. Δεν εφαρμόζεται καμία αλλαγή στα Προδηλωμένα.
            </div>
            <div class="policy-preview-history-summary">
                ${renderPolicyPreviewApplyDryRunSummary(summary)}
            </div>
            <div class="policy-preview-history-content ${
                currentPolicyPreviewApplyDryRunExpanded ? '' : 'd-none'
            }">
                ${renderPolicyPreviewApplyDryRunApprovals()}
            </div>
        </section>
    `;
}

function renderPolicyPreviewApplyDryRunFieldDiffs(fieldDiffs = []) {
    if (!Array.isArray(fieldDiffs) || fieldDiffs.length === 0) {
        return '<div class="small text-muted">Δεν υπάρχουν διαφορές πεδίων.</div>';
    }

    return `
        <div class="table-responsive">
            <table class="table table-sm table-bordered align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Πεδίο</th>
                        <th>Τρέχουσα τιμή</th>
                        <th>Προτεινόμενη τιμή</th>
                        <th>Ενέργεια</th>
                        <th>Αιτιολογία</th>
                    </tr>
                </thead>
                <tbody>
                    ${fieldDiffs
                        .map(
                            (diff) => `
                                <tr>
                                    <td title="${escapeHtml(diff.field || '')}">${escapeHtml(
                                        diff.label || getPolicyPreviewFieldLabel(diff.field)
                                    )}</td>
                                    <td>${escapeHtml(
                                        formatPolicyPreviewApplyDryRunValue(
                                            diff.current_value,
                                            diff.field
                                        )
                                    )}</td>
                                    <td>${escapeHtml(
                                        formatPolicyPreviewApplyDryRunValue(
                                            diff.proposed_value,
                                            diff.field
                                        )
                                    )}</td>
                                    <td title="${escapeHtml(diff.action || '')}">${escapeHtml(
                                        getPolicyPreviewApplyDryRunFieldActionLabel(diff.action)
                                    )}</td>
                                    <td>${escapeHtml(
                                        formatPolicyPreviewDryRunReason(diff.reason)
                                    )}</td>
                                </tr>
                            `
                        )
                        .join('')}
                </tbody>
            </table>
        </div>
    `;
}

function showPolicyPreviewApplyDryRunDetails(approval = {}) {
    const items = Array.isArray(approval.items) ? approval.items : [];
    const counts = getPolicyPreviewApplyDryRunApprovalCounts(approval);
    const itemsHtml = items.length
        ? items
              .map(
                  (item) => `
                      <div class="border rounded p-2 mb-2">
                          <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
                              <span class="fw-semibold">Κωδικός: ${escapeHtml(
                                  item.employee_kodikos || '-'
                              )}</span>
                              <span>Ημ/νία: ${escapeHtml(
                                  formatPolicyPreviewDate(item.hmeromhnia)
                              )}</span>
                              <span class="badge text-bg-light border" title="${escapeHtml(
                                  item.status || ''
                              )}">${escapeHtml(
                                  getPolicyPreviewApplyDryRunItemStatusLabel(item.status)
                              )}</span>
                          </div>
                          <div class="small mb-2">${escapeHtml(
                              formatPolicyPreviewDryRunReason(item.reason)
                          )}</div>
                          ${renderPolicyPreviewApplyDryRunFieldDiffs(item.field_diffs)}
                      </div>
                  `
              )
              .join('')
        : '<div class="small text-muted">Δεν υπάρχουν εγγραφές σε αυτή την έγκριση.</div>';
    const html = `
        <div class="text-start">
            <table class="table table-sm table-bordered align-middle mb-2">
                <tbody>
                    <tr><th>ID έγκρισης</th><td>${escapeHtml(
                        approval.approval_id || '-'
                    )}</td></tr>
                    <tr><th>Ομάδα</th><td title="${escapeHtml(
                        approval.group_id || ''
                    )}">${escapeHtml(
                        getPolicyPreviewApplyDryRunGroupLabel(approval.group_id)
                    )}</td></tr>
                    <tr><th>Τύπος απόφασης</th><td title="${escapeHtml(
                        approval.decision_type || ''
                    )}">${escapeHtml(
                        getPolicyPreviewDecisionLabel(approval.decision_type)
                    )}</td></tr>
                    <tr><th>Ημερομηνία</th><td>${escapeHtml(
                        formatPolicyPreviewDateTime(approval.created_at)
                    )}</td></tr>
                    <tr><th>Χρήστης</th><td>${escapeHtml(
                        approval.created_by_user_name || '-'
                    )}</td></tr>
                    <tr><th>Σημειώσεις</th><td>${escapeHtml(
                        approval.notes || '-'
                    )}</td></tr>
                    <tr><th>Εγγραφές</th><td>${escapeHtml(counts.items)}</td></tr>
                    <tr><th>Θα άλλαζαν</th><td>${escapeHtml(counts.changes)}</td></tr>
                    <tr><th>Ήδη ίδιες</th><td>${escapeHtml(counts.same)}</td></tr>
                    <tr><th>Παραλείφθηκαν</th><td>${escapeHtml(counts.skipped)}</td></tr>
                </tbody>
            </table>
            <div class="fw-semibold mb-1">Εγγραφές και διαφορές πεδίων</div>
            <div class="policy-preview-dry-run-items">${itemsHtml}</div>
        </div>
    `;

    Swal.fire({
        title: 'Λεπτομέρειες προεπισκόπησης εφαρμογής',
        html,
        width: '78rem',
        confirmButtonText: 'Κλείσιμο',
        customClass: {
            popup: 'policy-preview-dry-run-swal',
            htmlContainer: 'policy-preview-dry-run-swal-body'
        }
    });
}

function bindPolicyPreviewApplyDryRunEvents(container) {
    const toggle = container.querySelector('.policy-preview-dry-run-toggle');
    const content = toggle
        ?.closest('.policy-preview-history-card')
        ?.querySelector('.policy-preview-history-content');

    toggle?.addEventListener('click', () => {
        currentPolicyPreviewApplyDryRunExpanded = !currentPolicyPreviewApplyDryRunExpanded;
        content?.classList.toggle('d-none', !currentPolicyPreviewApplyDryRunExpanded);
        toggle.setAttribute('aria-expanded', String(currentPolicyPreviewApplyDryRunExpanded));
        toggle.textContent = currentPolicyPreviewApplyDryRunExpanded ? 'Απόκρυψη' : 'Εμφάνιση';
    });

    container.querySelectorAll('.policy-preview-dry-run-details-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const approvalIndex = Number(button.dataset.approvalIndex);
            const approval = currentPolicyPreviewApplyDryRun?.approvals?.[approvalIndex];
            if (approval) showPolicyPreviewApplyDryRunDetails(approval);
        });
    });
}

function renderPolicyPreviewApprovalPanel(group = {}, groupIndex = 0) {
    const groupId = String(group.group_id || '').trim();
    const approvalState = currentPolicyPreviewApprovalsByGroupId.get(groupId);
    const latest = approvalState?.latest || null;
    const existingDecisionTypes = approvalState?.blockingDecisionTypes || new Set();
    const decisionDetails = latest
        ? `
            <div class="small mb-1">
                <span class="fw-semibold">Καταγεγραμμένες αποφάσεις:</span>
                ${escapeHtml(approvalState?.count || 0)}
            </div>
            <div class="policy-preview-approval-details">
                <span><span class="fw-semibold">Απόφαση:</span> ${escapeHtml(
                    getPolicyPreviewDecisionLabel(latest.decision_type)
                )}</span>
                <span><span class="fw-semibold">Κατάσταση:</span> Καταγεγραμμένη</span>
                <span><span class="fw-semibold">Χρήστης:</span> ${escapeHtml(
                    latest.created_by_user_name || '-'
                )}</span>
                <span><span class="fw-semibold">Ημερομηνία:</span> ${escapeHtml(
                    formatPolicyPreviewDateTime(latest.created_at)
                )}</span>
            </div>
            ${
                latest.reuse_scope === 'FUTURE_IDENTICAL' && latest.reuse_status === 'ACTIVE'
                    ? `<div class="small text-success fw-semibold mt-1">Ενεργή και για μελλοντικές ίδιες περιπτώσεις.</div>
                       ${userCanManageReusablePolicyApproval() ? `<button type="button" class="btn btn-sm btn-outline-danger mt-2 policy-preview-revoke-btn" data-approval-id="${escapeHtml(latest._id)}">Ανάκληση πολιτικής</button>` : ''}`
                    : ''
            }
            ${
                latest.notes
                    ? `<div class="small mt-1"><span class="fw-semibold">Σημειώσεις:</span> ${escapeHtml(
                          latest.notes
                      )}</div>`
                    : ''
            }
        `
        : '<div class="small text-muted">Δεν έχει καταγραφεί απόφαση για αυτή την ομάδα.</div>';

    const buttonsHtml = (userCanManageReusablePolicyApproval()
        ? getPolicyPreviewDecisionButtons(group)
        : [])
        .map(({ type, className }) => {
            const alreadyRecorded = existingDecisionTypes.has(type);
            const title = alreadyRecorded ? 'Έχει ήδη καταγραφεί.' : getPolicyPreviewDecisionLabel(type);

            return `
                <button
                    type="button"
                    class="btn btn-sm ${escapeHtml(
                        className
                    )} policy-preview-decision-btn"
                    data-group-index="${escapeHtml(groupIndex)}"
                    data-decision-type="${escapeHtml(type)}"
                    title="${escapeHtml(title)}"
                    ${alreadyRecorded ? 'disabled aria-disabled="true"' : ''}>
                    ${escapeHtml(getPolicyPreviewDecisionLabel(type))}
                    ${alreadyRecorded ? ' · Έχει ήδη καταγραφεί' : ''}
                </button>
            `;
        })
        .join('');

    return `
        <div class="policy-preview-approval-panel">
            <div class="small fw-semibold mb-1">Απόφαση ελέγχου</div>
            ${decisionDetails}
            <div class="policy-preview-decision-actions">
                ${buttonsHtml}
            </div>
        </div>
    `;
}

async function getPolicyPreviewCsrfToken() {
    if (csrfToken) return csrfToken;

    const response = await fetch('/csrf-token', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
    });
    const payload = await response.json();
    const freshToken = String(payload.csrfToken || '').trim();

    if (!response.ok || !freshToken) {
        throw new Error('Δεν ήταν δυνατή η ανάκτηση του CSRF token.');
    }

    return freshToken;
}

async function revokePolicyPreviewApproval(approvalId) {
    const confirmation = await Swal.fire({
        icon: 'warning',
        title: 'Ανάκληση επαναχρησιμοποιήσιμης πολιτικής',
        text: 'Η πολιτική δεν θα εφαρμόζεται σε μελλοντικές περιπτώσεις.',
        input: 'textarea',
        inputLabel: 'Υποχρεωτική αιτιολογία',
        inputAttributes: { maxlength: '1000' },
        showCancelButton: true,
        confirmButtonText: 'Ανάκληση πολιτικής',
        cancelButtonText: 'Άκυρο',
        preConfirm: (value) => {
            const reason = String(value || '').trim();
            if (!reason) {
                Swal.showValidationMessage('Η αιτιολογία ανάκλησης είναι υποχρεωτική.');
                return false;
            }
            return reason;
        }
    });
    if (!confirmation.isConfirmed) return;
    const token = await getPolicyPreviewCsrfToken();
    const response = await fetch(`/api/prodhlomena-oraria/review/policies/approvals/${encodeURIComponent(approvalId)}/revoke`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
            'CSRF-Token': token, 'x-csrf-token': token },
        body: JSON.stringify({ reason: confirmation.value })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Αποτυχία ανάκλησης πολιτικής.');
    if (currentPolicyPreviewBaseParams) {
        await refreshPolicyPreviewApprovals(currentPolicyPreviewBaseParams);
        const refreshed = await fetchPolicyPreviewGrouping(currentPolicyPreviewBaseParams);
        attachPolicyPreviewResults(currentReviewRows, refreshed.previewRows);
        renderCurrentReviewRows();
        renderPolicyPreviewGroups(refreshed.grouping, { atomicGroupProjection: refreshed.atomicGroupProjection });
        if (currentHrReviewLoaded && refreshed.atomicGroupProjection) {
            currentHrReviewProjection = refreshed.atomicGroupProjection;
            classifyHrReviewGroups();
            renderHrReviewWorkspace();
        }
    }
    await Swal.fire({ icon: 'success', title: 'Η πολιτική ανακλήθηκε' });
}

async function confirmPolicyPreviewDecision(group, decisionType, options = {}) {
    const decisionLabel = getPolicyPreviewDecisionLabel(decisionType);
    const reusableDecisionTypes = new Set([
        'APPROVE_PREFILL', 'MARK_OK', 'MARK_REVIEWED', 'REJECT_PROPOSAL'
    ]);
    const forceAtomicReuse = options.forceAtomicReuse === true &&
        group?.decision_grain === 'ATOMIC_LINKED_SET' &&
        decisionType === 'APPROVE_PROPOSAL';
    const canReuse = forceAtomicReuse ||
        (group?.reusable_eligible === true && reusableDecisionTypes.has(decisionType));
    const decisionMessage =
        decisionType === 'APPROVE_PREFILL'
            ? 'Η πρόταση θα χαρακτηριστεί ως εγκεκριμένη για μελλοντική εφαρμογή, αλλά δεν θα εφαρμοστεί τώρα καμία αλλαγή στα Προδηλωμένα.'
            : 'Η απόφαση θα καταγραφεί στο ιστορικό approval/audit. Δεν θα εφαρμοστεί καμία αλλαγή στα Προδηλωμένα.';
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Καταγραφή απόφασης ελέγχου',
        html: `
            <div class="text-start">
                <div class="fw-semibold mb-2">${escapeHtml(decisionLabel)}</div>
                <div class="mb-2">${escapeHtml(decisionMessage)}</div>
                <div>Βεβαιωθείτε ότι εργάζεστε στη σωστή εταιρεία. Η ενέργεια θα καταγραφεί στο ιστορικό αποφάσεων.</div>
                ${
                    canReuse
                        ? `<div class="form-check mt-3 p-2 border rounded bg-light">
                               <input class="form-check-input ms-0 me-2" type="checkbox" id="policyPreviewReuseFutureIdentical">
                               <label class="form-check-label fw-semibold" for="policyPreviewReuseFutureIdentical">
                                   Χρήση της ίδιας απόφασης σε μελλοντικές ίδιες περιπτώσεις
                               </label>
                               <div class="small text-muted mt-1">
                                   Ισχύει μόνο για την ίδια εταιρεία, το ίδιο παράρτημα και ακριβώς το ίδιο σενάριο πολιτικής. Ο χρήστης θα ενημερώνεται για την παλιότερη έγκριση HR.
                               </div>
                           </div>`
                        : ''
                }
                <label class="form-label mt-3" for="policyPreviewDecisionNotes">Σημειώσεις</label>
                <textarea class="form-control" id="policyPreviewDecisionNotes" maxlength="2000" rows="3" placeholder="Προαιρετικές σημειώσεις"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Καταγραφή απόφασης',
        cancelButtonText: 'Άκυρο',
        reverseButtons: true,
        preConfirm: () => ({
            notes: String(
                Swal.getPopup()?.querySelector('#policyPreviewDecisionNotes')?.value || ''
            ).trim(),
            reuseScope: forceAtomicReuse
                    ? 'FUTURE_IDENTICAL'
                    : canReuse &&
                      Swal.getPopup()?.querySelector('#policyPreviewReuseFutureIdentical')?.checked === true
                        ? 'FUTURE_IDENTICAL'
                        : 'ONE_TIME'
        })
    });

    return result.isConfirmed ? result.value : null;
}

async function submitPolicyPreviewDecision(group, decisionType, options = {}) {
    if (policyPreviewApprovalSubmitting) return;
    if (!currentPolicyPreviewBaseParams) {
        throw new Error('Δεν είναι διαθέσιμη η περίοδος της προεπισκόπησης.');
    }
    if (!group?.group_id || !group?.group_key || !Array.isArray(group?.items) || !group.items.length) {
        throw new Error('Η ομάδα δεν περιέχει έγκυρα δεδομένα για καταγραφή απόφασης.');
    }

    const confirmation = await confirmPolicyPreviewDecision(group, decisionType, options);
    if (confirmation === null) return;

    policyPreviewApprovalSubmitting = true;

    try {
        const activeCsrfToken = await getPolicyPreviewCsrfToken();
        const response = await fetch('/api/prodhlomena-oraria/review/policies/approvals', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'CSRF-Token': activeCsrfToken,
                'x-csrf-token': activeCsrfToken
            },
            body: JSON.stringify({
                apo_hmeromhnia: currentPolicyPreviewBaseParams.get('apo_hmeromhnia') || '',
                eos_hmeromhnia: currentPolicyPreviewBaseParams.get('eos_hmeromhnia') || '',
                ypokatasthma: currentPolicyPreviewBaseParams.get('ypokatasthma') || '',
                group: {
                    group_id: group.group_id,
                    group_key: group.group_key,
                    scope: currentPolicyPreviewGrouping?.scope || 'page',
                    status: group.status,
                    policy_code: group.policy_code,
                    scenario_code: group.scenario_code,
                    action_type: group.action_type,
                    reason_code: group.reason_code,
                    group_type: group.group_type,
                    decision_grain: group.decision_grain
                },
                decision_type: decisionType,
                reuse_scope: confirmation.reuseScope,
                notes: confirmation.notes,
                client_payload_version: 'policy-preview-groups-ui-1',
                items: group.items
            })
        });
        const payload = await response.json().catch(() => ({}));

        if (response.status === 409) {
            try {
                await refreshPolicyPreviewApprovals(currentPolicyPreviewBaseParams);
            } catch (approvalRefreshError) {
                currentPolicyPreviewApprovalsError =
                    approvalRefreshError.message ||
                    'Δεν ήταν δυνατή η ανάκτηση των καταγεγραμμένων αποφάσεων.';
            }

            renderPolicyPreviewGroups(currentPolicyPreviewGrouping, {
                expandedGroupId: group.group_id
            });

            await Swal.fire({
                icon: 'info',
                title: 'Η απόφαση έχει ήδη καταγραφεί',
                text: 'Υπάρχει ήδη ίδια καταγεγραμμένη απόφαση για αυτή την ομάδα.'
            });
            return;
        }

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Δεν ήταν δυνατή η καταγραφή της απόφασης.');
        }

        try {
            await refreshPolicyPreviewApprovals(currentPolicyPreviewBaseParams);
        } catch (approvalRefreshError) {
            currentPolicyPreviewApprovalsError =
                approvalRefreshError.message ||
                'Δεν ήταν δυνατή η ανάκτηση των καταγεγραμμένων αποφάσεων.';
        }

        if (confirmation.reuseScope === 'FUTURE_IDENTICAL') {
            try {
                const refreshedPreview = await fetchPolicyPreviewGrouping(
                    currentPolicyPreviewBaseParams
                );
                attachPolicyPreviewResults(currentReviewRows, refreshedPreview.previewRows);
                currentAtomicRepoTransferProjection =
                    refreshedPreview.atomicGroupProjection || currentAtomicRepoTransferProjection;
                renderCurrentReviewRows();
                renderPolicyPreviewGroups(refreshedPreview.grouping, {
                    atomicGroupProjection: refreshedPreview.atomicGroupProjection
                });
            } catch (previewRefreshError) {
                console.warn(
                    '[submitPolicyPreviewDecision] Reusable decision refresh unavailable:',
                    previewRefreshError
                );
                renderPolicyPreviewGroups(currentPolicyPreviewGrouping, {
                    expandedGroupId: group.group_id
                });
            }
        } else {
            renderPolicyPreviewGroups(currentPolicyPreviewGrouping, {
                expandedGroupId: group.group_id
            });
        }

        await Swal.fire({
            icon: 'success',
            title: 'Επιτυχία',
            text: payload.message || 'Η απόφαση καταγράφηκε επιτυχώς.'
        });
    } finally {
        policyPreviewApprovalSubmitting = false;
    }
}

function renderPolicyPreviewStatusBadge(status) {
    const statusCode = String(status || '').trim() || 'UNKNOWN';
    const statusLabel = getPolicyPreviewStatusLabel(statusCode);

    return `
        <span class="badge ${escapeHtml(statusLabel.badgeClass)}" title="${escapeHtml(statusCode)}">
            ${escapeHtml(statusLabel.label)}
        </span>
    `;
}

function renderPolicyPreviewGroupingSummary(
    grouping,
    decisionGroups = [],
    diagnosticGroups = [],
    repoTransferDecisionCount = 0,
    inheritedApprovalGroups = []
) {
    const summary = grouping?.summary || {};
    const decisionsCount = decisionGroups.reduce(
        (total, group) => total + Number(group?.count || 0),
        0
    );
    const diagnosticsCount = diagnosticGroups.reduce(
        (total, group) => total + Number(group?.count || 0),
        0
    );
    const inheritedApprovalCount = inheritedApprovalGroups.reduce(
        (total, group) => total + Number(group?.count || 0),
        0
    );
    const completedCount = Math.max(
        Number(summary.total || 0) - decisionsCount - diagnosticsCount,
        0
    );

    return `
        <div class="policy-preview-summary-meta">
            <span class="badge ${decisionsCount > 0 ? 'text-bg-danger' : 'text-bg-success'}">
                ${escapeHtml(decisionsCount)} ${decisionsCount === 1 ? 'εγγραφή χρειάζεται' : 'εγγραφές χρειάζονται'} απόφαση
            </span>
            <span class="badge text-bg-light border">
                ${escapeHtml(decisionGroups.length)} ${decisionGroups.length === 1 ? 'ομάδα απόφασης' : 'ομάδες αποφάσεων'}
            </span>
            ${
                repoTransferDecisionCount > 0
                    ? `<span class="badge text-bg-warning">${escapeHtml(
                          repoTransferDecisionCount
                      )} ${repoTransferDecisionCount === 1 ? 'μεταφορά ρεπό προς απόφαση' : 'μεταφορές ρεπό προς απόφαση'}</span>`
                    : ''
            }
            ${
                diagnosticsCount > 0
                    ? `<span class="badge text-bg-secondary">${escapeHtml(diagnosticsCount)} τεχνικές εκκρεμότητες</span>`
                    : ''
            }
            ${
                inheritedApprovalCount > 0
                    ? `<span class="badge text-bg-success">${escapeHtml(
                          inheritedApprovalCount
                      )} βάσει παλιότερης έγκρισης HR</span>`
                    : ''
            }
            <span class="badge text-bg-light border">
                ${escapeHtml(completedCount)} ολοκληρώθηκαν αυτόματα
            </span>
        </div>
    `;
}

function renderPolicyPreviewCompactValues(value) {
    const entries = Object.entries(value || {});

    if (entries.length === 0) return '<span class="text-muted">-</span>';

    return `
        <div class="policy-preview-compact-values">
            ${entries
                .map(
                    ([key, entryValue]) => `
                        <span class="policy-preview-value-chip">
                            <span class="fw-semibold" title="${escapeHtml(key)}">${escapeHtml(getPolicyPreviewFieldLabel(key))}:</span>
                            ${escapeHtml(formatScenarioValue(entryValue))}
                        </span>
                    `
                )
                .join('')}
        </div>
    `;
}

function renderPolicyPreviewFlags(flags = {}) {
    const trueFlags = Object.entries(flags || {}).filter(([, value]) => value === true);

    if (trueFlags.length === 0) return '<span class="text-muted">-</span>';

    return `
        <div class="policy-preview-compact-values">
            ${trueFlags
                .map(
                    ([key]) => `
                        <span class="badge text-bg-light border" title="${escapeHtml(key)}">
                            ${escapeHtml(getPolicyPreviewFlagLabel(key))}
                        </span>
                    `
                )
                .join('')}
        </div>
    `;
}

function findPolicyPreviewReviewRow(item = {}) {
    const itemId = rowIdentityKey(item.prodhlomena_oraria_id || item.preview_id);

    if (!itemId) return null;

    return currentReviewRows.find((row) => rowIdentityKey(row._id || row.id) === itemId) || null;
}

function formatPolicyPreviewIntervals(row = {}, apoPrefix, eosPrefix, suffix = '') {
    const lines = [1, 2, 3]
        .map((n) => {
            const p = pairNo(n);
            const apo = row[`${apoPrefix}_${p}${suffix}`];
            const eos = row[`${eosPrefix}_${p}${suffix}`];

            if (!hasMeaningfulValue(apo) && !hasMeaningfulValue(eos)) return '';

            return intervalText(apo, eos);
        })
        .filter(Boolean);

    return lines.length > 0 ? lines.join(' / ') : '-';
}

function renderPolicyPreviewDetailsRows(item = {}, reviewRow = null) {
    const diagnostic = item.diagnostic_details || {};

    if (diagnostic.check_type) {
        const isInterday = diagnostic.check_type === 'INTERDAY_REST';
        const dateText = isInterday
            ? `${formatPolicyPreviewDate(diagnostic.current_date)} → ${formatPolicyPreviewDate(
                  diagnostic.next_date
              )}`
            : formatPolicyPreviewDate(item.hmeromhnia);
        const intervalText = [diagnostic.previous_end, diagnostic.next_start]
            .filter(Boolean)
            .join(' → ') || '-';

        return [
            ['Κωδικός εργαζομένου', item.employee_kodikos || '-'],
            ['Ημερομηνία/ες', dateText],
            ['Λήξη → επόμενη έναρξη', intervalText],
            [
                'Πραγματική ανάπαυση',
                formatPolicyPreviewRestMinutes(diagnostic.measured_rest_minutes)
            ],
            [
                'Ελάχιστη απαιτούμενη ανάπαυση',
                formatPolicyPreviewRestMinutes(diagnostic.minimum_rest_minutes)
            ]
        ]
            .map(
                ([label, value]) => `
                    <tr>
                        <th class="text-start">${escapeHtml(label)}</th>
                        <td>${escapeHtml(value)}</td>
                    </tr>
                `
            )
            .join('');
    }

    const row = reviewRow || {};
    const proposedCategory =
        item.proposed_values?.kathgoria_ergasias_apologistika || '-';
    const rows = reviewRow
        ? [
              ['Παράρτημα', row.ypokatasthma || '-'],
              ['Κωδικός εργαζομένου', row.kodikos || item.employee_kodikos || '-'],
              ['Ημερομηνία', formatPolicyPreviewDate(row.hmeromhnia || item.hmeromhnia)],
              ['Προδηλωμένη κατηγορία', row.kathgoria_ergasias || item.kathgoria_ergasias || '-'],
              ['Ωράριο', formatPolicyPreviewIntervals(row, 'apo_ora', 'eos_ora')],
              ['Προδηλωμένες ώρες', formatPolicyPreviewHours(row.ores_ergasias)],
              ['Κάρτες', formatPolicyPreviewIntervals(row, 'cards_apo_ora', 'cards_eos_ora')],
              ['Ώρες καρτών', formatPolicyPreviewHours(row.cards_ores_ergasias ?? item.cards_ores_ergasias)],
              [
                  'Απολογιστική/εμφανιζόμενη κατηγορία',
                  row.kathgoria_ergasias_apologistika ||
                      item.kathgoria_ergasias_apologistika ||
                      '-'
              ],
              ['Προτεινόμενη κατηγορία', proposedCategory],
              [
                  'Απολογιστικό ωράριο',
                  formatPolicyPreviewIntervals(row, 'apo_ora', 'eos_ora', '_apologistika')
              ],
              ['Ώρες εργασίας απολογιστικά', formatPolicyPreviewHours(row.ores_ergasias_apologistika)],
              ['Ώρες απουσίας', formatPolicyPreviewHours(row.ores_apoysias_apologistika)],
              ['Ώρες νύχτας', formatPolicyPreviewHours(row.ores_nyxtas_apologistika)],
              [
                  'Ώρες αργίας',
                  formatPolicyPreviewHours(
                      num(row.ores_argion_prosayxhsh_apologistika) +
                          num(row.ores_argion_ergasia_apologistika)
                  )
              ],
              ['Κλειδωμένο', row.is_locked ? 'ΝΑΙ' : 'ΟΧΙ'],
              ['ID εγγραφής', row._id || item.prodhlomena_oraria_id || '-']
          ]
        : [
        ['Κωδικός εργαζομένου', item.employee_kodikos || '-'],
        ['Ημερομηνία', formatPolicyPreviewDate(item.hmeromhnia)],
        ['Προδηλωμένη κατηγορία', item.kathgoria_ergasias || '-'],
        ['Απολογιστική/εμφανιζόμενη κατηγορία', item.kathgoria_ergasias_apologistika || '-'],
        ['Προτεινόμενη κατηγορία', proposedCategory],
        ['Ώρες καρτών', formatPolicyPreviewHours(item.cards_ores_ergasias)],
        ['ID εγγραφής', item.prodhlomena_oraria_id || '-']
    ];

    return rows
        .map(
            ([label, value]) => `
                <tr>
                    <th class="text-start">${escapeHtml(label)}</th>
                    <td>${escapeHtml(value)}</td>
                </tr>
            `
        )
        .join('');
}

function showPolicyPreviewItemDetails(item = {}) {
    const reviewRow = findPolicyPreviewReviewRow(item);
    const isRestDiagnostic = Boolean(item?.diagnostic_details?.check_type);
    const note = reviewRow
        ? 'Εμφανίζονται τα στοιχεία που είναι ήδη διαθέσιμα στο τρέχον read-only response της σελίδας.'
        : 'Τα πλήρη στοιχεία της εγγραφής δεν είναι διαθέσιμα στο τρέχον response. Για πλήρη στοιχεία ProdhlomenaOrariaModel θα χρειαστεί ξεχωριστό read-only endpoint.';
    const html = `
        <div class="text-start">
            <table class="table table-sm table-bordered align-middle mb-2">
                <tbody>
                    ${renderPolicyPreviewDetailsRows(item, reviewRow)}
                    ${
                        isRestDiagnostic
                            ? ''
                            : `<tr>
                                <th class="text-start">Προτεινόμενες τιμές</th>
                                <td>${renderPolicyPreviewCompactValues(item.proposed_values)}</td>
                            </tr>
                            <tr>
                                <th class="text-start">Ενδείξεις</th>
                                <td>${renderPolicyPreviewFlags(item.flags)}</td>
                            </tr>`
                    }
                </tbody>
            </table>
            <div class="small text-muted">
                Σημείωση: ${escapeHtml(note)}
            </div>
        </div>
    `;

    if (window.Swal?.fire) {
        Swal.fire({
            title: 'Πλήρη στοιχεία εγγραφής',
            html,
            confirmButtonText: 'Κλείσιμο',
            width: '48rem'
        });
        return;
    }

    const modalBody = document.getElementById('detailsContainer');

    if (!modalBody) return;

    modalBody.innerHTML = html;
    new bootstrap.Modal(document.getElementById('detailsModal')).show();
}

function formatPolicyPreviewRestMinutes(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return 'Δεν υπολογίστηκε — αναμένονται πλήρη χτυπήματα';

    const absoluteMinutes = Math.abs(Math.round(minutes));
    const hoursPart = Math.floor(absoluteMinutes / 60);
    const minutesPart = absoluteMinutes % 60;
    const sign = minutes < 0 ? '-' : '';

    return `${sign}${hoursPart} ώρες ${minutesPart} λεπτά`;
}

function renderRestPeriodPolicyPreviewGroupItems(items = [], groupIndex = 0) {
    return `
        <table class="table table-sm table-bordered align-middle mb-0 policy-preview-items-table">
            <thead class="table-light">
                <tr>
                    <th>Κωδικός</th>
                    <th>Ημερομηνία/ες</th>
                    <th>Λήξη → έναρξη</th>
                    <th>Πραγματική ανάπαυση</th>
                    <th>Απαιτούμενη</th>
                    <th>Στοιχεία</th>
                </tr>
            </thead>
            <tbody>
                ${items
                    .map((item, itemIndex) => {
                        const diagnostic = item.diagnostic_details || {};
                        const isInterday = diagnostic.check_type === 'INTERDAY_REST';
                        const dates = isInterday
                            ? `${formatPolicyPreviewDate(
                                  diagnostic.current_date
                              )} → ${formatPolicyPreviewDate(diagnostic.next_date)}`
                            : formatPolicyPreviewDate(item.hmeromhnia);
                        const interval = [diagnostic.previous_end, diagnostic.next_start]
                            .filter(Boolean)
                            .join(' → ') || '-';

                        return `
                            <tr>
                                <td>${escapeHtml(item.employee_kodikos || '-')}</td>
                                <td>${escapeHtml(dates)}</td>
                                <td>${escapeHtml(interval)}</td>
                                <td>${escapeHtml(
                                    formatPolicyPreviewRestMinutes(
                                        diagnostic.measured_rest_minutes
                                    )
                                )}</td>
                                <td>${escapeHtml(
                                    formatPolicyPreviewRestMinutes(
                                        diagnostic.minimum_rest_minutes
                                    )
                                )}</td>
                                <td>
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-primary policy-preview-details-btn"
                                        data-group-index="${escapeHtml(groupIndex)}"
                                        data-item-index="${escapeHtml(itemIndex)}">
                                        Προβολή
                                    </button>
                                </td>
                            </tr>
                        `;
                    })
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderPolicyPreviewGroupItems(items = [], groupIndex = 0) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<div class="text-muted small p-2">Δεν υπάρχουν items για αυτή την ομάδα.</div>';
    }

    if (items.every((item) => item?.diagnostic_details?.check_type)) {
        return renderRestPeriodPolicyPreviewGroupItems(items, groupIndex);
    }

    return `
        <table class="table table-sm table-bordered align-middle mb-0 policy-preview-items-table">
                <thead class="table-light">
                    <tr>
                        <th>Κωδικός</th>
                        <th>Ημ/νία</th>
                        <th>Προδηλωμένη κατηγορία</th>
                        <th>Απολογιστική κατηγορία</th>
                        <th>Προτεινόμενη κατηγορία</th>
                        <th>Ώρες καρτών</th>
                        <th>Στοιχεία απόφασης</th>
                    </tr>
                </thead>
                <tbody>
                    ${items
                        .map(
                            (item, itemIndex) => `
                                <tr>
                                    <td>${escapeHtml(item.employee_kodikos || '-')}</td>
                                    <td>${escapeHtml(formatPolicyPreviewDate(item.hmeromhnia))}</td>
                                    <td>${escapeHtml(item.kathgoria_ergasias || '-')}</td>
                                    <td>${escapeHtml(item.kathgoria_ergasias_apologistika || '-')}</td>
                                    <td>${escapeHtml(item.proposed_values?.kathgoria_ergasias_apologistika || '-')}</td>
                                    <td>${escapeHtml(formatPolicyPreviewHours(item.cards_ores_ergasias))}</td>
                                    <td>
                                        <button
                                            type="button"
                                            class="btn btn-sm btn-outline-primary policy-preview-details-btn"
                                            data-group-index="${escapeHtml(groupIndex)}"
                                            data-item-index="${escapeHtml(itemIndex)}">
                                            Προβολή
                                        </button>
                                    </td>
                                </tr>
                            `
                        )
                        .join('')}
                </tbody>
        </table>
    `;
}

function getAtomicRepoTransferCount(source, key) {
    const value = Number(source?.[key]);
    return Number.isFinite(value) ? value : 0;
}

function renderAtomicRepoTransferSummary(projection = {}) {
    const summary = projection.summary || {};
    const entries = [
        ['Εβδομάδες εργαζομένων που αξιολογήθηκαν', 'weeks_evaluated'],
        ['Προτάσεις', 'groups_count'],
        ['Συνδεδεμένες προτάσεις', 'decision_units_count'],
        ['Προτάσεις προς έλεγχο από HR', 'ready_count'],
        ['Εργαζόμενοι', 'employees_count'],
        ['Περιπτώσεις προς διερεύνηση', 'review_outcomes_count'],
        ['Εργαζόμενοι προς διερεύνηση', 'review_outcome_employees_count'],
        ['Χωρίς ασφαλή πρόταση', 'not_available_count'],
        ['Περιπτώσεις με μη έγκυρα στοιχεία', 'invalid_projection_count']
    ];

    return `
        <div class="atomic-repo-transfer-summary" aria-label="Σύνοψη προτάσεων μεταφοράς ρεπό">
            ${entries
                .map(
                    ([label, key]) => `
                        <div class="atomic-repo-transfer-summary-item">
                            <span>${escapeHtml(label)}</span>
                            <strong>${escapeHtml(getAtomicRepoTransferCount(summary, key))}</strong>
                        </div>
                    `
                )
                .join('')}
        </div>
    `;
}

function formatAtomicRepoTransferBoolean(value) {
    if (value === true) return 'ΝΑΙ';
    if (value === false) return 'ΟΧΙ';
    return '-';
}

function formatAtomicRepoTransferHours(value) {
    return formatPolicyPreviewHours(value).replace('.', ',');
}

function renderAtomicRepoTransferIntervals(proposedValues = {}) {
    return `
        <div class="atomic-repo-transfer-intervals">
            ${[1, 2, 3]
                .map((number) => {
                    const pair = pairNo(number);
                    const start = String(
                        proposedValues[`apo_ora_${pair}_apologistika`] || ''
                    ).trim();
                    const end = String(
                        proposedValues[`eos_ora_${pair}_apologistika`] || ''
                    ).trim();
                    const interval = start && end ? `${start}–${end}` : '—';

                    return `
                        <div class="atomic-repo-transfer-interval">
                            <span class="fw-semibold">Ωράριο ${escapeHtml(pair)}:</span>
                            <span>${escapeHtml(interval)}</span>
                        </div>
                    `;
                })
                .join('')}
        </div>
    `;
}

function renderAtomicRepoTransferResolution(group = {}) {
    const resolution = group.repo_resolution || {};
    const fields = [
        ['Αναμενόμενα ρεπό', resolution.effective_expected_weekly_repo],
        ['Τρέχοντα πραγματικά ρεπό', resolution.current_actual_repo],
        ['Προτεινόμενα/επιλυμένα ρεπό', resolution.resolved_repo],
        ['Πραγματικές ημέρες εργασίας', resolution.actual_workdays],
        ['6η ημέρα εργασίας', resolution.sixth_day_count],
        ['7η ημέρα/παράβαση', resolution.seventh_day_count]
    ];
    if (fields.every(([, value]) => value === null || value === undefined)) return '';
    return `
        <div class="atomic-repo-transfer-summary mt-2" aria-label="Επίλυση εβδομαδιαίων ρεπό">
            ${fields.map(([label, value]) => `
                <div class="atomic-repo-transfer-summary-item">
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value ?? '-')}</strong>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAtomicRepoTransferItem(item = {}, role) {
    const isSource = role === 'SOURCE_BECOMES_WORK';
    const proposedValues = item.proposed_values || {};
    const title = isSource
        ? 'Ημέρα που γίνεται εργασία — μη προδηλωμένη εργασία με κάρτες, Προτείνεται ΕΡΓ'
        : `Ημέρα που γίνεται ρεπό — προδηλωμένη εργασία χωρίς κάρτες, Προτείνεται ${proposedValues.kathgoria_ergasias_apologistika || 'ΑΝ'}`;
    const panelClass = isSource
        ? 'atomic-repo-transfer-source'
        : 'atomic-repo-transfer-target';
    const declaredCategory = item.kathgoria_ergasias || '-';
    const displayedCategory =
        item.current_kathgoria_ergasias_apologistika || '-';
    const proposedCategory =
        proposedValues.kathgoria_ergasias_apologistika || '-';
    const proposedHours = formatAtomicRepoTransferHours(
        proposedValues.ores_ergasias_apologistika
    );

    return `
        <section class="atomic-repo-transfer-day ${escapeHtml(panelClass)}">
            <div class="atomic-repo-transfer-day-title">${escapeHtml(title)}</div>
            <div class="atomic-repo-transfer-date">
                ${escapeHtml(formatPolicyPreviewDate(item.hmeromhnia))}
            </div>
            <div class="small text-muted mb-2">
                Εργαζόμενος: ${escapeHtml(item.employee_kodikos || '-')}
            </div>
            <dl class="atomic-repo-transfer-values">
                <div>
                    <dt>Προδηλωμένη κατηγορία</dt>
                    <dd>${escapeHtml(declaredCategory)}</dd>
                </div>
                <div>
                    <dt>Απολογιστική/εμφανιζόμενη κατηγορία</dt>
                    <dd>${escapeHtml(displayedCategory)}</dd>
                </div>
                <div>
                    <dt>Προτεινόμενη κατηγορία</dt>
                    <dd>${escapeHtml(proposedCategory)}</dd>
                </div>
                <div>
                    <dt>Ρεπό απολογιστικά</dt>
                    <dd>${escapeHtml(
                        formatAtomicRepoTransferBoolean(proposedValues.repo_apologistika)
                    )}</dd>
                </div>
                <div>
                    <dt>Ώρες</dt>
                    <dd>${escapeHtml(proposedHours)}</dd>
                </div>
            </dl>
            ${renderAtomicRepoTransferIntervals(proposedValues)}
        </section>
    `;
}

const atomicRepoTransferDiagnosticLabels = Object.freeze({
    PARTIAL_WEEK_OUTSIDE_FILTER_RANGE:
        'Το επιλεγμένο διάστημα κόβει ήδη ολοκληρωμένη εβδομάδα.',
    OPEN_WEEK_PENDING_COMPLETION:
        'Η τελευταία εβδομάδα δεν έχει ακόμη ολοκληρωθεί και θα επανελεγχθεί μετά την Κυριακή.',
    CROSS_MONTH_REPO_TRANSFER_NOT_ALLOWED:
        'Η μεταφορά ρεπό δεν επιτρέπεται ανάμεσα σε ημέρες διαφορετικών μηνών.',
    NO_SOURCE_CANDIDATE:
        'Δεν βρέθηκε ημέρα ρεπό κατά την οποία ο εργαζόμενος απασχολήθηκε.',
    REPO_DEFICIT_REMAINS:
        'Η προτεινόμενη αλλαγή δεν αποκαθιστά τον απαιτούμενο αριθμό ρεπό.',
    INCOMPLETE_EMPLOYEE_WEEK: 'Δεν υπάρχουν πλήρη στοιχεία για ολόκληρη την εβδομάδα.',
    ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED:
        'Η περίπτωση εκ περιτροπής απασχόλησης δεν δρομολογήθηκε στην απαιτούμενη πολιτική v2.',
    NO_TARGET_CANDIDATE: 'Δεν βρέθηκε διαθέσιμη ημέρα για τη μεταφορά του ρεπό.',
    NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS:
        'Βρέθηκε μη προγραμματισμένη εργασία με κάρτες, αλλά όχι αντισταθμιστική προδηλωμένη ημέρα χωρίς κάρτες.',
    INVALID_EFFECTIVE_WEEKLY_WORKDAYS:
        'Δεν είναι δυνατό να επιβεβαιωθεί αν η σύμβαση προβλέπει πενθήμερη ή εξαήμερη εργασία.',
    PROFILE_CHANGED_INSIDE_WEEK:
        'Οι κρίσιμοι όροι εργασίας άλλαξαν μέσα στην εβδομάδα Δευτέρα–Κυριακή και απαιτείται απόφαση HR.',
    MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE:
        'Το ημερομηνιακά ισχύον ποσοστό προσαύξησης 6ης ημέρας λείπει ή δεν είναι έγκυρο.',
    ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION:
        'Το ποσοστό προσαύξησης 6ης ημέρας είναι μηδενικό, αλλά δεν τεκμηριώνεται επιτρεπόμενη ειδική κατηγορία εξαίρεσης.',
    SIXTH_DAY_CANDIDATE_NOT_DETERMINISTIC:
        'Δεν μπορεί να προσδιοριστεί με ασφάλεια η 6η ημέρα από τις δηλωμένες ώρες και τις ώρες καρτών.',
    INCOMPLETE_CARD_INTERVAL:
        'Υπάρχει ασύζευκτο χτύπημα κάρτας· δεν έγινε απολογιστικός υπολογισμός.',
    SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT:
        'ΣΗΜΑΝΤΙΚΟ: Η επιλεγμένη 6η ημέρα υπερβαίνει τις οκτώ πραγματικές ώρες.',
    SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION:
        'ΣΗΜΑΝΤΙΚΗ ΠΑΡΑΒΑΣΗ: Διαπιστώθηκε πραγματική απασχόληση και κατά την 7η ημέρα της εβδομάδας, κατά παράβαση των όρων της σύμβασης εργασίας.',
    MIXED_WORK_AND_HOURLY_LEAVE:
        'Υπάρχει μικτή πραγματική εργασία και ωροάδεια την ίδια ημέρα.',
    MIXED_WORK_AND_SICKNESS:
        'Υπάρχει μικτή πραγματική εργασία και ασθένεια την ίδια ημέρα.',
    MULTIPLE_SOURCE_CANDIDATES:
        'Βρέθηκαν περισσότερες από μία πιθανές ημέρες εργασίας σε δηλωμένο ρεπό και απαιτείται επιλογή.',
    MULTIPLE_TARGET_CANDIDATES:
        'Βρέθηκαν περισσότερες από μία προδηλωμένες ημέρες χωρίς κάρτες. Απαιτείται έλεγχος πριν επιλεγεί ημέρα ρεπό.',
    REPO_LIMIT_EXCEEDED:
        'Η αλλαγή θα υπερέβαινε τον προβλεπόμενο αριθμό ημερών ρεπό της εβδομάδας.',
    TARGET_LOCKED: 'Η προτεινόμενη ημέρα ρεπό είναι κλειδωμένη.',
    TARGET_MANUAL_OVERRIDE:
        'Η προτεινόμενη ημέρα ρεπό έχει ήδη χειροκίνητη αλλαγή ή καταγεγραμμένο έλεγχο.',
    TARGET_LEAVE_OR_SICKNESS:
        'Η προτεινόμενη ημέρα ρεπό έχει άδεια ή ασθένεια.',
    TARGET_HOLIDAY: 'Η προτεινόμενη ημέρα ρεπό συμπίπτει με αργία που εμποδίζει την αλλαγή.',
    SOURCE_LOCKED: 'Η ημέρα εργασίας με κάρτες είναι κλειδωμένη.',
    SOURCE_MANUAL_OVERRIDE:
        'Η ημέρα εργασίας με κάρτες έχει ήδη χειροκίνητη αλλαγή ή καταγεγραμμένο έλεγχο.',
    SOURCE_LEAVE_OR_SICKNESS:
        'Η ημέρα εργασίας με κάρτες έχει άδεια ή ασθένεια.',
    SOURCE_HOLIDAY:
        'Η ημέρα εργασίας με κάρτες συμπίπτει με αργία που εμποδίζει την αλλαγή.',
    SOURCE_INVALID_CARD_EVIDENCE:
        'Τα στοιχεία καρτών της ημέρας εργασίας δεν είναι πλήρη ή συνεπή.',
    SOURCE_ALREADY_PROCESSED:
        'Η ημέρα εργασίας με κάρτες έχει ήδη ουσιαστικά απολογιστικά στοιχεία.',
    TARGET_ALREADY_PROCESSED:
        'Η προτεινόμενη ημέρα ρεπό έχει ήδη ουσιαστικά απολογιστικά στοιχεία.',
    TARGET_CONFLICTING_REPO_STATE:
        'Η προδηλωμένη ημέρα χωρίς κάρτες έχει αντικρουόμενη ένδειξη ρεπό.',
    TARGET_CONFLICTING_FACTS:
        'Τα στοιχεία της προδηλωμένης ημέρας χωρίς κάρτες δεν είναι συνεπή.',
    TARGET_CONFLICTING_APOLOGISTIKA_CATEGORY:
        'Η προδηλωμένη ημέρα χωρίς κάρτες έχει διαφορετική απολογιστική κατηγορία.',
    TARGET_INVALID_APOLOGISTIKA_NUMERIC_VALUE:
        'Η προδηλωμένη ημέρα χωρίς κάρτες έχει μη έγκυρη αριθμητική απολογιστική τιμή.',
    TARGET_ZERO_HOURS_WITH_CARD_INTERVALS:
        'Η προδηλωμένη ημέρα έχει μηδενικές συνολικές ώρες καρτών αλλά περιέχει πλήρες διάστημα κάρτας.',
    TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR:
        'Η προδηλωμένη ημέρα περιέχει ελλιπές ζεύγος εισόδου–εξόδου κάρτας.',
    TARGET_ZERO_HOURS_WITH_ZERO_LENGTH_CARD_INTERVAL:
        'Η ημέρα περιέχει ζεύγος κάρτας με ίδια ώρα εισόδου και εξόδου.',
    TARGET_INVALID_CARD_HOURS_VALUE:
        'Η συνολική τιμή ωρών καρτών της ημέρας δεν είναι έγκυρη.',
    TARGET_INVALID_CARD_TIME_VALUE:
        'Η ημέρα περιέχει μη έγκυρη τιμή ώρας κάρτας.',
    UNSUPPORTED_EMPLOYMENT_TYPE:
        'Ο τύπος απασχόλησης δεν αναγνωρίζεται με ασφάλεια.',
    CROSS_WEEK_ROWS:
        'Τα στοιχεία εκτείνονται σε περισσότερες από μία φυσικές εβδομάδες.'
});

const atomicRepoTransferUnknownDiagnosticLabel = 'Άλλη περίπτωση που χρειάζεται έλεγχο.';

function getOpenTrailingWeekDiagnosticLabel() {
    const periodEnd = String(
        currentPolicyPreviewBaseParams?.get('eos_hmeromhnia') || ''
    ).trim();
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(periodEnd)
        ? new Date(`${periodEnd}T00:00:00.000Z`)
        : null;
    if (!endDate || Number.isNaN(endDate.getTime())) {
        return atomicRepoTransferDiagnosticLabels.OPEN_WEEK_PENDING_COMPLETION;
    }
    const day = endDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(endDate);
    weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    return `Η εβδομάδα ${formatPolicyPreviewDate(
        weekStart.toISOString().slice(0, 10)
    )}–${formatPolicyPreviewDate(
        weekEnd.toISOString().slice(0, 10)
    )} δεν έχει ακόμη ολοκληρωθεί και θα επανελεγχθεί μετά την Κυριακή.`;
}

function getAtomicRepoTransferDiagnosticLabel(code) {
    const normalizedCode = String(code || '').trim();
    if (normalizedCode === 'OPEN_WEEK_PENDING_COMPLETION') {
        return getOpenTrailingWeekDiagnosticLabel();
    }
    return atomicRepoTransferDiagnosticLabels[normalizedCode] ||
        atomicRepoTransferUnknownDiagnosticLabel;
}

function getAtomicRepoTransferDiagnosticEntries(reasonCounts = {}) {
    return Object.entries(reasonCounts || {})
        .map(([code, rawCount]) => ({
            code,
            count: Number(rawCount),
            label: getAtomicRepoTransferDiagnosticLabel(code),
            pendingCompletion: code === 'OPEN_WEEK_PENDING_COMPLETION'
        }))
        .filter(({ count }) => Number.isFinite(count) && count > 0)
        .sort((left, right) => {
            if (right.count !== left.count) return right.count - left.count;
            return left.label.localeCompare(right.label, 'el');
        });
}

function renderAtomicRepoTransferDiagnosticEntries(reasonCounts = {}) {
    const entries = getAtomicRepoTransferDiagnosticEntries(reasonCounts);

    if (entries.length === 0) return '';

    return `
        <div class="atomic-repo-transfer-diagnostic-summary">
            <div class="fw-semibold">Περιπτώσεις χωρίς αυτόματη πρόταση</div>
            <div class="small text-muted">
                Για τις παρακάτω περιπτώσεις δεν δημιουργήθηκε ασφαλής πρόταση μεταφοράς ρεπό:
            </div>
            <div class="atomic-repo-transfer-diagnostic-list">
                ${entries
                    .map(({ count, label, pendingCompletion }) => {
                        const countLabel = count === 1 ? 'περίπτωση' : 'περιπτώσεις';
                        return `<div class="atomic-repo-transfer-diagnostic-message${
                            pendingCompletion ? ' atomic-repo-transfer-pending-message' : ''
                        }">${
                            pendingCompletion
                                ? '<span class="badge text-bg-info me-2">Αναμονή ολοκλήρωσης</span>'
                                : ''
                        }${escapeHtml(count)} ${countLabel}: ${escapeHtml(label)}</div>`;
                    })
                    .join('')}
            </div>
        </div>
    `;
}

function renderAtomicRepoTransferDiagnostics(projection = {}) {
    const reasonCounts = projection.reason_counts || {};
    const warningCounts = projection.warning_counts || {};
    const warningMessages = [];

    if (getAtomicRepoTransferCount(warningCounts, 'TARGET_ZERO_HOURS_WITH_CARD_INTERVALS') > 0) {
        warningMessages.push(
            'Η ημέρα-στόχος έχει μηδενικές συνολικές ώρες αλλά περιέχει στοιχεία καρτών. Η πρόταση παραμένει μόνο για ανθρώπινο έλεγχο.'
        );
    }

    if (
        getAtomicRepoTransferDiagnosticEntries(reasonCounts).length === 0 &&
        warningMessages.length === 0
    ) {
        return '';
    }

    return `
        <div class="atomic-repo-transfer-diagnostics">
            ${renderAtomicRepoTransferDiagnosticEntries(reasonCounts)}
            ${warningMessages
                .map(
                    (message) =>
                        `<div class="atomic-repo-transfer-warning">${escapeHtml(message)}</div>`
                )
                .join('')}
        </div>
    `;
}

function getAtomicRepoTransferWarningMessage(code) {
    if (code === 'TARGET_ZERO_HOURS_WITH_CARD_INTERVALS') {
        return 'Η ημέρα-στόχος έχει μηδενικές συνολικές ώρες αλλά περιέχει στοιχεία καρτών. Η πρόταση παραμένει μόνο για ανθρώπινο έλεγχο.';
    }
    return 'Η πρόταση περιέχει προειδοποίηση και παραμένει μόνο για ανθρώπινο έλεγχο.';
}

const atomicReusableBlockingDiagnostics = new Set([
    'ATOMIC_LINKED_SET_ROW_OVERLAP',
    'ATOMIC_REUSABLE_MULTIPLE_ACTIVE_MATCHES',
    'ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED',
    'ATOMIC_LINKED_SET_CONTRACT_INVALID',
    'ATOMIC_LINKED_SET_POLICY_CONTEXT_INCOMPLETE',
    'ATOMIC_LINKED_SET_PROFILE_CONTEXT_INCOMPLETE',
    'ATOMIC_LINKED_SET_MEMBER_INELIGIBLE'
]);

function atomicReusableDiagnosticMessage(code) {
    const messages = {
        ATOMIC_LINKED_SET_ROW_OVERLAP:
            'Η ίδια ημέρα συμμετέχει σε περισσότερες από μία προτάσεις. Απαιτείται χειροκίνητος έλεγχος όλων των προτάσεων.',
        ATOMIC_REUSABLE_MULTIPLE_ACTIVE_MATCHES:
            'Βρέθηκαν πολλαπλές ενεργές πολιτικές για την ίδια περίπτωση. Απαιτείται επίλυση από HR.',
        ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED:
            'Δεν επιβεβαιώθηκε με ασφάλεια το παράρτημα της ημέρας προέλευσης.',
        ATOMIC_LINKED_SET_MEMBER_INELIGIBLE:
            'Ένα από τα δύο συνδεδεμένα μέλη δεν είναι διαθέσιμο για επαναχρησιμοποιήσιμη έγκριση.'
    };
    return messages[code] ||
        'Η συνδεδεμένη πρόταση δεν είναι κατάλληλη για μελλοντική επαναχρησιμοποιήσιμη έγκριση.';
}

function renderAtomicReusableDecision(group = {}) {
    const reusable = group.reusable_decision || {};
    if (group.status !== 'RESOLVED_BY_POLICY' || !reusable.approval_id) return '';
    const effectiveTo = reusable.effective_to
        ? formatPolicyPreviewDate(reusable.effective_to)
        : 'Χωρίς λήξη';
    const revoke = userCanManageReusablePolicyApproval()
        ? `<button type="button" class="btn btn-sm btn-outline-danger policy-preview-revoke-btn" data-approval-id="${escapeHtml(reusable.approval_id)}">Ανάκληση πολιτικής</button>`
        : '';
    return `
        <div class="atomic-repo-transfer-reusable-resolution">
            <div class="fw-semibold">Εγκρίθηκε βάσει παλιότερης απόφασης HR</div>
            <div class="small">Εγκρίθηκε από: ${escapeHtml(reusable.approved_by_user_name || 'HR')}</div>
            <div class="small">Ημερομηνία έγκρισης: ${escapeHtml(formatPolicyPreviewDateTime(reusable.approved_at))}</div>
            <div class="small">Ισχύει από: ${escapeHtml(formatPolicyPreviewDate(reusable.effective_from))}</div>
            <div class="small">Λήξη: ${escapeHtml(effectiveTo)}</div>
            <div class="small">Έκδοση επαναχρησιμοποιήσιμου αποτυπώματος: ${escapeHtml(reusable.fingerprint_version || 5)}</div>
            <div class="small text-muted mt-1">Η έγκριση βάσει παλιότερης πολιτικής δεν εφαρμόζει αυτόματα τη μεταφορά. Για την εφαρμογή απαιτείται νέα καταγεγραμμένη απόφαση για την τρέχουσα πρόταση.</div>
            <div class="mt-2">${revoke}</div>
        </div>
    `;
}

function renderAtomicRepoTransferGroup(group = {}, index = 0) {
    const items = Array.isArray(group.items) ? group.items : [];
    const source = items.find((item) => item?.role === 'SOURCE_BECOMES_WORK') || {};
    const target = items.find((item) => item?.role === 'TARGET_BECOMES_REPO') || {};
    const employeeCode = source.employee_kodikos || target.employee_kodikos || '-';
    const warnings = Array.isArray(group.warnings) ? group.warnings : [];
    const isExpanded = index === 0;
    const detailsId = `atomicRepoTransferPair-${index}`;
    const decisionState = currentRepoTransferDecisionsByProposalId.get(String(group.group_id || '')) || null;
    const recordedDecision = decisionState?.current_decision || null;
    const selectedBranch = String(currentPolicyPreviewBaseParams?.get('ypokatasthma') || '').trim();
    const hasSpecificBranch = selectedBranch !== '' && selectedBranch.toUpperCase() !== 'ALL' && !selectedBranch.includes(',');
    const isResolvedByReusable = group.status === 'RESOLVED_BY_POLICY' &&
        Boolean(group.reusable_decision?.approval_id);
    const reusableDiagnostics = Array.isArray(group.atomic_reusable_diagnostics)
        ? group.atomic_reusable_diagnostics
        : [];
    const blockingReusableDiagnostics = reusableDiagnostics.filter((code) =>
        atomicReusableBlockingDiagnostics.has(code)
    );
    const canOfferAtomicReusable = !isResolvedByReusable &&
        group.status === 'NEEDS_REVIEW' &&
        group.decision_grain === 'ATOMIC_LINKED_SET' &&
        blockingReusableDiagnostics.length === 0 &&
        userCanManageReusablePolicyApproval() &&
        hasSpecificBranch &&
        !recordedDecision;
    const decisionLabels = {
        APPROVE_PROPOSAL: 'Έγκριση πρότασης',
        REJECT_PROPOSAL: 'Απόρριψη πρότασης',
        NEEDS_MORE_REVIEW: 'Χρειάζεται περαιτέρω έλεγχο'
    };
    const recordedDecisionHtml = recordedDecision
        ? `<div class="atomic-repo-transfer-decision-recorded">
               <div class="fw-semibold">Η απόφαση έχει ήδη καταγραφεί.</div>
               <div class="small">Απόφαση: ${escapeHtml(decisionLabels[recordedDecision.decision_code] || '-')}</div>
               <div class="small">Χρήστης: ${escapeHtml(recordedDecision.created_by_user_name || '-')} · ${escapeHtml(formatPolicyPreviewDateTime(recordedDecision.created_at))}</div>
               ${recordedDecision.notes ? `<div class="small">Σημειώσεις: ${escapeHtml(recordedDecision.notes)}</div>` : ''}
           </div>`
        : '<div class="small text-muted">Δεν έχει καταγραφεί απόφαση για αυτή την πρόταση.</div>';
    const isCurrentApproval = recordedDecision?.decision_code === 'APPROVE_PROPOSAL';
    const applyState = String(decisionState?.apply_state || 'NOT_APPROVED');
    const staleDecisionHtml = applyState === 'STALE_DECISION'
        ? '<div class="small text-warning-emphasis mt-2">Η προηγούμενη έγκριση δεν ισχύει πλέον, επειδή τα δεδομένα της πρότασης έχουν αλλάξει. Απαιτείται νέος έλεγχος και νέα απόφαση.</div>'
        : '';
    const applyMessages = {
        RUNTIME_DISABLED: 'Η εφαρμογή δεν είναι ακόμη ενεργοποιημένη.',
        INDEXES_NOT_READY: 'Η ασφαλής εφαρμογή δεν είναι ακόμη διαθέσιμη.',
        NOT_AUTHORIZED: 'Δεν έχετε δικαίωμα εφαρμογής εγκεκριμένης πρότασης.',
        ALREADY_APPLIED: 'Η εγκεκριμένη μεταφορά έχει ήδη εφαρμοστεί.',
        STALE_DECISION: 'Τα δεδομένα έχουν αλλάξει μετά την έγκριση και απαιτείται νέος έλεγχος.',
        NOT_APPROVED: 'Η πρόταση δεν έχει εγκεκριμένη απόφαση.'
    };
    const serverCanApply = decisionState?.can_apply === true;
    const canApply = userCanApplyRepoTransferDecision() && serverCanApply && hasSpecificBranch;
    const applyHtml = applyState === 'ALREADY_APPLIED' && decisionState?.current_execution
        ? `<div class="mt-2"><span class="badge text-bg-success">Η πρόταση εφαρμόστηκε</span><span class="small ms-2">${escapeHtml(formatPolicyPreviewDateTime(decisionState.current_execution.applied_at))}${decisionState.current_execution.created_by_user_name ? ` · ${escapeHtml(decisionState.current_execution.created_by_user_name)}` : ''}</span></div>`
        : !isCurrentApproval ? '' : !canApply
        ? `<div class="small text-muted mt-2">${escapeHtml(applyMessages[applyState] || 'Η εγκεκριμένη πρόταση δεν είναι διαθέσιμη για εφαρμογή.')}</div>`
        : `<div class="mt-2">
               <button type="button" class="btn btn-sm policy-preview-decision-success atomic-repo-transfer-apply-btn" data-atomic-group-index="${escapeHtml(index)}" data-decision-id="${escapeHtml(recordedDecision?.id || '')}">Εφαρμογή εγκεκριμένης μεταφοράς</button>
           </div>`;
    const olderDecisions = Array.isArray(decisionState?.history)
        ? decisionState.history.filter((decision) => decision?.is_current !== true)
        : [];
    const previousDecisionHistory = olderDecisions.length > 0
        ? `<details class="atomic-repo-transfer-previous-decisions mt-2">
               <summary class="small fw-semibold">Προηγούμενες καταγεγραμμένες αποφάσεις (${escapeHtml(olderDecisions.length)})</summary>
               <div class="mt-2">
                   ${olderDecisions.map((decision) => `<div class="border-top pt-2 mt-2">
                       <div class="small">Απόφαση: ${escapeHtml(decisionLabels[decision.decision_code] || '-')}</div>
                       <div class="small">Χρήστης: ${escapeHtml(decision.created_by_user_name || '-')} · ${escapeHtml(formatPolicyPreviewDateTime(decision.created_at))}</div>
                       ${decision.notes ? `<div class="small">Σημειώσεις: ${escapeHtml(decision.notes)}</div>` : ''}
                   </div>`).join('')}
               </div>
           </details>`
        : '';
    const decisionButtons = !isResolvedByReusable && userCanRecordRepoTransferDecision() ? Object.entries(decisionLabels).map(([code, label]) => {
        const style = code === 'APPROVE_PROPOSAL' ? 'policy-preview-decision-success' : code === 'REJECT_PROPOSAL' ? 'policy-preview-decision-danger' : 'policy-preview-decision-warning';
        return `<button type="button" class="btn btn-sm ${style} atomic-repo-transfer-decision-btn" data-atomic-group-index="${escapeHtml(index)}" data-decision-code="${escapeHtml(code)}" ${recordedDecision || !hasSpecificBranch ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(label)}</button>`;
    }).join('') : '';
    const reusableApprovalButton = canOfferAtomicReusable
        ? `<button type="button" class="btn btn-sm btn-outline-success atomic-repo-transfer-reusable-btn" data-atomic-group-index="${escapeHtml(index)}">Έγκριση πρότασης για μελλοντική εφαρμογή</button>`
        : '';
    const reusableDiagnosticHtml = blockingReusableDiagnostics.length
        ? `<div class="atomic-repo-transfer-group-warnings mt-2">${blockingReusableDiagnostics
              .map((code) => `<div class="atomic-repo-transfer-warning" data-diagnostic-code="${escapeHtml(code)}">${escapeHtml(atomicReusableDiagnosticMessage(code))}</div>`)
              .join('')}</div>`
        : '';
    return `
        <article class="atomic-repo-transfer-group" data-atomic-group-id="${escapeHtml(
            group.group_id || ''
        )}">
            <div class="atomic-repo-transfer-group-header">
                <div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <span class="badge ${isResolvedByReusable ? 'text-bg-success' : 'text-bg-warning'}">${isResolvedByReusable ? 'Επιλύθηκε από επαναχρησιμοποιήσιμη πολιτική' : 'Πρόταση προς έλεγχο από HR'}</span>
                        <span class="fw-semibold">Συνδεδεμένη πρόταση μεταφοράς ρεπό</span>
                    </div>
                    <div class="small text-muted">
                        Εργαζόμενος: ${escapeHtml(employeeCode)} · Ημερομηνίες πρότασης:
                        ${escapeHtml(formatPolicyPreviewDate(group.first_date))}–${escapeHtml(
                            formatPolicyPreviewDate(group.last_date)
                        )}
                    </div>
                    <div class="atomic-repo-transfer-safety-flags">
                        <span>Μία απόφαση / δύο συνδεδεμένες αλλαγές</span>
                        <span>Απαιτείται απόφαση HR</span>
                        <span>Καμία αλλαγή δεν γίνεται από την προεπισκόπηση.</span>
                    </div>
                </div>
                <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary atomic-repo-transfer-toggle"
                    data-atomic-target-id="${escapeHtml(detailsId)}"
                    aria-expanded="${String(isExpanded)}">
                    ${isExpanded ? 'Απόκρυψη ζεύγους' : 'Προβολή ζεύγους'}
                </button>
            </div>
            ${
                warnings.length > 0
                    ? `<div class="atomic-repo-transfer-group-warnings">${warnings
                          .map(
                              (warning) => `
                                  <div class="atomic-repo-transfer-warning">
                                      ${escapeHtml(getAtomicRepoTransferWarningMessage(warning))}
                                  </div>
                              `
                          )
                          .join('')}</div>`
                    : ''
            }
            ${renderAtomicRepoTransferResolution(group)}
            ${reusableDiagnosticHtml}
            <div
                class="atomic-repo-transfer-pair ${isExpanded ? '' : 'd-none'}"
                id="${escapeHtml(detailsId)}">
                <div class="atomic-repo-transfer-pair-grid">
                    ${renderAtomicRepoTransferItem(source, 'SOURCE_BECOMES_WORK')}
                    ${renderAtomicRepoTransferItem(target, 'TARGET_BECOMES_REPO')}
                </div>
            </div>
            <div class="policy-preview-approval-panel mt-2">
                <div class="small fw-semibold mb-1">Απόφαση για ολόκληρη τη συνδεδεμένη πρόταση</div>
                ${hasSpecificBranch ? '' : '<div class="small text-warning-emphasis mb-2">Για την καταγραφή απόφασης επιλέξτε συγκεκριμένο υποκατάστημα.</div>'}
                ${isResolvedByReusable ? renderAtomicReusableDecision(group) : recordedDecisionHtml}
                ${staleDecisionHtml}
                ${previousDecisionHistory}
                <div class="policy-preview-decision-actions mt-2">${decisionButtons}${reusableApprovalButton}</div>
                ${applyHtml}
            </div>
        </article>
    `;
}

function bindAtomicRepoTransferEvents(container) {
    container.querySelectorAll('.atomic-repo-transfer-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.atomicTargetId;
            const target = targetId ? document.getElementById(targetId) : null;
            if (!target) return;

            const isOpen = !target.classList.contains('d-none');
            target.classList.toggle('d-none', isOpen);
            button.setAttribute('aria-expanded', String(!isOpen));
            button.textContent = isOpen ? 'Προβολή ζεύγους' : 'Απόκρυψη ζεύγους';
        });
    });
    container.querySelectorAll('.atomic-repo-transfer-decision-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const group = currentAtomicRepoTransferProjection?.groups?.[Number(button.dataset.atomicGroupIndex)];
            if (!group) return;
            try { await submitRepoTransferDecision(group, String(button.dataset.decisionCode || '')); }
            catch (error) { await Swal.fire({ icon: 'error', title: 'Δεν καταγράφηκε η απόφαση', text: error.message || 'Παρουσιάστηκε σφάλμα.' }); }
        });
    });
    container.querySelectorAll('.atomic-repo-transfer-reusable-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const group = currentAtomicRepoTransferProjection?.groups?.[
                Number(button.dataset.atomicGroupIndex)
            ];
            if (!group) return;
            try {
                await submitPolicyPreviewDecision(group, 'APPROVE_PROPOSAL', {
                    forceAtomicReuse: true
                });
            } catch (error) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Δεν καταγράφηκε η επαναχρησιμοποιήσιμη έγκριση',
                    text: error.message || 'Παρουσιάστηκε σφάλμα.'
                });
            }
        });
    });
    container.querySelectorAll('.atomic-repo-transfer-apply-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const group = currentAtomicRepoTransferProjection?.groups?.[Number(button.dataset.atomicGroupIndex)];
            if (!group || button.disabled) return;
            await submitRepoTransferApply(group, String(button.dataset.decisionId || ''), button);
        });
    });
}

function repoTransferDecisionRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `repo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function refreshRepoTransferDecisions() {
    if (!currentPolicyPreviewBaseParams) {
        currentRepoTransferDecisionsByProposalId = new Map();
        return;
    }
    const selectedBranch = String(
        currentPolicyPreviewBaseParams.get('ypokatasthma') || ''
    ).trim();
    if (
        !selectedBranch ||
        selectedBranch.toUpperCase() === 'ALL' ||
        selectedBranch.includes(',')
    ) {
        currentRepoTransferDecisionsByProposalId = new Map();
        return;
    }
    const params = new URLSearchParams({
        apo_hmeromhnia: currentPolicyPreviewBaseParams.get('apo_hmeromhnia') || '',
        eos_hmeromhnia: currentPolicyPreviewBaseParams.get('eos_hmeromhnia') || '',
        ypokatasthma: selectedBranch,
        kodikos: currentPolicyPreviewBaseParams.get('kodikos') || ''
    });
    currentRepoTransferDecisionsByProposalId = new Map();
    const response = await fetch(`/api/prodhlomena-oraria/review/repo-transfer-decisions/current?${params}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'CSRF-Token': csrfToken }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Δεν ήταν δυνατή η ανάκτηση των αποφάσεων.');
    }
    currentRepoTransferDecisionsByProposalId = new Map(
        (payload.records || []).map((record) => [String(record.proposal_id || ''), record])
    );
}

async function submitRepoTransferDecision(group, decisionCode, options = {}) {
    if (!userCanRecordRepoTransferDecision()) return;
    const proposalId = String(group?.group_id || '');
    if (!proposalId || repoTransferDecisionSubmitting.has(proposalId)) return;
    const selectedBranch = String(currentPolicyPreviewBaseParams?.get('ypokatasthma') || '').trim();
    if (!selectedBranch || selectedBranch.toUpperCase() === 'ALL' || selectedBranch.includes(',')) {
        throw new Error('Για την καταγραφή απόφασης επιλέξτε συγκεκριμένο υποκατάστημα.');
    }
    const source = group.items?.find((item) => item.role === 'SOURCE_BECOMES_WORK');
    const target = group.items?.find((item) => item.role === 'TARGET_BECOMES_REPO');
    if (!source || !target || !group.pair_contract) throw new Error('Η συνδεδεμένη πρόταση δεν είναι διαθέσιμη.');
    const labels = { APPROVE_PROPOSAL: 'Έγκριση πρότασης', REJECT_PROPOSAL: 'Απόρριψη πρότασης', NEEDS_MORE_REVIEW: 'Χρειάζεται περαιτέρω έλεγχο' };
    if (!labels[decisionCode]) throw new Error('Η απόφαση δεν υποστηρίζεται.');
    const isHrMode = options.mode === 'hr';
    const hrConfirmations = {
        APPROVE_PROPOSAL: {
            title: 'Αποδοχή πρότασης',
            text: 'Θέλετε να αποδεχθείτε την προτεινόμενη αλλαγή;'
        },
        REJECT_PROPOSAL: {
            title: 'Δεν ισχύει',
            text: 'Θέλετε να καταγράψετε ότι η πρόταση δεν ισχύει;'
        },
        NEEDS_MORE_REVIEW: {
            title: 'Χρειάζομαι οδηγία',
            text: ''
        }
    };
    const confirmationOptions = isHrMode
        ? {
              icon: 'warning',
              title: hrConfirmations[decisionCode].title,
              text: hrConfirmations[decisionCode].text,
              ...(decisionCode === 'NEEDS_MORE_REVIEW'
                  ? {
                        input: 'textarea',
                        inputLabel: 'Τι χρειάζεται διευκρίνιση;',
                        inputAttributes: { maxlength: '2000' },
                        inputValidator: (value) =>
                            String(value || '').trim()
                                ? undefined
                                : 'Συμπληρώστε τι χρειάζεται διευκρίνιση.'
                    }
                  : {}),
              showCancelButton: true,
              confirmButtonText: 'Καταγραφή απόφασης',
              cancelButtonText: 'Άκυρο'
          }
        : { icon: 'warning', title: labels[decisionCode], html: '<div class="text-start"><div>Η απόφαση αφορά και τις δύο συνδεδεμένες αλλαγές της πρότασης.</div><div class="mt-2">Δεν θα εφαρμοστεί καμία αλλαγή στα Προδηλωμένα.</div></div>', input: 'textarea', inputLabel: 'Προαιρετικές σημειώσεις', inputAttributes: { maxlength: '2000' }, showCancelButton: true, confirmButtonText: 'Καταγραφή απόφασης', cancelButtonText: 'Άκυρο' };
    const confirmation = await Swal.fire(confirmationOptions);
    if (!confirmation.isConfirmed) return;
    repoTransferDecisionSubmitting.add(proposalId);
    try {
        const token = await getPolicyPreviewCsrfToken();
        const response = await fetch('/api/prodhlomena-oraria/review/repo-transfer-decisions', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': token, 'x-csrf-token': token }, body: JSON.stringify({ proposal_id: group.group_id, expected_source_id: source.prodhlomena_oraria_id, expected_target_id: target.prodhlomena_oraria_id, expected_proposal_version: group.pair_contract.proposal_version, expected_choice_code: group.pair_contract.choice_code, decision_code: decisionCode, notes: String(confirmation.value || '').trim(), request_id: repoTransferDecisionRequestId() }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(response.status === 409 ? 'Τα στοιχεία της πρότασης έχουν αλλάξει. Ανανεώστε τον έλεγχο πριν καταγράψετε απόφαση.' : payload.message || 'Δεν ήταν δυνατή η καταγραφή της απόφασης.');
        if (isHrMode) {
            try {
                await refreshRepoTransferDecisions();
            } catch (refreshError) {
                console.warn('[submitRepoTransferDecision] HR refresh unavailable:', refreshError);
                document
                    .querySelectorAll('#hrReviewPendingContainer .hr-review-decision-btn')
                    .forEach((button) => {
                        button.disabled = true;
                    });
                const status = document.getElementById('hrReviewStatus');
                if (status) {
                    status.className = 'hr-review-status hr-review-error-state';
                    status.textContent =
                        'Η απόφαση καταγράφηκε, αλλά η προβολή δεν ανανεώθηκε. Πατήστε ξανά «Έναρξη ελέγχου».';
                }
                await Swal.fire({
                    icon: 'warning',
                    title: 'Η απόφαση καταγράφηκε',
                    text: 'Η προβολή δεν ανανεώθηκε. Πατήστε ξανά «Έναρξη ελέγχου» για να δείτε την τρέχουσα κατάσταση.'
                });
                return;
            }
            classifyHrReviewGroups();
            renderHrReviewWorkspace();
            await Swal.fire({ icon: 'success', title: 'Η απόφαση καταγράφηκε' });
        } else {
            await refreshRepoTransferDecisions();
            renderPolicyPreviewGroups(currentPolicyPreviewGrouping, { atomicGroupProjection: currentAtomicRepoTransferProjection });
            await Swal.fire({ icon: 'success', title: 'Η απόφαση καταγράφηκε', text: 'Η απόφαση αφορά ολόκληρη τη συνδεδεμένη πρόταση. Δεν έγινε αλλαγή στα Προδηλωμένα.' });
        }
    } finally { repoTransferDecisionSubmitting.delete(proposalId); }
}

async function submitRepoTransferApply(group, decisionId, button) {
    if (!userCanApplyRepoTransferDecision()) return;
    if (!decisionId || repoTransferApplySubmitting.has(decisionId)) return;
    const decisionState = currentRepoTransferDecisionsByProposalId.get(String(group.group_id || ''));
    if (decisionState?.can_apply !== true || decisionState?.apply_state !== 'READY_TO_APPLY') return;
    repoTransferApplySubmitting.add(decisionId);
    button.disabled = true;
    const source = group.items?.find((item) => item.role === 'SOURCE_BECOMES_WORK') || {};
    const target = group.items?.find((item) => item.role === 'TARGET_BECOMES_REPO') || {};
    const employee = source.employee_name || target.employee_name || source.employee_kodikos || target.employee_kodikos || '-';
    const context = decisionState.apply_context || {};
    const proposedSource = source.proposed_values || {};
    const proposedTarget = target.proposed_values || {};
    const sourceIntervals = [1, 2, 3].map((number) => {
        const pair = pairNo(number);
        const start = String(proposedSource[`apo_ora_${pair}_apologistika`] || '').trim();
        const end = String(proposedSource[`eos_ora_${pair}_apologistika`] || '').trim();
        return start && end ? `${start}–${end}` : '';
    }).filter(Boolean);
    const confirmation = await Swal.fire({
        icon: 'warning', title: 'Εφαρμογή εγκεκριμένης μεταφοράς ρεπό',
        html: `<div class="text-start">
            <div><strong>Εργαζόμενος:</strong> ${escapeHtml(employee)}</div>
            <div><strong>Εβδομάδα:</strong> ${escapeHtml(formatPolicyPreviewDate(context.week_start))}–${escapeHtml(formatPolicyPreviewDate(context.week_end))}</div>
            <div><strong>Εταιρεία / παράρτημα:</strong> ${escapeHtml(context.company_kodikos || '-')} / ${escapeHtml(context.ypokatasthma || '-')}</div>
            <hr>
            <div><strong>Ημέρα προέλευσης:</strong> ${escapeHtml(formatPolicyPreviewDate(source.hmeromhnia))}</div>
            <div>Κατηγορία: ${escapeHtml(source.kathgoria_ergasias || '-')} → ${escapeHtml(proposedSource.kathgoria_ergasias_apologistika || '-')}</div>
            <div>Ώρες: ${escapeHtml(formatAtomicRepoTransferHours(proposedSource.ores_ergasias_apologistika))}</div>
            <div>Διαστήματα: ${escapeHtml(sourceIntervals.join(', ') || '—')}</div>
            <hr>
            <div><strong>Ημέρα στόχος:</strong> ${escapeHtml(formatPolicyPreviewDate(target.hmeromhnia))}</div>
            <div>Κατηγορία: ${escapeHtml(target.kathgoria_ergasias || '-')} → ${escapeHtml(proposedTarget.kathgoria_ergasias_apologistika || '-')}</div>
            <div class="mt-2 fw-semibold">Οι δύο αλλαγές θα αποθηκευτούν ως μία ενιαία πράξη. Αν κάποια από τις δύο δεν μπορεί να εφαρμοστεί με ασφάλεια, δεν θα αποθηκευτεί καμία.</div>
        </div>`,
        showCancelButton: true, confirmButtonText: 'Εφαρμογή μεταφοράς', cancelButtonText: 'Άκυρο',
        confirmButtonColor: '#d1e7dd', cancelButtonColor: '#6c757d', customClass: { confirmButton: 'text-black' }
    });
    if (!confirmation.isConfirmed) {
        repoTransferApplySubmitting.delete(decisionId);
        button.disabled = false;
        return;
    }
    let payload;
    const requestId = repoTransferApplyRequestIds.get(decisionId) || repoTransferDecisionRequestId();
    repoTransferApplyRequestIds.set(decisionId, requestId);
    let responseReceived = false;
    try {
        Swal.fire({ title: 'Εφαρμογή εγκεκριμένης μεταφοράς…', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => Swal.showLoading() });
        const token = await getPolicyPreviewCsrfToken();
        let response;
        try {
            response = await fetch(`/api/prodhlomena-oraria/review/repo-transfer-decisions/${encodeURIComponent(decisionId)}/apply`, {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': token, 'x-csrf-token': token },
                body: JSON.stringify({ request_id: requestId })
            });
        } catch {
            throw new Error('Δεν είναι βέβαιο αν η αποστολή ολοκληρώθηκε. Δοκιμάστε ξανά· θα χρησιμοποιηθεί ο ίδιος ασφαλής αναγνωριστικός αριθμός.');
        }
        responseReceived = true;
        payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.message || 'Η εφαρμογή δεν ολοκληρώθηκε.');
        repoTransferApplyRequestIds.delete(decisionId);
    } catch (error) {
        Swal.close();
        if (responseReceived) repoTransferApplyRequestIds.delete(decisionId);
        await Swal.fire({ icon: 'error', title: 'Δεν εφαρμόστηκε η πρόταση', text: String(error.message || 'Η εφαρμογή δεν ολοκληρώθηκε.') });
        const state = currentRepoTransferDecisionsByProposalId.get(String(group.group_id || ''));
        if (state?.can_apply === true && state?.apply_state === 'READY_TO_APPLY') button.disabled = false;
        repoTransferApplySubmitting.delete(decisionId);
        return;
    }

    Swal.close();
    try {
        await refreshRepoTransferDecisions();
        const refreshedState = currentRepoTransferDecisionsByProposalId.get(String(group.group_id || ''));
        if (
            refreshedState?.apply_state !== 'ALREADY_APPLIED' ||
            refreshedState?.current_execution?.execution_status !== 'APPLIED'
        ) {
            throw new Error('Η νέα κατάσταση δεν επιβεβαιώθηκε από τον server.');
        }
        renderPolicyPreviewGroups(currentPolicyPreviewGrouping, { atomicGroupProjection: currentAtomicRepoTransferProjection });
        if (currentHrReviewLoaded) {
            classifyHrReviewGroups();
            renderHrReviewWorkspace();
        }
        await Swal.fire({ icon: 'success', title: 'Η μεταφορά ρεπό εφαρμόστηκε επιτυχώς.', text: payload.message || '' });
    } catch {
        await Swal.fire({
            icon: 'warning',
            title: 'Απαιτείται ανανέωση κατάστασης',
            text: 'Ο server δέχθηκε το αίτημα, αλλά η προβολή δεν επιβεβαίωσε την ολοκλήρωση. Ανανεώστε τη σελίδα πριν από οποιαδήποτε νέα ενέργεια.'
        });
    } finally {
        repoTransferApplySubmitting.delete(decisionId);
    }
}

function userCanUseAdvancedEmploymentReview() {
    return document.getElementById('canUseAdvancedEmploymentReview')?.value === '1';
}

function getHrSelectedBranch() {
    const hiddenValue = String(
        document.getElementById('ypokatasthmata_stathera')?.value || ''
    ).trim();
    if (hiddenValue) return hiddenValue;

    const select = document.getElementById('ypokatasthmata');
    const tomValue = select?.tomselect?.getValue?.();
    return String(tomValue || select?.value || '').trim();
}

function isHrReviewGroupCompleted(group = {}) {
    const decisionState = currentRepoTransferDecisionsByProposalId.get(
        String(group.group_id || '')
    );

    return Boolean(
        group.status === 'RESOLVED_BY_POLICY' && group.reusable_decision?.approval_id ||
            decisionState?.current_decision ||
            decisionState?.apply_state === 'ALREADY_APPLIED' ||
            decisionState?.current_execution?.execution_status === 'APPLIED'
    );
}

function classifyHrReviewGroups() {
    const groups = Array.isArray(currentHrReviewProjection?.groups)
        ? currentHrReviewProjection.groups
        : [];

    currentHrPendingGroups = groups.filter((group) => !isHrReviewGroupCompleted(group));
    currentHrCompletedGroups = groups.filter((group) => isHrReviewGroupCompleted(group));
}

function renderHrReviewProgress() {
    const progress = document.getElementById('hrReviewProgress');
    if (!progress) return;

    const total = currentHrPendingGroups.length + currentHrCompletedGroups.length;
    progress.classList.toggle('d-none', !currentHrReviewLoaded || total === 0);
    progress.innerHTML = total > 0
        ? `<div><strong>${escapeHtml(total)}</strong> περιπτώσεις χρειάζονται απόφαση</div>
           <div>Ολοκληρώθηκαν <strong>${escapeHtml(currentHrCompletedGroups.length)}</strong> από <strong>${escapeHtml(total)}</strong></div>`
        : '';
}

function renderHrReviewIntervals(proposedValues = {}) {
    return [1, 2, 3]
        .map((number) => {
            const pair = pairNo(number);
            const start = String(proposedValues[`apo_ora_${pair}_apologistika`] || '').trim();
            const end = String(proposedValues[`eos_ora_${pair}_apologistika`] || '').trim();
            const interval = start && end ? `${start}–${end}` : '—';
            return `<div><span>Ωράριο ${escapeHtml(pair)}</span><strong>${escapeHtml(interval)}</strong></div>`;
        })
        .join('');
}

function renderHrReviewDay(item = {}, kind) {
    const proposedValues = item.proposed_values || {};
    const isWorkDay = kind === 'work';
    const proposedCategory =
        proposedValues.kathgoria_ergasias_apologistika || '-';
    const displayedCategory =
        item.current_kathgoria_ergasias_apologistika || '-';
    const hoursHtml = isWorkDay
        ? `<div><span>Προτεινόμενες ώρες</span><strong>${escapeHtml(
              formatAtomicRepoTransferHours(proposedValues.ores_ergasias_apologistika)
          )}</strong></div>`
        : '';

    return `
        <section class="hr-review-day hr-review-day-${isWorkDay ? 'work' : 'rest'}">
            <h5>${isWorkDay ? 'Ημέρα που θα καταχωριστεί ως εργασία' : 'Ημέρα που θα καταχωριστεί ως ρεπό'}</h5>
            <div class="hr-review-day-date">${escapeHtml(formatPolicyPreviewDate(item.hmeromhnia))}</div>
            <div class="hr-review-day-values">
                <div><span>Προδηλωμένη</span><strong>${escapeHtml(item.kathgoria_ergasias || '-')}</strong></div>
                <div><span>Απολογιστική</span><strong>${escapeHtml(displayedCategory)}</strong></div>
                <div><span>Πρόταση μεταφοράς</span><strong>${escapeHtml(proposedCategory)}</strong></div>
                ${hoursHtml}
            </div>
            ${isWorkDay ? `<div class="hr-review-intervals">${renderHrReviewIntervals(proposedValues)}</div>` : ''}
        </section>
    `;
}

function renderHrPendingCase() {
    const container = document.getElementById('hrReviewPendingContainer');
    if (!container) return;

    if (currentHrPendingGroups.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = currentHrPendingGroups.map((group, groupIndex) => {
        const items = Array.isArray(group.items) ? group.items : [];
        const source = items.find((item) => item?.role === 'SOURCE_BECOMES_WORK') || {};
        const target = items.find((item) => item?.role === 'TARGET_BECOMES_REPO') || {};
        const employeeName = source.employee_name || target.employee_name || '';
        const employeeCode = source.employee_kodikos || target.employee_kodikos || '-';
        const decisionState = currentRepoTransferDecisionsByProposalId.get(String(group.group_id || '')) || {};
        const hasHistoricalApproval = Array.isArray(decisionState.history) &&
            decisionState.history.some(
                (decision) =>
                    decision?.decision_code === 'APPROVE_PROPOSAL' &&
                    decision?.is_current === false
            );
        const staleDecisionNotice =
            decisionState.apply_state === 'STALE_DECISION' && hasHistoricalApproval
                ? '<div class="alert alert-warning small mt-3 mb-3">Υπήρχε προηγούμενη έγκριση, αλλά τα δεδομένα της πρότασης έχουν αλλάξει. Ελέγξτε ξανά και καταγράψτε νέα απόφαση.</div>'
                : '';
        const selectedBranch = getHrSelectedBranch();
        const hasSpecificBranch = selectedBranch !== '' &&
            selectedBranch.toUpperCase() !== 'ALL' &&
            !selectedBranch.includes(',');
        const blockingReusableDiagnostics = (
            Array.isArray(group.atomic_reusable_diagnostics)
                ? group.atomic_reusable_diagnostics
                : []
        ).filter((code) => atomicReusableBlockingDiagnostics.has(code));
        const reusableWarning = blockingReusableDiagnostics.length
            ? `<div class="alert alert-warning small mt-3 mb-3">${escapeHtml(
                  atomicReusableDiagnosticMessage(blockingReusableDiagnostics[0])
              )}</div>`
            : '';
        const reusableAction = userCanManageReusablePolicyApproval() &&
            hasSpecificBranch && blockingReusableDiagnostics.length === 0
            ? `<button type="button" class="btn btn-outline-success hr-review-reusable-btn employment-review-action-btn">Έγκριση πρότασης για μελλοντική εφαρμογή</button>`
            : '';
        const decisionActions = userCanRecordRepoTransferDecision()
            ? `<div class="hr-review-decision-actions">
                   <button type="button" class="btn policy-preview-decision-success hr-review-decision-btn employment-review-action-btn employment-review-action-success" data-decision-code="APPROVE_PROPOSAL">Αποδοχή πρότασης</button>
                   <button type="button" class="btn policy-preview-decision-danger hr-review-decision-btn employment-review-action-btn employment-review-action-danger" data-decision-code="REJECT_PROPOSAL">Δεν ισχύει</button>
                   <button type="button" class="btn policy-preview-decision-warning hr-review-decision-btn employment-review-action-btn employment-review-action-warning" data-decision-code="NEEDS_MORE_REVIEW">Χρειάζομαι οδηγία</button>
                   ${reusableAction}
               </div>`
            : reusableAction
                ? `<div class="hr-review-decision-actions">${reusableAction}</div>`
                : '';
        return `<article class="hr-review-proposal-card" data-group-id="${escapeHtml(String(group.group_id || ''))}" data-group-index="${groupIndex}">
            <div class="hr-review-employee">
                ${employeeName ? `<h4>${escapeHtml(employeeName)}</h4>` : ''}
                <div>Κωδικός εργαζομένου: <strong>${escapeHtml(employeeCode)}</strong></div>
                <div>Ημερομηνίες: ${escapeHtml(formatPolicyPreviewDate(group.first_date))}–${escapeHtml(formatPolicyPreviewDate(group.last_date))}</div>
            </div>
            <div class="hr-review-days-grid">${renderHrReviewDay(source, 'work')}${renderHrReviewDay(target, 'rest')}</div>
            ${staleDecisionNotice}
            ${reusableWarning}
            <div class="hr-review-question">Είναι σωστή αυτή η πρόταση;</div>
            ${decisionActions}
        </article>`;
    }).join('');
}

function formatAppliedRepoTransferResult(result, repo = false) {
    const category = String(result || '').trim();
    return repo || category === 'ΑΝ' ? 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ' : category || '-';
}

function getAppliedRepoTransferHistory() {
    return [...currentRepoTransferDecisionsByProposalId.values()]
        .map((record) => record?.applied_history)
        .filter(
            (history) =>
                history &&
                history.execution_id &&
                history.source?.hmeromhnia &&
                history.target?.hmeromhnia
        )
        .sort(
            (left, right) =>
                new Date(right.applied_at || 0) - new Date(left.applied_at || 0)
        );
}

function renderAppliedRepoTransferHistory() {
    const histories = getAppliedRepoTransferHistory();
    if (histories.length === 0) return '';

    return `
        <section class="applied-repo-transfer-history" aria-label="Εφαρμοσμένες μεταφορές ρεπό">
            <div class="fw-semibold mb-2">Εφαρμοσμένες μεταφορές ρεπό</div>
            <ul class="applied-repo-transfer-list">
                ${histories.map((history) => `
                    <li class="applied-repo-transfer-item" data-execution-id="${escapeHtml(history.execution_id)}">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="badge text-bg-success">Εφαρμόστηκε</span>
                            <strong>${escapeHtml(
                                history.employee_name ||
                                `Εργαζόμενος ${history.employee_kodikos || '-'}`
                            )}</strong>
                            <span>Κωδικός: ${escapeHtml(history.employee_kodikos || '-')}</span>
                        </div>
                        <div>
                            Εβδομάδα ${escapeHtml(formatPolicyPreviewDate(history.week_start))}
                            –${escapeHtml(formatPolicyPreviewDate(history.week_end))}
                        </div>
                        ${history.automatic_resolution?.authority === 'BASED_ON_REUSABLE_HR_APPROVAL'
                            ? '<div class="alert alert-info py-1 mt-2 mb-1"><strong>Αυτόματη μεταφορά ρεπό</strong><br>Βάσει παλαιότερης έγκρισης HR</div>'
                            : ''}
                        <div>
                            ${escapeHtml(formatPolicyPreviewDate(history.source.hmeromhnia))}
                            → ${escapeHtml(formatAppliedRepoTransferResult(history.source.result))}
                        </div>
                        <div class="applied-repo-transfer-target-result">
                            ${escapeHtml(formatPolicyPreviewDate(history.target.hmeromhnia))}
                            → ${escapeHtml(formatAppliedRepoTransferResult(
                                history.target.result,
                                history.target.repo_apologistika === true
                            ))}
                        </div>
                        <div class="small text-muted">
                            Εφαρμογή: ${escapeHtml(formatPolicyPreviewDateTime(history.applied_at))}
                            ${history.applied_by_user_name
                                ? ` · ${escapeHtml(history.applied_by_user_name)}`
                                : ''}
                        </div>
                    </li>
                `).join('')}
            </ul>
        </section>
    `;
}

function renderHrCompletedCases() {
    const container = document.getElementById('hrReviewCompletedContainer');
    if (!container) return;

    const appliedHistoryHtml = renderAppliedRepoTransferHistory();
    if (currentHrCompletedGroups.length === 0 && !appliedHistoryHtml) {
        container.innerHTML = '';
        return;
    }

    const itemsHtml = currentHrCompletedGroups
        .map((group) => {
            const items = Array.isArray(group.items) ? group.items : [];
            const source = items.find((item) => item?.role === 'SOURCE_BECOMES_WORK') || {};
            const target = items.find((item) => item?.role === 'TARGET_BECOMES_REPO') || {};
            const state = currentRepoTransferDecisionsByProposalId.get(String(group.group_id || '')) || {};
            const decision = state.current_decision || {};
            const name = source.employee_name || target.employee_name || '';
            const code = source.employee_kodikos || target.employee_kodikos || '-';
            const applyMessages = {
                RUNTIME_DISABLED: 'Η πρόταση έχει εγκριθεί, αλλά η εφαρμογή δεν είναι ακόμη ενεργοποιημένη.',
                INDEXES_NOT_READY: 'Η πρόταση έχει εγκριθεί, αλλά η ασφαλής εφαρμογή δεν είναι ακόμη διαθέσιμη.',
                NOT_AUTHORIZED: 'Η πρόταση έχει εγκριθεί, αλλά δεν έχετε δικαίωμα εφαρμογής.',
                STALE_DECISION: 'Τα δεδομένα έχουν αλλάξει μετά την έγκριση και απαιτείται νέος έλεγχος.'
            };
            const approved = decision.decision_code === 'APPROVE_PROPOSAL';
            const automaticReusable = group.automatic_resolution?.authority ===
                'BASED_ON_REUSABLE_HR_APPROVAL';
            const inheritedReusable = group.status === 'RESOLVED_BY_POLICY' &&
                group.reusable_decision?.approval_id;
            const applyAction = state.apply_state === 'ALREADY_APPLIED' && state.current_execution
                ? `<div class="mt-2"><span class="badge text-bg-success">Εφαρμόστηκε</span> ${escapeHtml(formatPolicyPreviewDateTime(state.current_execution.applied_at))}${state.current_execution.created_by_user_name ? ` · ${escapeHtml(state.current_execution.created_by_user_name)}` : ''}</div>`
                : approved && state.can_apply === true && userCanApplyRepoTransferDecision()
                ? `<button type="button" class="btn btn-sm policy-preview-decision-success hr-review-apply-btn mt-2" data-group-id="${escapeHtml(String(group.group_id || ''))}" data-decision-id="${escapeHtml(decision.id || '')}">Εφαρμογή εγκεκριμένης μεταφοράς</button>`
                : approved
                ? `<div class="small text-muted mt-2">${escapeHtml(applyMessages[state.apply_state] || 'Η εγκεκριμένη πρόταση δεν είναι διαθέσιμη για εφαρμογή.')}</div>`
                : '';
            return `
                <li>
                    <div><strong>${escapeHtml(name || `Εργαζόμενος ${code}`)}</strong></div>
                    <div>${escapeHtml(formatPolicyPreviewDate(group.first_date))}–${escapeHtml(formatPolicyPreviewDate(group.last_date))}</div>
                    ${decision.created_by_user_name ? `<div>Καταχώριση: ${escapeHtml(decision.created_by_user_name)}</div>` : ''}
                    ${decision.notes ? `<div>Σημείωση: ${escapeHtml(decision.notes)}</div>` : ''}
                    ${automaticReusable
                        ? '<div class="alert alert-info py-2"><strong>Αυτόματη μεταφορά ρεπό</strong><br>Βάσει παλαιότερης έγκρισης HR</div>'
                        : inheritedReusable ? renderAtomicReusableDecision(group) : ''}
                    ${automaticReusable ? '' : applyAction}
                </li>
            `;
        })
        .join('');

    const completedGroupsHtml = currentHrCompletedGroups.length ? `
        <details class="hr-review-completed-details">
            <summary>Ολοκληρωμένες περιπτώσεις (${escapeHtml(currentHrCompletedGroups.length)})</summary>
            <ul>${itemsHtml}</ul>
        </details>
    ` : '';
    container.innerHTML = `${completedGroupsHtml}${appliedHistoryHtml}`;
}

function renderHrCompletionState() {
    const status = document.getElementById('hrReviewStatus');
    if (!status || !currentHrReviewLoaded) return;

    const total = currentHrPendingGroups.length + currentHrCompletedGroups.length;
    if (total === 0) {
        status.className = 'hr-review-status hr-review-empty-state';
        status.textContent =
            'Δεν υπάρχουν περιπτώσεις που χρειάζονται απόφαση για το επιλεγμένο διάστημα.';
    } else if (currentHrPendingGroups.length === 0) {
        status.className = 'hr-review-status hr-review-completion-state';
        status.innerHTML =
            '<strong>Ο έλεγχος ολοκληρώθηκε.</strong><span>Δεν υπάρχουν άλλες περιπτώσεις που χρειάζονται απόφαση.</span>';
    } else {
        status.className = 'hr-review-status d-none';
        status.textContent = '';
    }
}

function renderHrReviewWorkspace() {
    renderHrReviewProgress();
    renderHrPendingCase();
    renderHrCompletedCases();
    renderHrCompletionState();
}

function setHrReviewControlsDisabled(disabled) {
    const startDate = document.getElementById('hr_apo_hmeromhnia');
    const endDate = document.getElementById('hr_eos_hmeromhnia');
    const branchSelect = document.getElementById('ypokatasthmata');
    const startButton = document.getElementById('hrReviewStartBtn');

    if (startDate) startDate.disabled = disabled;
    if (endDate) endDate.disabled = disabled;
    if (branchSelect) {
        branchSelect.disabled = disabled;
        if (disabled) branchSelect.tomselect?.disable?.();
        else branchSelect.tomselect?.enable?.();
    }
    if (startButton) startButton.disabled = disabled;
}

async function loadHrReviewQueue() {
    if (currentHrReviewLoading) return;

    const branch = getHrSelectedBranch();
    const status = document.getElementById('hrReviewStatus');
    if (!branch || branch.toUpperCase() === 'ALL' || branch.includes(',')) {
        if (status) {
            status.className = 'hr-review-status hr-review-error-state';
            status.textContent = 'Επιλέξτε συγκεκριμένο παράρτημα';
        }
        return;
    }

    const filterSnapshot = {
        apo_hmeromhnia: document.getElementById('hr_apo_hmeromhnia')?.value || '',
        eos_hmeromhnia: document.getElementById('hr_eos_hmeromhnia')?.value || '',
        ypokatasthma: branch
    };

    const params = new URLSearchParams({
        apo_hmeromhnia: filterSnapshot.apo_hmeromhnia,
        eos_hmeromhnia: filterSnapshot.eos_hmeromhnia,
        ypokatasthma: filterSnapshot.ypokatasthma,
        kodikos: '',
        page: '1',
        limit: '200'
    });

    currentHrReviewLoading = true;
    setHrReviewControlsDisabled(true);
    if (status) {
        status.className = 'hr-review-status hr-review-loading-state';
        status.textContent = 'Φόρτωση περιπτώσεων…';
    }

    try {
        await loadEmploymentPeriodControl(branch);
        currentPolicyPreviewBaseParams = new URLSearchParams(params);
        currentRepoTransferDecisionsByProposalId = new Map();
        const result = await fetchPolicyPreviewGrouping(params);
        currentHrReviewProjection = result.atomicGroupProjection || null;
        currentAtomicRepoTransferProjection = currentHrReviewProjection;
        await refreshRepoTransferDecisions();
        currentHrReviewLoaded = true;
        classifyHrReviewGroups();
        renderHrReviewWorkspace();
    } catch (error) {
        currentHrReviewLoaded = false;
        currentHrReviewProjection = null;
        currentHrPendingGroups = [];
        currentHrCompletedGroups = [];
        document.getElementById('hrReviewProgress')?.classList.add('d-none');
        const pending = document.getElementById('hrReviewPendingContainer');
        const completed = document.getElementById('hrReviewCompletedContainer');
        if (pending) pending.innerHTML = '';
        if (completed) completed.innerHTML = '';
        if (status) {
            status.className = 'hr-review-status hr-review-error-state';
            status.textContent = error.message || 'Δεν ήταν δυνατή η φόρτωση του ελέγχου.';
        }
    } finally {
        currentHrReviewLoading = false;
        setHrReviewControlsDisabled(false);
    }
}

function bindHrReviewEvents() {
    document.getElementById('hrReviewStartBtn')?.addEventListener('click', loadHrReviewQueue);
    document.getElementById('hrReviewPendingContainer')?.addEventListener('click', async (event) => {
        const button = event.target.closest?.(
            '.hr-review-decision-btn, .hr-review-reusable-btn'
        );
        if (!button || button.disabled) return;
        const card = button.closest('.hr-review-proposal-card[data-group-id]');
        const group = currentHrPendingGroups.find(
            (candidate) => String(candidate.group_id || '') === String(card?.dataset.groupId || '')
        );
        if (!group) return;
        try {
            if (button.classList?.contains('hr-review-reusable-btn')) {
                await submitPolicyPreviewDecision(group, 'APPROVE_PROPOSAL', {
                    forceAtomicReuse: true
                });
            } else {
                await submitRepoTransferDecision(group, String(button.dataset.decisionCode || ''), { mode: 'hr' });
            }
        } catch (error) {
            await Swal.fire({ icon: 'error', title: 'Δεν καταγράφηκε η απόφαση', text: error.message || 'Παρουσιάστηκε σφάλμα.' });
        }
    });
    document.getElementById('hrReviewCompletedContainer')?.addEventListener('click', async (event) => {
        const revokeButton = event.target.closest?.('.policy-preview-revoke-btn');
        if (revokeButton) {
            await revokePolicyPreviewApproval(revokeButton.dataset.approvalId);
            return;
        }
        const button = event.target.closest?.('.hr-review-apply-btn');
        if (!button || button.disabled) return;
        const group = currentHrCompletedGroups.find(
            (candidate) => String(candidate.group_id || '') === String(button.dataset.groupId || '')
        );
        if (!group) return;
        await submitRepoTransferApply(group, String(button.dataset.decisionId || ''), button);
    });
    document.getElementById('showAdvancedReviewBtn')?.addEventListener('click', async () => {
        if (!userCanUseAdvancedEmploymentReview()) return;
        await window.EmploymentReviewBranches?.preselectAdvancedBranch?.();
        document.getElementById('hrReviewWorkspace')?.classList.add('d-none');
        document.getElementById('advancedReviewWorkspace')?.classList.remove('d-none');
    });
    document.getElementById('showMinimalReviewBtn')?.addEventListener('click', async () => {
        document.getElementById('advancedReviewWorkspace')?.classList.add('d-none');
        document.getElementById('hrReviewWorkspace')?.classList.remove('d-none');
        if (currentHrReviewLoaded) await loadHrReviewQueue();
    });
}

function renderAtomicRepoTransferProjection(projection) {
    if (!projection) return '';

    const groups = Array.isArray(projection.groups) ? projection.groups : [];
    const reviewOutcomes = Array.isArray(projection.review_outcomes)
        ? projection.review_outcomes
        : [];
    const reviewOutcomesHtml = reviewOutcomes.map((outcome) => {
        const blockedTarget = outcome?.outcome_code === 'PARTIAL_OFFSET_TARGET_BLOCKED';
        const guidanceLabels = (Array.isArray(outcome?.investigation_guidance)
            ? outcome.investigation_guidance
            : [])
            .filter((value) => ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ'].includes(value))
            .map((value) => value === 'ΑΔΕΙΑ' ? 'άδεια' : 'απουσία');
        const blockerLabels = (Array.isArray(outcome?.blocked_target_reasons)
            ? [...new Set(outcome.blocked_target_reasons)]
            : [])
            .sort()
            .map(getAtomicRepoTransferDiagnosticLabel);
        const rawBlockedCandidates = Array.isArray(outcome?.blocked_target_candidates)
            ? outcome.blocked_target_candidates
            : [];
        const blockedCandidatesAreSafe = rawBlockedCandidates.length > 0 &&
            rawBlockedCandidates.every((candidate) => {
                if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
                    return false;
                }
                const date = String(candidate.hmeromhnia || '').trim();
                const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
                    ? new Date(`${date}T00:00:00.000Z`)
                    : null;
                return (
                    parsedDate &&
                    !Number.isNaN(parsedDate.getTime()) &&
                    parsedDate.toISOString().slice(0, 10) === date &&
                    typeof candidate.current_category === 'string' &&
                    Array.isArray(candidate.blocker_reasons) &&
                    candidate.blocker_reasons.every((reason) => typeof reason === 'string')
                );
            });
        const blockedCandidates = blockedCandidatesAreSafe ? rawBlockedCandidates : [];
        const blockedCandidatesHtml = blockedTarget && blockedCandidates.length
            ? `
                <div class="small mt-2">
                    <div class="fw-semibold">
                        ${blockedCandidates.length === 1
                            ? 'Βρέθηκε μία υποψήφια ημέρα που δεν μπορεί να χρησιμοποιηθεί:'
                            : `Βρέθηκαν ${escapeHtml(blockedCandidates.length)} υποψήφιες ημέρες που δεν μπορούν να χρησιμοποιηθούν:`}
                    </div>
                    <ul class="mb-0">
                        ${blockedCandidates.map((candidate) => {
                            const candidateReasons = [...new Set(candidate.blocker_reasons)]
                                .sort()
                                .map(getAtomicRepoTransferDiagnosticLabel);
                            return `<li>
                                <span>${escapeHtml(formatPolicyPreviewDate(candidate.hmeromhnia))}
                                    — ${escapeHtml(candidate.current_category || '-')}</span>
                                ${candidateReasons.map((label) =>
                                    `<div>${escapeHtml(label)}</div>`
                                ).join('')}
                            </li>`;
                        }).join('')}
                    </ul>
                </div>
            `
            : '';
        return `
        <article class="atomic-repo-transfer-group">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span class="badge text-bg-warning">Χρειάζεται περαιτέρω έλεγχο</span>
                <span class="fw-semibold">${escapeHtml(blockedTarget
                    ? 'Ημέρα αντιστάθμισης με εμπόδιο'
                    : 'Μη προγραμματισμένη εργασία χωρίς ημέρα αντιστάθμισης')}</span>
            </div>
            <div class="small mb-2">
                Εργαζόμενος: <strong>${escapeHtml(outcome?.employee_kodikos || '-')}</strong>
                ${outcome?.ypokatasthma ? ` · Υποκατάστημα: ${escapeHtml(outcome.ypokatasthma)}` : ''}
                <br>
                Εβδομάδα: ${escapeHtml(formatPolicyPreviewDate(outcome?.week_start))}
                –${escapeHtml(formatPolicyPreviewDate(outcome?.week_end))}
            </div>
            <div class="small">
                Ημέρα με κάρτες: ${escapeHtml(formatPolicyPreviewDate(outcome?.source?.hmeromhnia))}
                · Ώρες καρτών: ${escapeHtml(formatAtomicRepoTransferHours(
                    outcome?.source?.cards_ores_ergasias
                ))}
                · Προτείνεται αναγνώριση ως <strong>ΕΡΓ</strong>.
            </div>
            <div class="small mt-1">
                ${blockedTarget
                    ? `Βρέθηκε προδηλωμένη ημέρα χωρίς κάρτες, αλλά δεν μπορεί να χρησιμοποιηθεί
                       με ασφάλεια ως ημέρα μη εργασίας.
                       ${blockerLabels.map((label) =>
                           `<div class="atomic-repo-transfer-diagnostic-message">${escapeHtml(label)}</div>`
                       ).join('')}
                       ${blockedCandidatesHtml}`
                    : `Δεν βρέθηκε προδηλωμένη ημέρα εργασίας χωρίς κάρτες που να μπορεί να
                       χρησιμοποιηθεί ως ημέρα μη εργασίας.
                       ${guidanceLabels.length
                           ? `<div>Πιθανή αιτία προς διερεύνηση από το HR:
                                <strong>${escapeHtml(guidanceLabels.join(' ή '))}</strong>
                                σε άλλη συγκεκριμένη ημέρα της εβδομάδας.</div>`
                           : ''}`
                }
            </div>
            <div class="small text-muted mt-2">
                ${blockedTarget
                    ? `Δεν έχει επιλεγεί ασφαλής ημέρα-στόχος και δεν έχει δημιουργηθεί
                       αποθηκεύσιμη πρόταση ή απόφαση HR.`
                    : `Δεν έχει δημιουργηθεί πρόταση εφαρμογής. Δεν υπάρχει target ημερομηνία,
                       αποθηκεύσιμη επιλογή ή απόφαση HR.`}
            </div>
        </article>
    `;
    }).join('');
    const groupsHtml = groups.length
        ? groups.map((group, index) => renderAtomicRepoTransferGroup(group, index)).join('')
        : reviewOutcomes.length ? '' : `
            <div class="atomic-repo-transfer-empty">
                Δεν δημιουργήθηκε αυτόματη πρόταση.
            </div>
        `;
    const groupSafetyHtml = groups.length ? `
        <div class="atomic-repo-transfer-main-warning">
            <div>Η πρόταση μεταφοράς ρεπό περιλαμβάνει δύο συνδεδεμένες αλλαγές και εφαρμόζεται μόνο ως σύνολο.</div>
            <div>Η προεπισκόπηση δεν αλλάζει δεδομένα. Καταγράφεται πρώτα μία ενιαία απόφαση HR.</div>
        </div>
        <div class="atomic-repo-transfer-unavailable">
            Η ενέργεια εφαρμογής εμφανίζεται μόνο μετά από έγκριση και μόνο όταν ο server
            επιβεβαιώσει ότι επιτρέπεται η ασφαλής εφαρμογή.
        </div>
    ` : '';
    const reviewSafetyHtml = reviewOutcomes.length ? `
        <div class="atomic-repo-transfer-main-warning">
            Οι παρακάτω περιπτώσεις χρειάζονται διερεύνηση από το HR.
            Δεν έχει δημιουργηθεί πρόταση μεταφοράς ή εφαρμογής.
        </div>
    ` : '';

    return `
        <section class="atomic-repo-transfer-section" aria-labelledby="atomicRepoTransferTitle">
            <div class="card border rounded atomic-repo-transfer-card">
                <div class="card-body">
                    <div class="atomic-repo-transfer-header">
                        <div class="fw-semibold" id="atomicRepoTransferTitle">
                            ${groups.length ? 'Προτάσεις Μεταφοράς Ρεπό' : 'Έλεγχος Μεταφοράς Ρεπό'}
                        </div>
                        <span class="atomic-repo-transfer-readonly-badge">Ροή έγκρισης HR</span>
                    </div>
                    ${groupSafetyHtml}
                    ${reviewSafetyHtml}
                    ${renderAtomicRepoTransferSummary(projection)}
                    ${renderAtomicRepoTransferDiagnostics(projection)}
                    ${reviewOutcomes.length
                        ? `<div class="fw-semibold mt-3 mb-2">Περιπτώσεις προς διερεύνηση</div>
                           <div class="atomic-repo-transfer-groups">${reviewOutcomesHtml}</div>`
                        : ''}
                    ${groups.length && reviewOutcomes.length
                        ? '<div class="fw-semibold mt-3 mb-2">Συνδεδεμένες προτάσεις</div>'
                        : ''}
                    <div class="atomic-repo-transfer-groups">${groupsHtml}</div>
                </div>
            </div>
        </section>
    `;
}

function renderPolicyPreviewGroups(grouping, options = {}) {
    const container = document.getElementById('policyPreviewGroupsContainer');

    if (!container) return;

    if (Object.prototype.hasOwnProperty.call(options, 'atomicGroupProjection')) {
        currentAtomicRepoTransferProjection = options.atomicGroupProjection || null;
    }

    if (options.loading || options.error) {
        currentAtomicRepoTransferProjection = null;
    }

    currentPolicyPreviewGrouping = grouping || null;

    if (options.loading) {
        container.innerHTML = `
            <div class="card border rounded">
                <div class="card-body py-3">
                    <div class="fw-semibold mb-1">Ομαδοποίηση Ελέγχου Πολιτικών</div>
                    <div class="text-muted small">Φόρτωση ομαδοποίησης...</div>
                </div>
            </div>
        `;
        return;
    }

    if (options.error) {
        container.innerHTML = `
            <div class="card border rounded">
                <div class="card-body py-3">
                    <div class="fw-semibold mb-1">Ομαδοποίηση Ελέγχου Πολιτικών</div>
                    <div class="text-danger small">
                        ${escapeHtml(options.error)}
                    </div>
                </div>
            </div>
        `;
        return;
    }

    if (!grouping) {
        container.innerHTML = `
            ${renderAtomicRepoTransferProjection(currentAtomicRepoTransferProjection)}
            ${renderAppliedRepoTransferHistory()}
            <div class="card border rounded">
                <div class="card-body py-3">
                    <div class="fw-semibold mb-1">Ομαδοποίηση Ελέγχου Πολιτικών</div>
                    <div class="text-muted small">
                        Δεν υπάρχουν διαθέσιμα δεδομένα ομαδοποίησης.
                    </div>
                </div>
            </div>
        `;
        bindAtomicRepoTransferEvents(container);
        return;
    }

    const groups = Array.isArray(grouping.groups) ? grouping.groups : [];
    const indexedGroups = groups.map((group, index) => ({ group, index }));
    const decisionGroups = indexedGroups.filter(({ group }) =>
        isPolicyPreviewDecisionStatus(group.status)
    );
    const diagnosticGroups = indexedGroups.filter(
        ({ group }) => String(group.status || '').trim() === 'UNKNOWN_PATTERN'
    );
    const inheritedApprovalGroups = indexedGroups.filter(
        ({ group }) => Boolean(group?.reusable_decision?.approval_id)
    );
    const renderGroupCard = ({ group, index }, { allowDecision = true } = {}) => {
        const groupElementId = `policyPreviewGroupItems-${index}`;
        const groupTitle = getPolicyPreviewGroupTitle(group);
        const isExpanded = options.expandedGroupId === group.group_id;

        return `
            <div
                class="border rounded policy-preview-group-card"
                data-group-id="${escapeHtml(group.group_id || '')}">
                <div class="policy-preview-group-header">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                            ${renderPolicyPreviewStatusBadge(group.status)}
                            <span class="fw-semibold">${escapeHtml(groupTitle)}</span>
                        </div>
                        <div class="policy-preview-group-line text-muted">
                            ${escapeHtml(group.count ?? 0)} εγγραφές ·
                            ${escapeHtml(group.employees_count ?? 0)} εργαζόμενοι
                        </div>
                    </div>
                    <button
                        type="button"
                        class="btn btn-sm btn-outline-primary policy-preview-group-toggle policy-preview-toggle"
                        data-target-id="${escapeHtml(groupElementId)}"
                        aria-expanded="${String(isExpanded)}">
                        ${isExpanded ? 'Κλείσιμο' : 'Άνοιγμα'}
                    </button>
                </div>
                <div
                    class="policy-preview-group-items ${isExpanded ? '' : 'd-none'} mt-2"
                    id="${escapeHtml(groupElementId)}">
                    ${
                        group?.reusable_decision?.approval_id
                            ? `<div class="alert alert-success py-2 px-3 small mb-2">
                                   <div class="fw-semibold">Εγκρίνεται βάσει παλιότερης απόφασης HR</div>
                                   <div>
                                       Από ${escapeHtml(
                                           group.reusable_decision.approved_by_user_name || 'HR'
                                       )} · ${escapeHtml(
                                           formatPolicyPreviewDateTime(
                                               group.reusable_decision.approved_at
                                           )
                                       )} · Απόφαση ${escapeHtml(
                                           group.reusable_decision.approval_id
                                       )}
                                   </div>
                                   ${
                                       group.reusable_decision.notes
                                           ? `<div>Σημειώσεις: ${escapeHtml(
                                                 group.reusable_decision.notes
                                             )}</div>`
                                           : ''
                                   }
                                   ${
                                       userCanManageReusablePolicyApproval()
                                           ? `<button type="button" class="btn btn-sm btn-outline-danger mt-2 policy-preview-revoke-btn" data-approval-id="${escapeHtml(
                                                 group.reusable_decision.approval_id
                                             )}">Ανάκληση πολιτικής</button>`
                                           : ''
                                   }
                               </div>`
                            : ''
                    }
                    ${allowDecision ? renderPolicyPreviewApprovalPanel(group, index) : ''}
                    ${renderPolicyPreviewGroupItems(group.items, index)}
                </div>
            </div>
        `;
    };
    const decisionGroupsHtml = decisionGroups.length
        ? decisionGroups.map((entry) => renderGroupCard(entry)).join('')
        : '<div class="small text-success fw-semibold py-2">Δεν απαιτείται απόφαση HR για τις τρέχουσες εγγραφές.</div>';
    const diagnosticGroupsHtml = diagnosticGroups.length
        ? `
            <details class="policy-preview-diagnostics-accordion mt-2">
                <summary>
                    Τεχνικές εκκρεμότητες πολιτικής
                    <span class="badge text-bg-secondary ms-1">${escapeHtml(
                        diagnosticGroups.reduce(
                            (total, entry) => total + Number(entry.group?.count || 0),
                            0
                        )
                    )}</span>
                </summary>
                <div class="pt-2">
                    <div class="small text-muted mb-2">
                        Δεν απαιτούν απόφαση HR. Παραμένουν διαθέσιμες μόνο για διόρθωση της πολιτικής.
                    </div>
                    ${diagnosticGroups
                        .map((entry) => renderGroupCard(entry, { allowDecision: false }))
                        .join('')}
                </div>
            </details>
        `
        : '';
    const inheritedApprovalGroupsHtml = inheritedApprovalGroups.length
        ? `
            <details class="policy-preview-diagnostics-accordion mt-2">
                <summary>
                    Εγκρίθηκαν βάσει παλιότερης απόφασης HR
                    <span class="badge text-bg-success ms-1">${escapeHtml(
                        inheritedApprovalGroups.reduce(
                            (total, entry) => total + Number(entry.group?.count || 0),
                            0
                        )
                    )}</span>
                </summary>
                <div class="pt-2">
                    <div class="small text-muted mb-2">
                        Δεν απαιτείται νέα απόφαση. Η αντιστοίχιση έγινε στην ίδια εταιρεία, στο ίδιο παράρτημα και στο ίδιο σενάριο πολιτικής.
                    </div>
                    ${inheritedApprovalGroups
                        .map((entry) => renderGroupCard(entry, { allowDecision: false }))
                        .join('')}
                </div>
            </details>
        `
        : '';
    const showHistory = currentPolicyPreviewApprovalTotal > 0;
    const showDryRun =
        getPolicyPreviewApplyDryRunSummaryValue(
            currentPolicyPreviewApplyDryRun?.summary,
            'approvals_found'
        ) > 0;
    const repoTransferDecisionCount = Array.isArray(currentAtomicRepoTransferProjection?.groups)
        ? currentAtomicRepoTransferProjection.groups.filter(
              (group) => !isHrReviewGroupCompleted(group)
          ).length
        : 0;
    const outerExpanded = Boolean(options.expandedGroupId || options.expandPolicyAccordion);

    container.innerHTML = `
        <details class="card border rounded policy-preview-card policy-preview-main-accordion" ${outerExpanded ? 'open' : ''}>
            <summary class="policy-preview-main-summary">
                <span class="fw-semibold">Αποφάσεις Ελέγχου Πολιτικών</span>
                ${renderPolicyPreviewGroupingSummary(
                    grouping,
                    decisionGroups.map(({ group }) => group),
                    diagnosticGroups.map(({ group }) => group),
                    repoTransferDecisionCount,
                    inheritedApprovalGroups.map(({ group }) => group)
                )}
                <span class="policy-preview-main-toggle-label">Άνοιγμα / κλείσιμο</span>
            </summary>
            <div class="card-body policy-preview-main-content">
                ${renderAtomicRepoTransferProjection(currentAtomicRepoTransferProjection)}
                ${renderAppliedRepoTransferHistory()}
                ${
                    currentPolicyPreviewApprovalsError
                        ? `<div class="alert alert-warning py-1 px-2 small mb-2">${escapeHtml(
                              currentPolicyPreviewApprovalsError
                          )}</div>`
                        : ''
                }
                ${showHistory ? renderPolicyPreviewApprovalHistorySection() : ''}
                ${showDryRun ? renderPolicyPreviewApplyDryRunSection() : ''}
                <div class="fw-semibold mb-2">Αποφάσεις που εκκρεμούν</div>
                ${decisionGroupsHtml}
                ${inheritedApprovalGroupsHtml}
                ${diagnosticGroupsHtml}
            </div>
        </details>
    `;

    bindAtomicRepoTransferEvents(container);
    bindPolicyPreviewApprovalHistoryEvents(container);
    bindPolicyPreviewApplyDryRunEvents(container);

    container.querySelectorAll('.policy-preview-group-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.targetId;
            const target = targetId ? document.getElementById(targetId) : null;

            if (!target) return;

            const isOpen = !target.classList.contains('d-none');
            target.classList.toggle('d-none', isOpen);
            button.setAttribute('aria-expanded', String(!isOpen));
            button.textContent = isOpen ? 'Άνοιγμα' : 'Κλείσιμο';
        });
    });

    container.querySelectorAll('.policy-preview-details-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const groupIndex = Number(button.dataset.groupIndex);
            const itemIndex = Number(button.dataset.itemIndex);
            const item = groups?.[groupIndex]?.items?.[itemIndex];

            if (!item) return;

            showPolicyPreviewItemDetails(item);
        });
    });

    container.querySelectorAll('.policy-preview-decision-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const groupIndex = Number(button.dataset.groupIndex);
            const decisionType = String(button.dataset.decisionType || '').trim();
            const group = groups?.[groupIndex];

            if (!group || !policyPreviewDecisionLabels[decisionType]) return;

            try {
                await submitPolicyPreviewDecision(group, decisionType);
            } catch (error) {
                console.error('[submitPolicyPreviewDecision]', error);
                await Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα',
                    text: error.message || 'Δεν ήταν δυνατή η καταγραφή της απόφασης.'
                });
            }
        });
    });
    container.querySelectorAll('.policy-preview-revoke-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            try {
                await revokePolicyPreviewApproval(button.dataset.approvalId);
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message });
            }
        });
    });
}

let currentEmploymentPeriodControl = null;

const employmentPeriodModeLabels = Object.freeze({
    NORMAL: 'Ανοικτή',
    LOCKED: 'Κλειδωμένη',
    FINALIZED: 'Οριστικοποιημένη περίοδος',
    CORRECTIVE_ONLY: 'Μόνο διορθωτική μισθοδοσία'
});
const employmentSubmissionTimelinessLabels = Object.freeze({
    NOT_SUBMITTED: 'Δεν έχει συνδεθεί', TIMELY: 'Εμπρόθεσμη', LATE: 'Εκπρόθεσμη'
});
const correctiveDeltaLabels = Object.freeze({
    ores_ergasias_apologistika: 'Ώρες εργασίας', ores_prostheths_ergasias_apologistika: 'Πρόσθετη εργασία',
    ores_yperergasias_apologistika: 'Υπερεργασία', ores_nominhs_yperorias_apologistika: 'Νόμιμη υπερωρία',
    ores_paranomhs_yperorias_apologistika: 'Παράνομη υπερωρία', ores_nyxtas_apologistika: 'Νυχτερινές ώρες',
    ores_argion_prosayxhsh_apologistika: 'Προσαύξηση Κυριακής/αργίας',
    ores_argion_ergasia_apologistika: 'Εργασία Κυριακής/αργίας', sixth_day_hours: 'Ώρες 6ης ημέρας',
    seventh_day_hours: 'Ώρες 7ης ημέρας', baseActualWorkAmount: 'Βασικές αποδοχές',
    premiumTotalAmount: 'Σύνολο προσαυξήσεων', grossWorkAmount: 'Συνολικό ποσό'
});

function renderEmploymentPeriodControl(state) {
    currentEmploymentPeriodControl = state || null;
    const panel = document.getElementById('employmentPeriodControlPanel');
    if (!panel) return;
    panel.classList.remove('d-none');
    const mode = String(state?.effective_mode || '');
    document.getElementById('employmentPeriodControlStatus').textContent =
        employmentPeriodModeLabels[mode] || 'Απαιτείται έλεγχος';
    document.getElementById('employmentPeriodControlDeadline').textContent =
        formatPolicyPreviewDate(state?.deadline);
    document.getElementById('employmentPeriodFinalizedAt').textContent =
        formatPolicyPreviewDate(state?.finalized_at) || '-';
    document.getElementById('employmentPeriodSubmission').textContent =
        employmentSubmissionTimelinessLabels[state?.submission_timeliness] || 'Δεν έχει συνδεθεί';
    document.getElementById('employmentPeriodProtocol').textContent = state?.submission_protocol || '-';
    const actions = state?.allowed_actions || {};
    document.getElementById('lockEmploymentPeriodBtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && actions.lock_period === true && state?.index_readiness?.ready === true)
    );
    document.getElementById('unlockEmploymentPeriodBtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && actions.unlock_period === true && state?.index_readiness?.ready === true)
    );
    document.getElementById('finalizeEmploymentPeriodBtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && actions.finalize_period === true)
    );
    document.getElementById('submitFinalWTODayilyABtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && actions.submit_final_wtodailya === true)
    );
    document.getElementById('openCorrectivePayrollBtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && actions.open_corrective === true)
    );
    document.getElementById('employmentPeriodCorrectiveLegend')?.classList.toggle(
        'd-none', !state?.corrective_case
    );
    document.getElementById('calculateCorrectivePayrollBtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && state?.corrective_case?.status === 'ACTIVE')
    );
    document.getElementById('closeCorrectivePayrollBtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && state?.corrective_case?.status === 'ACTIVE' && state.corrective_case.has_delta)
    );
    document.getElementById('postCorrectivePayrollBtn')?.classList.toggle(
        'd-none', !(userCanReviewEdit() && actions.post_corrective_payroll === true)
    );
    const message = document.getElementById('employmentPeriodControlMessage');
    if (message) {
        message.textContent = state?.index_readiness?.ready === false
            ? 'Η μεταβολή κατάστασης περιόδου δεν είναι προσωρινά διαθέσιμη.'
            : mode === 'CORRECTIVE_ONLY'
              ? 'Οι κανονικές μεταβολές έχουν απενεργοποιηθεί μετά την προθεσμία.'
              : '';
    }
}

function currentCorrectiveBranch() {
    return String(document.getElementById('ypokatasthma_stathera_advanced')?.value || getHrSelectedBranch() || '').trim();
}

async function calculateCorrectivePayroll() {
    const state = currentEmploymentPeriodControl;
    if (!state?.corrective_case?.case_id) throw new Error('Δεν υπάρχει ενεργή διορθωτική μισθοδοσία.');
    const result = await Swal.fire({
        title: 'Καταχώρηση διορθωτικών στοιχείων',
        html: '<label class="form-label" for="correctiveEmployee">Κωδικός εργαζομένου</label>' +
            '<input id="correctiveEmployee" class="swal2-input" autocomplete="off">' +
            '<label class="form-label" for="correctiveDate">Ημερομηνία</label>' +
            '<input id="correctiveDate" type="date" class="swal2-input">' +
            '<label class="form-label" for="correctiveStart">Διορθωμένη είσοδος</label>' +
            '<input id="correctiveStart" type="time" class="swal2-input">' +
            '<label class="form-label" for="correctiveEnd">Διορθωμένη έξοδος</label>' +
            '<input id="correctiveEnd" type="time" class="swal2-input">' +
            '<label class="form-label" for="correctiveReason">Αιτιολογία</label>' +
            '<textarea id="correctiveReason" class="swal2-textarea"></textarea>' +
            '<label class="form-check mt-2"><input id="correctiveSubmission" type="checkbox" class="form-check-input"> Απαιτείται νέα υποβολή</label>',
        showCancelButton: true,
        confirmButtonText: 'Υπολογισμός διορθωτικής μισθοδοσίας', cancelButtonText: 'Ακύρωση',
        preConfirm: () => {
            const employee = String(document.getElementById('correctiveEmployee')?.value || '').trim();
            const date = String(document.getElementById('correctiveDate')?.value || '');
            const start = String(document.getElementById('correctiveStart')?.value || '');
            const end = String(document.getElementById('correctiveEnd')?.value || '');
            const reason = String(document.getElementById('correctiveReason')?.value || '').trim();
            if (!employee || !date || !start || !end || !reason) {
                Swal.showValidationMessage('Όλα τα διορθωτικά στοιχεία και η αιτιολογία είναι υποχρεωτικά.'); return false;
            }
            return { employee, date, start, end, reason,
                requiresNewSubmission: document.getElementById('correctiveSubmission')?.checked === true };
        }
    });
    if (!result.isConfirmed) return;
    const command = result.value;
    const response = await fetch('/api/prodhlomena-oraria/review/period-control/corrective/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': csrfToken },
        body: JSON.stringify({ ypokatasthma: currentCorrectiveBranch(), case_id: state.corrective_case.case_id,
            reason: command.reason, request_id: `corrective-calculate-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            requires_new_submission: command.requiresNewSubmission,
            corrections: [{ type: 'REPLACE_HISTORICAL_CARD_INTERVALS', employee_kodikos: command.employee,
                date: command.date, intervals: [{ start: command.start, end: command.end }] }] })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Ο διορθωτικός υπολογισμός απέτυχε.');
    await loadEmploymentPeriodControl(currentCorrectiveBranch());
    await loadResults();
    await Swal.fire({ icon: 'success', title: 'Διορθωτική διαφορά', text: payload.message });
}

async function postCorrectivePayroll() {
    const state = currentEmploymentPeriodControl;
    if (state?.corrective_case?.status !== 'CLOSED') throw new Error('Η διορθωτική υπόθεση πρέπει πρώτα να κλείσει.');
    const result = await Swal.fire({ title: 'Καταχώριση διορθωτικής μισθοδοσίας',
        html: '<label class="form-label" for="postingEmployee">Κωδικός εργαζομένου</label>' +
            '<input id="postingEmployee" class="swal2-input" autocomplete="off">' +
            '<label class="form-label" for="postingEarningsType">Τύπος αποδοχών</label>' +
            '<input id="postingEarningsType" class="swal2-input" autocomplete="off">' +
            '<label class="form-label" for="postingReason">Αιτιολογία</label>' +
            '<textarea id="postingReason" class="swal2-textarea"></textarea>',
        showCancelButton: true, confirmButtonText: 'Καταχώριση', cancelButtonText: 'Ακύρωση',
        preConfirm: () => { const employee = String(document.getElementById('postingEmployee')?.value || '').trim();
            const type = String(document.getElementById('postingEarningsType')?.value || '').trim();
            const reason = String(document.getElementById('postingReason')?.value || '').trim();
            if (!employee || !type || !reason) { Swal.showValidationMessage('Απαιτούνται εργαζόμενος, τύπος αποδοχών και αιτιολογία.'); return false; }
            return { employee, type, reason }; } });
    if (!result.isConfirmed) return;
    const response = await fetch('/api/prodhlomena-oraria/review/period-control/corrective/payroll-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ypokatasthma: currentCorrectiveBranch(), case_id: state.corrective_case.case_id,
            employee_kodikos: result.value.employee, typos_apodoxon: result.value.type,
            reason: result.value.reason,
            request_id: `corrective-payroll-${Date.now()}-${Math.random().toString(16).slice(2)}` }) });
    const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.message || 'Η καταχώριση απέτυχε.');
    await Swal.fire({ icon: 'success', title: 'Διορθωτική μισθοδοσία',
        html: `Συμψηφισμός: ${payload.offset_applied}<br>Παρακράτηση: ${payload.withholding_amount}<br>` +
            `Πληρωτέα διαφορά: ${payload.payable_now}<br>Νέος α/α μισθοδοσίας: ${payload.aa_misthodosias}` });
    await loadEmploymentPeriodControl(currentCorrectiveBranch());
}

async function closeCorrectivePayroll() {
    const state = currentEmploymentPeriodControl;
    const confirmation = await Swal.fire({ title: 'Κλείσιμο διορθωτικής μισθοδοσίας', input: 'textarea',
        inputLabel: 'Αιτιολογία', showCancelButton: true, confirmButtonText: 'Κλείσιμο', cancelButtonText: 'Ακύρωση',
        inputValidator: (value) => String(value || '').trim() ? undefined : 'Η αιτιολογία είναι υποχρεωτική.' });
    if (!confirmation.isConfirmed) return;
    const response = await fetch('/api/prodhlomena-oraria/review/period-control/corrective/close', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': csrfToken },
        body: JSON.stringify({ ypokatasthma: currentCorrectiveBranch(), case_id: state?.corrective_case?.case_id,
            reason: String(confirmation.value || '').trim() })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Το κλείσιμο απέτυχε.');
    await loadEmploymentPeriodControl(currentCorrectiveBranch());
    await Swal.fire({ icon: 'success', title: 'Διορθωμένη μισθοδοσία', text: payload.message });
}

async function runEmploymentPeriodLifecycleAction(kind) {
    const corrective = kind === 'corrective';
    const confirmation = await Swal.fire({ icon: 'warning',
        title: corrective ? 'Άνοιγμα διορθωτικής μισθοδοσίας' : 'Οριστικοποίηση περιόδου',
        text: corrective ? 'Το αρχικό οριστικοποιημένο αποτέλεσμα θα παραμείνει αμετάβλητο.' :
            'Θα δημιουργηθεί παγωμένο ιστορικό αποτέλεσμα που δεν ανακατασκευάζεται από μελλοντικές πολιτικές.',
        input: 'textarea', inputLabel: 'Αιτιολογία', showCancelButton: true,
        confirmButtonText: corrective ? 'Άνοιγμα διορθωτικής μισθοδοσίας' : 'Οριστικοποίηση περιόδου',
        cancelButtonText: 'Ακύρωση', inputValidator: (value) => String(value || '').trim() ? undefined : 'Η αιτιολογία είναι υποχρεωτική.' });
    if (!confirmation.isConfirmed) return;
    const branch = String(document.getElementById('ypokatasthma_stathera_advanced')?.value || getHrSelectedBranch() || '').trim();
    const suffix = corrective ? 'corrective/open' : 'finalize';
    const response = await fetch(`/api/prodhlomena-oraria/review/period-control/${suffix}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': csrfToken },
        body: JSON.stringify({ ypokatasthma: branch, reason: String(confirmation.value || '').trim(),
            request_id: `period-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}` })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Η ενέργεια απέτυχε.');
    await loadEmploymentPeriodControl(branch);
    await Swal.fire({ icon: 'success', title: corrective ? 'Διορθωτική μισθοδοσία σε εξέλιξη' : 'Οριστικοποιημένη περίοδος', text: payload.message });
}

async function submitFinalWTODayilyA() {
    const state = currentEmploymentPeriodControl;
    const summary = state?.final_submission_summary || {};
    const confirmation = await Swal.fire({ icon: 'warning',
        title: 'Οριστική υποβολή στο ΕΡΓΑΝΗ',
        html: `<div class="text-start"><div><strong>Περίοδος:</strong> ${escapeHtml(summary.period_start || '')} – ${escapeHtml(summary.period_end || '')}</div>` +
            `<div><strong>Παράρτημα:</strong> ${escapeHtml(summary.branch || '')}</div>` +
            `<div><strong>Εργαζόμενοι:</strong> ${Number(summary.employees_count) || 0}</div>` +
            `<div><strong>Ημερήσιες εγγραφές:</strong> ${Number(summary.employee_days_count) || 0}</div>` +
            '<div class="alert alert-danger mt-3 mb-0">Πρόκειται για ΟΡΙΣΤΙΚΗ υποβολή Απολογιστικού Πίνακα Ωραρίων.</div>' +
            '<label class="form-label mt-3" for="finalWtoReason">Αιτιολογία</label><textarea id="finalWtoReason" class="swal2-textarea"></textarea></div>',
        showCancelButton: true, confirmButtonText: 'Οριστική υποβολή', cancelButtonText: 'Ακύρωση',
        preConfirm: () => { const reason = String(document.getElementById('finalWtoReason')?.value || '').trim();
            if (!reason) { Swal.showValidationMessage('Η αιτιολογία είναι υποχρεωτική.'); return false; }
            return reason; }
    });
    if (!confirmation.isConfirmed) return;
    const response = await fetch('/api/prodhlomena-oraria/review/period-control/submission/final', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': csrfToken },
        body: JSON.stringify({ ypokatasthma: currentCorrectiveBranch(), reason: confirmation.value,
            request_id: `wtodailya-final-${Date.now()}-${Math.random().toString(16).slice(2)}` })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Η τελική υποβολή απέτυχε.');
    await loadEmploymentPeriodControl(currentCorrectiveBranch());
    await Swal.fire({ icon: 'success', title: payload.idempotent ? 'Ήδη υποβλημένο' : 'Οριστική υποβολή ολοκληρώθηκε',
        text: `Πρωτόκολλο: ${payload.protocol || '-'}` });
}

async function loadEmploymentPeriodControl(ypokatasthma) {
    const response = await fetch(`/api/prodhlomena-oraria/review/period-control/current?ypokatasthma=${encodeURIComponent(ypokatasthma)}`, {
        headers: { Accept: 'application/json', 'CSRF-Token': csrfToken }
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Δεν ήταν δυνατή η ανάκτηση της κατάστασης περιόδου.');
    renderEmploymentPeriodControl(payload);
    return payload;
}

async function transitionEmploymentPeriod(action) {
    const unlocking = action === 'unlock';
    const confirmation = await Swal.fire({
        icon: 'warning',
        title: unlocking ? 'Ξεκλείδωμα περιόδου' : 'Κλείδωμα περιόδου',
        text: unlocking
            ? 'Η ενέργεια αφορά ολόκληρη την περίοδο και δεν ξεκλειδώνει χειροκίνητα κλειδωμένες ημερήσιες εγγραφές.'
            : 'Μετά το κλείδωμα δεν επιτρέπονται κανονικές μεταβολές στην περίοδο.',
        input: 'textarea',
        inputLabel: 'Αιτιολογία',
        inputPlaceholder: 'Συμπληρώστε υποχρεωτική αιτιολογία',
        showCancelButton: true,
        confirmButtonText: unlocking ? 'Ξεκλείδωμα περιόδου' : 'Κλείδωμα περιόδου',
        cancelButtonText: 'Ακύρωση',
        inputValidator: (value) => String(value || '').trim() ? undefined : 'Η αιτιολογία είναι υποχρεωτική.'
    });
    if (!confirmation.isConfirmed) return;
    const branch = String(
        document.getElementById('ypokatasthma_stathera_advanced')?.value ||
        getHrSelectedBranch() || ''
    ).trim();
    const response = await fetch(`/api/prodhlomena-oraria/review/period-control/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': csrfToken },
        body: JSON.stringify({
            ypokatasthma: branch,
            reason: String(confirmation.value || '').trim(),
            request_id: `period-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            expected_version: Number(currentEmploymentPeriodControl?.version || 0)
        })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Η μεταβολή κατάστασης περιόδου απέτυχε.');
    await loadEmploymentPeriodControl(branch);
    await Swal.fire({ icon: 'success', title: 'Κατάσταση περιόδου', text: payload.message });
}

async function loadResults() {
    try {
        const advancedBranch = String(
            document.getElementById('ypokatasthma_stathera_advanced')?.value ||
            document.getElementById('ypokatasthma')?.tomselect?.getValue?.() ||
            document.getElementById('ypokatasthma')?.value ||
            ''
        ).trim();
        const branchValidation = document.getElementById('advancedBranchValidation');
        const invalidBranch =
            !advancedBranch ||
            advancedBranch.toUpperCase() === 'ALL' ||
            advancedBranch.includes(',');
        branchValidation?.classList.toggle('d-none', !invalidBranch);
        if (invalidBranch) return;

        await loadEmploymentPeriodControl(advancedBranch);

        currentAtomicRepoTransferProjection = null;
        currentPolicyPreviewRowsById = new Map();
        renderPolicyPreviewGroups(null, { loading: true });

        const params = new URLSearchParams({
            apo_hmeromhnia: document.getElementById('apo_hmeromhnia')?.value || '',
            eos_hmeromhnia: document.getElementById('eos_hmeromhnia')?.value || '',
            ypokatasthma: advancedBranch,
            kodikos: document.getElementById('kodikos')?.value || '',
            only_apologistiko: document.getElementById('only_apologistiko')?.checked || false,
            only_nyxta: document.getElementById('only_nyxta')?.checked || false,
            only_argia: document.getElementById('only_argia')?.checked || false,
            only_yperergasia: document.getElementById('only_yperergasia')?.checked || false,
            page: 1,
            limit: 5000
        });

        const response = await fetch(`/api/prodhlomena-oraria/review?${params.toString()}`, {
            method: 'GET',
            headers: {
                'CSRF-Token': csrfToken
            }
        });

        const payload = await response.json();

        if (!payload.success) {
            renderPolicyPreviewGroups(null, {
                error: payload.message || 'Αποτυχία ανάκτησης δεδομένων.'
            });
            Swal.fire({
                icon: 'warning',
                title: 'Σφάλμα',
                text: payload.message || 'Αποτυχία ανάκτησης δεδομένων.'
            });
            return;
        }

        ensureReviewTableStructure();
        ensureScenarioReviewFilterControl();
        currentPolicyPreviewBaseParams = new URLSearchParams(params);
        currentRepoTransferDecisionsByProposalId = new Map();
        currentPolicyPreviewApprovalRecords = [];
        currentPolicyPreviewApprovalTotal = 0;
        currentPolicyPreviewApprovalsByGroupId = new Map();
        currentPolicyPreviewApprovalsError = '';
        currentPolicyPreviewApplyDryRun = null;
        currentPolicyPreviewApplyDryRunError = '';
        currentApprovalHistoryFilters.decisionType = '';
        currentApprovalHistoryFilters.userName = '';
        currentApprovalHistoryFilters.searchText = '';

        const rows = payload.rows || [];
        if (payload.finalized !== true) {
            try {
                const scenarioRows = await fetchScenarioClassifications(params);
                const scenarioByProdhlomenaId = buildScenarioClassificationsMap(scenarioRows);
                attachScenarioClassifications(rows, scenarioByProdhlomenaId);
            } catch (scenarioError) {
                console.warn('[loadResults] Scenario classifications unavailable:', scenarioError);
            }
        }

        currentReviewRows = rows;
        currentReviewDeviations = payload.deviations || [];
        currentPendingDeviationWeeks = payload.pendingDeviationWeeks || [];
        currentLegacyDeviations = payload.legacyDeviations || [];
        renderCurrentReviewRows();

        const correctiveSummary = document.getElementById('employmentPeriodCorrectiveSummary');
        if (correctiveSummary) {
            correctiveSummary.replaceChildren();
            const deltaRows = payload.corrective?.delta?.rows || [];
            const payrollPostings = payload.corrective?.payroll_postings || [];
            if (deltaRows.length || payrollPostings.length) {
                const title = document.createElement('div'); title.className = 'fw-semibold';
                title.textContent = 'Διορθωτική διαφορά'; correctiveSummary.appendChild(title);
                for (const delta of deltaRows) {
                    const line = document.createElement('div');
                    const changes = Object.entries(delta).filter(([field, value]) => field !== 'key' && Number(value) !== 0)
                        .map(([field, value]) => `${correctiveDeltaLabels[field] || 'Μεταβολή'}: ${value}`).join(' · ');
                    line.textContent = `${delta.key || ''} — ${changes}`; correctiveSummary.appendChild(line);
                }
                for (const posting of payrollPostings) {
                    const line = document.createElement('div');
                    line.textContent = `${posting.employee_kodikos || ''} — Συμψηφισμός: ${posting.offset_applied || 0}` +
                        ` · Παρακράτηση: ${posting.withholding_amount || 0}` +
                        ` · Πληρωτέα διαφορά: ${posting.payable_now || 0}` +
                        ` · Νέος α/α μισθοδοσίας: ${posting.corrective_aa_misthodosias || '-'}`;
                    correctiveSummary.appendChild(line);
                }
                correctiveSummary.classList.remove('d-none');
            } else correctiveSummary.classList.add('d-none');
        }

        if (payload.finalized !== true) {
        const [groupingResult, approvalsResult, dryRunResult] = await Promise.allSettled([
            fetchPolicyPreviewGrouping(params),
            refreshPolicyPreviewApprovals(params),
            fetchPolicyPreviewApplyDryRun(params)
        ]);

        if (approvalsResult.status === 'rejected') {
            console.warn(
                '[loadResults] Policy preview approvals unavailable:',
                approvalsResult.reason
            );
            currentPolicyPreviewApprovalRecords = [];
            currentPolicyPreviewApprovalTotal = 0;
            currentPolicyPreviewApprovalsByGroupId = new Map();
            currentPolicyPreviewApprovalsError =
                approvalsResult.reason?.message ||
                'Δεν ήταν δυνατή η ανάκτηση των καταγεγραμμένων αποφάσεων.';
        }

        if (dryRunResult.status === 'fulfilled') {
            currentPolicyPreviewApplyDryRun = dryRunResult.value;
            currentPolicyPreviewApplyDryRunError = '';
        } else {
            console.warn(
                '[loadResults] Policy preview apply dry-run unavailable:',
                dryRunResult.reason
            );
            currentPolicyPreviewApplyDryRun = null;
            currentPolicyPreviewApplyDryRunError =
                'Δεν ήταν δυνατή η ανάκτηση της προεπισκόπησης εφαρμογής.';
        }

        if (groupingResult.status === 'fulfilled') {
            attachPolicyPreviewResults(rows, groupingResult.value.previewRows);
            currentAtomicRepoTransferProjection = groupingResult.value.atomicGroupProjection || null;
            try {
                await refreshRepoTransferDecisions();
            } catch (repoTransferDecisionsError) {
                console.warn('[loadResults] Repo-transfer decisions unavailable:', repoTransferDecisionsError);
                currentRepoTransferDecisionsByProposalId = new Map();
            }
            renderCurrentReviewRows();
            renderPolicyPreviewGroups(groupingResult.value.grouping, {
                atomicGroupProjection: groupingResult.value.atomicGroupProjection
            });
        } else {
            const policyPreviewError = groupingResult.reason;
            console.warn('[loadResults] Policy preview grouping unavailable:', policyPreviewError);
            renderPolicyPreviewGroups(null, {
                error:
                    policyPreviewError.message ||
                    'Αποτυχία ανάκτησης ομαδοποίησης πολιτικών.'
            });
        }
        } else {
            renderPolicyPreviewGroups(null);
        }
    } catch (error) {
        console.error(error);
        renderPolicyPreviewGroups(null, {
            error: error.message || 'Αποτυχία ανάκτησης δεδομένων.'
        });

        Swal.fire({
            icon: 'error',
            title: 'Σφάλμα',
            text: error.message
        });
    }
}

function pairNo(n) {
    return String(n).padStart(2, '0');
}

function renderReadOnlyTimeRows(row, apoPrefix, eosPrefix) {
    return [1, 2, 3]
        .map((n) => {
            const p = pairNo(n);
            const apo = row[`${apoPrefix}_${p}`] || '';
            const eos = row[`${eosPrefix}_${p}`] || '';

            return `
                <div class="review-time-row">
                    <div class="review-time-label">${n}</div>
                    <div>${apo || '-'}</div>
                    <div>${eos || '-'}</div>
                </div>
            `;
        })
        .join('');
}

function renderEditableApologistikaRows(row) {
    return [1, 2, 3]
        .map((n) => {
            const p = pairNo(n);

            return `
                <div class="review-time-row">
                    <div class="review-time-label">${n}</div>

                    <input type="time"
                           class="form-control form-control-sm modal-edit-field modal-time-input"
                           id="edit_apo_ora_${p}_apologistika"
                           value="${row[`apo_ora_${p}_apologistika`] || ''}">

                    <input type="time"
                           class="form-control form-control-sm modal-edit-field modal-time-input"
                           id="edit_eos_ora_${p}_apologistika"
                           value="${row[`eos_ora_${p}_apologistika`] || ''}">
                </div>
            `;
        })
        .join('');
}

function renderApologistikaFields(row) {
    const possibleLeave = isAutoCalculatedLeavePresentation(row);
    const displayRow = possibleLeave
        ? { ...row, adeia_apologistika: false,
            kathgoria_adeias_apologistika:
                String(row.kathgoria_adeias_apologistika || '').trim() === 'POSSIBLE_LEAVE'
                    ? 'POSSIBLE_LEAVE' : '' }
        : row;
    const numberFields = [
        ['Ώρες εργασίας', 'ores_ergasias_apologistika'],
        ['Ώρες απουσίας', 'ores_apoysias_apologistika'],
        ['Ώρες νύχτας', 'ores_nyxtas_apologistika'],
        ['Προσαύξηση αργιών', 'ores_argion_prosayxhsh_apologistika'],
        ['Εργασία αργιών', 'ores_argion_ergasia_apologistika'],
        ['Πρόσθετη εργασία', 'ores_prostheths_ergasias_apologistika'],

        ['Υπερεργασία', 'ores_yperergasias_apologistika'],
        ['Υπερεργασία νύχτας', 'ores_yperergasias_nyxtas_apologistika'],
        ['Υπερεργασία αργίας', 'ores_yperergasias_argion_apologistika'],
        ['Υπερεργασία αργίας + νύχτας', 'ores_yperergasias_argion_nyxtas_apologistika'],

        ['Νόμιμη υπερωρία', 'ores_nominhs_yperorias_apologistika'],
        ['Νόμιμη υπερωρία νύχτας', 'ores_nominhs_yperorias_nyxtas_apologistika'],
        ['Νόμιμη υπερωρία αργίας', 'ores_nominhs_yperorias_argion_apologistika'],
        ['Νόμιμη υπερωρία αργίας + νύχτας', 'ores_nominhs_yperorias_argion_nyxtas_apologistika'],

        ['Παράνομη υπερωρία', 'ores_paranomhs_yperorias_apologistika'],
        ['Παράνομη υπερωρία νύχτας', 'ores_paranomhs_yperorias_nyxtas_apologistika'],
        ['Παράνομη υπερωρία αργίας', 'ores_paranomhs_yperorias_argion_apologistika'],
        ['Παράνομη υπερωρία αργίας + νύχτας', 'ores_paranomhs_yperorias_argion_nyxtas_apologistika']
    ];

    const checkboxFields = [
        ['Ρεπό', 'repo_apologistika'],
        ['Άδεια', 'adeia_apologistika'],
        ['Ασθένεια', 'astheneia_apologistika'],
        ['Κυριακή', 'kyriakes_apologistika']
    ];

    return `
        ${possibleLeave ? '<div class="alert alert-warning py-2"><strong>Κατάσταση:</strong> ΠΙΘΑΝΗ ΑΔΕΙΑ</div>' : ''}
        <div class="row g-2">
            ${numberFields
                .map(
                    ([label, field]) => `
                        <div class="col-md-3">
                            <label class="form-label review-total-label">
                                ${label}
                            </label>

                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                class="form-control form-control-sm modal-edit-field modal-number-input apologistika-number-field"
                                id="edit_${field}"
                                data-field="${field}"
                                value="${hours(row[field])}"
                            />
                        </div>
                    `
                )
                .join('')}
        </div>

        <hr>

        <div class="row g-2 align-items-center">
            ${checkboxFields
                .map(
                    ([label, field]) => `
                        <div class="col-md-3 d-flex align-items-center gap-2">
                            <label for="edit_${field}" class="form-label mb-0">
                                ${label}
                            </label>

                            <input
                                type="checkbox"
                                class="form-check-input custom-checkbox checkbox-class apologistika-checkbox-field"
                                id="edit_${field}"
                                data-field="${field}"
                                ${displayRow[field] ? 'checked' : ''}
                            />
                        </div>
                    `
                )
                .join('')}

                <div class="col-md-12">
                    <label class="form-label review-total-label">
                        Κατηγορία άδειας απολογιστικά
                    </label>

                    <input
                        type="hidden"
                        name="edit_kathgoria_adeias_apologistika_hidden"
                        id="edit_kathgoria_adeias_apologistika_hidden"
                        value="${displayRow.kathgoria_adeias_apologistika || ''}"
                    />

                    <select
                        class="tom-dropdown selectpicker-dropdown-normal left-align w-100 modal-edit-field"
                        name="edit_kathgoria_adeias_apologistika"
                        id="edit_kathgoria_adeias_apologistika"
                        data-field="kathgoria_adeias_apologistika"
                        data-api="/api/dropdown/ergazomenoi/kathgoria_adeias"
                        data-target-input="edit_kathgoria_adeias_apologistika_hidden"
                        data-preselect="edit_kathgoria_adeias_apologistika_hidden"
                        data-preload-all="true"
                        data-pad-length="6">
                    </select>
                </div>
        </div>
    `;
}

async function loadAuditHistory(recordId) {
    const container = document.getElementById('auditHistoryContainer');

    if (!container) return;

    container.innerHTML = '<div class="text-muted">Φόρτωση...</div>';

    try {
        const response = await fetch(`/api/prodhlomena-oraria/review/${recordId}/audit`, {
            method: 'GET',
            headers: {
                'CSRF-Token': csrfToken
            }
        });

        const payload = await response.json();

        if (!payload.success) {
            container.innerHTML = `
                <div class="text-danger">
                    ${payload.message || 'Αποτυχία φόρτωσης ιστορικού.'}
                </div>
            `;
            return;
        }

        if (!payload.rows || payload.rows.length === 0) {
            container.innerHTML = `
                <div class="text-muted">
                    Δεν υπάρχει ιστορικό αλλαγών.
                </div>
            `;
            return;
        }

        container.innerHTML = payload.rows.map((audit) => renderAuditRow(audit)).join('');

        container.querySelectorAll('.restore-audit-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const auditId = btn.dataset.auditId;
                restoreFromAudit(recordId, auditId);
            });
        });
    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <div class="text-danger">
                ${error.message}
            </div>
        `;
    }
}

function renderAuditRow(audit) {
    const changedAt = audit.changedAt ? new Date(audit.changedAt).toLocaleString('el-GR') : '';

    return `
        <div class="audit-row">
            <div class="audit-row-header">
                <strong>${changedAt}</strong>
                <span>${audit.changedBy || ''}</span>
            </div>

            <div class="audit-reason">
                ${audit.reason || '-'}
            </div>

            <div class="audit-values">
                ${renderAuditValues(audit.oldValues, audit.newValues)}
            </div>

            ${
                userCanReviewEdit()
                    ? `
                        <button
                            type="button"
                            class="btn btn-sm btn-warning mt-2 restore-audit-btn"
                            data-audit-id="${audit._id}">
                            <i class="bi bi-arrow-counterclockwise"></i>
                            Επαναφορά
                        </button>
                    `
                    : ''
            }
        </div>
    `;
}

const auditFieldLabels = {
    apo_ora_01_apologistika: 'Απολογιστικό Από 1',
    eos_ora_01_apologistika: 'Απολογιστικό Έως 1',
    apo_ora_02_apologistika: 'Απολογιστικό Από 2',
    eos_ora_02_apologistika: 'Απολογιστικό Έως 2',
    apo_ora_03_apologistika: 'Απολογιστικό Από 3',
    eos_ora_03_apologistika: 'Απολογιστικό Έως 3',

    ores_ergasias_apologistika: 'Ώρες εργασίας',
    ores_apoysias_apologistika: 'Ώρες απουσίας',
    ores_nyxtas_apologistika: 'Ώρες νύχτας',
    ores_argion_prosayxhsh_apologistika: 'Προσαύξηση αργιών',
    ores_argion_ergasia_apologistika: 'Εργασία αργιών',

    repo_apologistika: 'Ρεπό',
    adeia_apologistika: 'Άδεια',
    argia: 'Αργία',
    kathgoria_ergasias_apologistika: 'Κατηγορία εργασίας απολογιστικά',
    kathgoria_adeias_apologistika: 'Κατηγορία άδειας',
    astheneia_apologistika: 'Ασθένεια',
    kyriakes_apologistika: 'Κυριακή',

    is_locked: 'Κλειδωμένη εγγραφή',
    locked_by: 'Κλείδωμα από',
    locked_at: 'Κλείδωμα στις',
    unlocked_by: 'Ξεκλείδωμα από'
};

function auditLabel(field) {
    return auditFieldLabels[field] || field;
}

function renderAuditValues(oldValues = {}, newValues = {}) {
    const fields = Object.keys(newValues || {});

    if (fields.length === 0) {
        return '<div class="text-muted">Δεν υπάρχουν επιμέρους αλλαγές.</div>';
    }

    return `
        <table class="table table-sm table-bordered mb-0">
            <thead>
                <tr>
                    <th>Πεδίο</th>
                    <th>Πριν</th>
                    <th>Μετά</th>
                </tr>
            </thead>
            <tbody>
                ${fields
                    .map(
                        (field) => `
                            <tr>
                                <td>${auditLabel(field)}</td>
                                <td>${oldValues?.[field] ?? ''}</td>
                                <td>${newValues?.[field] ?? ''}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

async function restoreFromAudit(recordId, auditId) {
    try {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Επαναφορά εγγραφής',
            text: 'Θέλετε σίγουρα να επαναφέρετε τις προηγούμενες τιμές;',
            showCancelButton: true,
            confirmButtonText: 'Ναι, επαναφορά',
            cancelButtonText: 'Ακύρωση',
            reverseButtons: true
        });

        if (!result.isConfirmed) {
            return;
        }

        const response = await fetch(
            `/api/prodhlomena-oraria/review/${recordId}/restore/${auditId}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                }
            }
        );

        const payload = await response.json();

        if (!payload.success) {
            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: payload.message || 'Αποτυχία επαναφοράς.'
            });

            return;
        }

        Swal.fire({
            icon: 'success',
            title: 'Επιτυχία',
            text: payload.message || 'Η επαναφορά ολοκληρώθηκε.'
        });

        const modalElement = document.getElementById('detailsModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);

        modalInstance?.hide();

        await loadResults();
    } catch (error) {
        console.error(error);

        Swal.fire({
            icon: 'error',
            title: 'Σφάλμα',
            text: error.message
        });
    }
}

function validateReviewSave(updates) {
    const errors = [];

    const timeFields = [
        ['apo_ora_01_apologistika', 'eos_ora_01_apologistika'],
        ['apo_ora_02_apologistika', 'eos_ora_02_apologistika'],
        ['apo_ora_03_apologistika', 'eos_ora_03_apologistika']
    ];

    timeFields.forEach(([apoField, eosField], index) => {
        const apo = updates[apoField];
        const eos = updates[eosField];

        if ((apo && !eos) || (!apo && eos)) {
            errors.push(`Σειρά ${index + 1}: πρέπει να συμπληρωθούν και Από και Έως.`);
        }
    });

    document.querySelectorAll('.apologistika-number-field').forEach((input) => {
        const value = Number(input.value || 0);

        if (Number.isNaN(value)) {
            errors.push(
                `Το πεδίο "${input.closest('.col-md-3')?.querySelector('label')?.textContent?.trim()}" δεν είναι αριθμός.`
            );
        }

        if (value < 0) {
            errors.push(
                `Το πεδίο "${input.closest('.col-md-3')?.querySelector('label')?.textContent?.trim()}" δεν μπορεί να είναι αρνητικό.`
            );
        }
    });

    if (updates.adeia_apologistika === true && !updates.kathgoria_adeias_apologistika) {
        errors.push('Όταν υπάρχει Άδεια, πρέπει να συμπληρωθεί Κατηγορία άδειας απολογιστικά.');
    }

    if (updates.repo_apologistika === true && updates.adeia_apologistika === true) {
        errors.push('Δεν μπορεί να είναι ταυτόχρονα Ρεπό και Άδεια.');
    }

    return errors;
}

function showDetailsModal(row) {
    const html = `
    <div class="container-fluid">

        <div class="review-modal-section">
            <div class="review-modal-section-title">Στοιχεία Εγγραφής</div>

            <span class="review-badge">${formatDate(row.hmeromhnia)}</span>
            <span class="review-badge">Παράρτημα: ${row.ypokatasthma || ''}</span>
            <span class="review-badge">Κωδικός: ${row.kodikos || ''}</span>
            <span class="review-badge">${row.eponymo || ''} ${row.onoma || ''}</span>
            ${hasAdeiaSuggestion(row) ? '<span class="review-adeia-badge">⚠ Προτείνεται έλεγχος άδειας</span>' : ''}
        </div>

        <div class="review-modal-grid-3">

            <div class="review-modal-section program-section">
                <div class="review-modal-section-title">Προδηλωμένο Ωράριο</div>
                ${renderReadOnlyTimeRows(row, 'apo_ora', 'eos_ora')}
            </div>

            <div class="review-modal-section cards-section">
                <div class="review-modal-section-title">Κάρτες</div>
                ${renderReadOnlyTimeRows(row, 'cards_apo_ora', 'cards_eos_ora')}
            </div>

            <div class="review-modal-section apologistiko-section">
                <div class="review-modal-section-title">Απολογιστικό προς Διόρθωση</div>
                ${renderEditableApologistikaRows(row)}
            </div>

        </div>

        <div class="review-modal-section">
            <div class="review-modal-section-title">Flags</div>

            <span class="review-badge">Απολογιστικό: ${row.apologistiko_biblio ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
            <span class="review-badge">Ρεπό: ${row.repo ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
            <span class="review-badge">Αργία: ${row.argia ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
            <span class="review-badge">Κυριακή: ${row.kyriakes_apologistika ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
        </div>

        ${renderScenarioDetailsSection(row)}

        <div class="review-modal-section">
            <div class="review-modal-section-title">
                Απολογιστικά Πεδία
                ${hasAdeiaSuggestion(row) ? '<span class="review-adeia-badge">Προτείνεται έλεγχος άδειας</span>' : ''}
            </div>
            ${renderApologistikaFields(row)}
        </div>

        <div class="review-modal-section">
            <div class="review-modal-section-title">Αιτιολογία Αλλαγής</div>

            <textarea id="edit_reason" class="form-control" rows="3"></textarea>

            <div class="d-flex gap-2 mt-3">
                ${
                    userCanReviewEdit()
                        ? `
                            <button class="btn btn-success" id="saveRecordBtn">
                                <i class="bi bi-save"></i> Αποθήκευση
                            </button>
                        `
                        : ''
                }

                ${
                    row.is_locked && userCanReviewEdit()
                        ? `
                            <button class="btn btn-warning" id="unlockRecordBtn">
                                <i class="bi bi-unlock"></i> Ξεκλείδωμα
                            </button>
                        `
                        : ''
                }
            </div>
        </div>

        <div class="review-modal-section">
            <div class="review-modal-section-title">Ιστορικό Αλλαγών</div>

            <button class="btn btn-sm mb-2" id="loadAuditBtn">
                Φόρτωση ιστορικού
            </button>

            <div id="auditHistoryContainer">
                <div class="text-muted">
                    Πατήστε «Φόρτωση ιστορικού» για να εμφανιστούν οι αλλαγές.
                </div>
            </div>
        </div>
    </div>
    `;

    document.getElementById('detailsContainer').innerHTML = html;

    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    const lockBadge = document.getElementById('detailsLockBadge');

    if (lockBadge) {
        lockBadge.classList.toggle('d-none', !row.is_locked);
    }

    modal.show();

    // initModalKathgoriaAdeiasTomSelect();
    setTimeout(() => {
        initModalKathgoriaAdeiasTomSelect();
    }, 100);
    initModalMoveByEnter();

    document.getElementById('loadAuditBtn')?.addEventListener('click', () => {
        loadAuditHistory(row._id);
    });

    document.getElementById('fillScenarioProposedUpdatesBtn')?.addEventListener('click', () => {
        fillScenarioProposedUpdates(row);
    });

    document.getElementById('saveRecordBtn')?.addEventListener('click', async () => {
        try {
            const updates = {
                apo_ora_01_apologistika:
                    document.getElementById('edit_apo_ora_01_apologistika')?.value || '',

                eos_ora_01_apologistika:
                    document.getElementById('edit_eos_ora_01_apologistika')?.value || '',

                apo_ora_02_apologistika:
                    document.getElementById('edit_apo_ora_02_apologistika')?.value || '',

                eos_ora_02_apologistika:
                    document.getElementById('edit_eos_ora_02_apologistika')?.value || '',

                apo_ora_03_apologistika:
                    document.getElementById('edit_apo_ora_03_apologistika')?.value || '',

                eos_ora_03_apologistika:
                    document.getElementById('edit_eos_ora_03_apologistika')?.value || ''
            };

            document.querySelectorAll('.apologistika-number-field').forEach((input) => {
                updates[input.dataset.field] = Number(input.value || 0);
            });

            document.querySelectorAll('.apologistika-checkbox-field').forEach((input) => {
                updates[input.dataset.field] = input.checked;
            });

            updates.kathgoria_adeias_apologistika =
                document.getElementById('edit_kathgoria_adeias_apologistika_hidden')?.value || '';

            const validationErrors = validateReviewSave(updates);

            if (validationErrors.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Έλεγχος πεδίων',
                    html: validationErrors.map((x) => `<div>${x}</div>`).join('')
                });

                return;
            }

            const reason = document.getElementById('edit_reason')?.value || '';

            if (!reason.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Αιτιολογία',
                    text: 'Παρακαλώ συμπληρώστε αιτιολογία αλλαγής.'
                });

                return;
            }

            const response = await fetch(`/api/prodhlomena-oraria/review/${row._id}`, {
                method: 'PATCH',

                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },

                body: JSON.stringify({
                    updates,
                    reason
                })
            });

            const payload = await response.json();

            if (!payload.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα',
                    text: payload.message || 'Αποτυχία αποθήκευσης.'
                });

                return;
            }

            Swal.fire({
                icon: 'success',
                title: 'Επιτυχία',
                text: payload.message || 'Η εγγραφή αποθηκεύτηκε.'
            });

            modal.hide();

            await loadResults();
        } catch (error) {
            console.error(error);

            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: error.message
            });
        }
    });

    document.getElementById('unlockRecordBtn')?.addEventListener('click', async () => {
        try {
            const reason = document.getElementById('edit_reason')?.value || '';

            if (!reason.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Αιτιολογία',
                    text: 'Παρακαλώ συμπληρώστε αιτιολογία ξεκλειδώματος.'
                });

                return;
            }

            const response = await fetch(`/api/prodhlomena-oraria/review/${row._id}/unlock`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    reason
                })
            });

            const payload = await response.json();

            if (!payload.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα',
                    text: payload.message || 'Αποτυχία ξεκλειδώματος.'
                });

                return;
            }

            Swal.fire({
                icon: 'success',
                title: 'Επιτυχία',
                text: payload.message || 'Η εγγραφή ξεκλειδώθηκε.'
            });

            const modalElement = document.getElementById('detailsModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);

            modalInstance?.hide();

            await loadResults();
        } catch (error) {
            console.error(error);

            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: error.message
            });
        }
    });
}

function buildReviewExportParams() {
    return new URLSearchParams({
        apo_hmeromhnia: document.getElementById('apo_hmeromhnia')?.value || '',
        eos_hmeromhnia: document.getElementById('eos_hmeromhnia')?.value || '',
        ypokatasthma: document.getElementById('ypokatasthma')?.value || '',
        kodikos: document.getElementById('kodikos')?.value || '',
        only_apologistiko: document.getElementById('only_apologistiko')?.checked || false,
        only_nyxta: document.getElementById('only_nyxta')?.checked || false,
        only_argia: document.getElementById('only_argia')?.checked || false,
        only_yperergasia: document.getElementById('only_yperergasia')?.checked || false
    });
}
async function exportExcel() {
    const params = buildReviewExportParams();
    window.location.href = `/api/prodhlomena-oraria/review/export-excel?${params.toString()}`;
}

let currentPdfBlobUrl = null;
let currentPdfFileName = null;

async function exportPdf() {
    try {
        const response = await fetch(
            `/api/prodhlomena-oraria/review/export-pdf?${buildReviewExportParams().toString()}`,
            { method: 'GET', headers: { 'CSRF-Token': csrfToken } }
        );

        if (!response.ok) throw new Error('Αποτυχία δημιουργίας PDF.');

        const blob = await response.blob();

        if (currentPdfBlobUrl) {
            URL.revokeObjectURL(currentPdfBlobUrl);
        }

        currentPdfBlobUrl = URL.createObjectURL(blob);
        currentPdfFileName = `elegxos_apasxolhseon_${Date.now()}.pdf`;

        const iframe = document.getElementById('reviewPdfFrame');
        if (iframe) iframe.src = currentPdfBlobUrl;

        const modalEl = document.getElementById('pdfPreviewModal');
        if (modalEl && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } else {
            window.open(currentPdfBlobUrl, '_blank');
        }
    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message });
    }
}

function initReviewMoveByEnter() {
    const fields = Array.from(document.querySelectorAll('#reviewFiltersEnterScope .move-by-enter'));

    fields.forEach((field, index) => {
        field.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();

            const nextField = fields[index + 1];

            if (nextField) {
                nextField.focus();
                return;
            }

            document.getElementById('searchBtn')?.focus();
        });
    });
}

function initModalMoveByEnter() {
    const fields = Array.from(document.querySelectorAll('#detailsModal .modal-edit-field'));

    fields.forEach((field, index) => {
        field.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();

            const nextField = fields[index + 1];

            if (nextField) {
                nextField.focus();
                nextField.select?.();
                return;
            }

            document.getElementById('edit_reason')?.focus();
        });
    });
}

function initModalKathgoriaAdeiasTomSelect() {
    const select = document.getElementById('edit_kathgoria_adeias_apologistika');
    const hidden = document.getElementById('edit_kathgoria_adeias_apologistika_hidden');
    const adeiaCheckbox = document.getElementById('edit_adeia_apologistika');

    if (!select || !hidden) return;

    if (select.tomselect) {
        select.tomselect.destroy();
    }

    if (typeof TomSelect === 'undefined') {
        console.warn('[initModalKathgoriaAdeiasTomSelect] TomSelect not loaded.');
        return;
    }

    const tomSelect = new TomSelect(select, {
        valueField: 'value',
        labelField: 'label',
        searchField: ['label', 'text', 'perigrafh', 'kodikos', 'value'],
        preload: true,
        maxOptions: 500,
        // dropdownParent: '#detailsModal .modal-body',

        load: async function (query, callback) {
            try {
                const api = select.dataset.api;
                const url = `${api}?q=${encodeURIComponent(query || '')}`;

                const response = await fetch(url, {
                    headers: {
                        'CSRF-Token': csrfToken
                    }
                });

                const payload = await response.json();

                const rawOptions = Array.isArray(payload)
                    ? payload
                    : payload.results || payload.data || payload.items || payload.options || [];

                const options = rawOptions.map((item) => {
                    const value = item.value || item.kodikos || item.id || '';

                    const label =
                        item.label ||
                        item.text ||
                        `${item.kodikos || value} - ${item.perigrafh || ''}`;

                    return {
                        ...item,
                        value,
                        label
                    };
                });

                callback(options);
            } catch (error) {
                console.error(error);
                callback();
            }
        },

        onInitialize: function () {
            const value = hidden.value || '';

            if (value) {
                this.addOption({
                    value,
                    label: value
                });

                this.setValue(value, true);

                if (adeiaCheckbox) {
                    adeiaCheckbox.checked = true;
                }
            }
        },

        onChange: function (value) {
            hidden.value = value || '';

            if (adeiaCheckbox) {
                adeiaCheckbox.checked = !!value;
            }
        }
    });

    if (adeiaCheckbox) {
        adeiaCheckbox.addEventListener('change', () => {
            if (!adeiaCheckbox.checked) {
                hidden.value = '';
                tomSelect.clear(true);
            }
        });
    }
}

let suppressLoaderUntil = 0;

if (typeof window.showLoader === 'function' && !window.__reviewPdfShowLoaderPatched) {
    const originalShowLoader = window.showLoader;

    window.showLoader = function (...args) {
        if (Date.now() < suppressLoaderUntil) {
            return;
        }

        return originalShowLoader.apply(this, args);
    };

    window.__reviewPdfShowLoaderPatched = true;
}

document.getElementById('reviewPdfDownloadBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!currentPdfBlobUrl) return;

    const a = document.createElement('a');
    a.href = currentPdfBlobUrl;
    a.download = currentPdfFileName || `elegxos_apasxolhseon_${Date.now()}.pdf`;
    a.setAttribute('data-no-loader', 'true');
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    a.remove();

    if (typeof window.AppLoader?.hide === 'function') {
        window.AppLoader.hide();
    }
});

document.addEventListener('DOMContentLoaded', initReviewMoveByEnter);
document.addEventListener('DOMContentLoaded', ensureScenarioReviewFilterControl);
document.addEventListener('DOMContentLoaded', ensureReviewCardElevation);
document.addEventListener('DOMContentLoaded', bindHrReviewEvents);
document.getElementById('lockEmploymentPeriodBtn')?.addEventListener('click', () => {
    transitionEmploymentPeriod('lock').catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('unlockEmploymentPeriodBtn')?.addEventListener('click', () => {
    transitionEmploymentPeriod('unlock').catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('finalizeEmploymentPeriodBtn')?.addEventListener('click', () => {
    runEmploymentPeriodLifecycleAction('finalize').catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('submitFinalWTODayilyABtn')?.addEventListener('click', () => {
    submitFinalWTODayilyA().catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('openCorrectivePayrollBtn')?.addEventListener('click', () => {
    runEmploymentPeriodLifecycleAction('corrective').catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('calculateCorrectivePayrollBtn')?.addEventListener('click', () => {
    calculateCorrectivePayroll().catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('closeCorrectivePayrollBtn')?.addEventListener('click', () => {
    closeCorrectivePayroll().catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('postCorrectivePayrollBtn')?.addEventListener('click', () => {
    postCorrectivePayroll().catch((error) => Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }));
});
document.getElementById('exportExcelBtn')?.addEventListener('click', exportExcel);
document.getElementById('exportPdfBtn')?.addEventListener('click', exportPdf);
document.getElementById('searchBtn')?.addEventListener('click', loadResults);

window.EmploymentReviewHrTest = {
    setGroups(groups, completedGroupIds = []) {
        currentHrReviewProjection = { groups: Array.isArray(groups) ? groups : [] };
        currentRepoTransferDecisionsByProposalId = new Map(
            completedGroupIds.map((groupId) => [String(groupId), { current_decision: { decision_code: 'MARK_REVIEWED' } }])
        );
        currentHrReviewLoaded = true;
        classifyHrReviewGroups();
    },
    render: renderHrReviewWorkspace,
    diagnostics() {
        const groups = Array.isArray(currentHrReviewProjection?.groups) ? currentHrReviewProjection.groups : [];
        const employeeCodes = [...new Set(groups.flatMap((group) =>
            (Array.isArray(group.items) ? group.items : []).map((item) => String(item?.employee_kodikos || '').trim()).filter(Boolean)
        ))].sort();
        return {
            totalGroups: groups.length,
            pendingGroups: currentHrPendingGroups.length,
            completedGroups: currentHrCompletedGroups.length,
            uniqueEmployees: employeeCodes.length,
            employeeCodes
        };
    },
    groupForId(groupId) {
        return currentHrPendingGroups.find((group) => String(group.group_id || '') === String(groupId || '')) || null;
    },
    beginSubmit(groupId) {
        const key = String(groupId || '');
        if (!key || repoTransferDecisionSubmitting.has(key)) return false;
        repoTransferDecisionSubmitting.add(key);
        return true;
    },
    endSubmit(groupId) {
        repoTransferDecisionSubmitting.delete(String(groupId || ''));
    }
};
