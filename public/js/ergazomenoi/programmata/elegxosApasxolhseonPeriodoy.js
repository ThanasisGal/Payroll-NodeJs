const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

function userCanReviewEdit() {
    return document.getElementById('canReviewEdit')?.value === '1';
}

function canSeePolicyPriorityBadges() {
    return userCanReviewEdit();
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
    UNKNOWN_PATTERN_REQUIRES_REVIEW: 'Άγνωστο μοτίβο - προς έλεγχο',
    DECLARED_REPO_WITH_CARDS: 'Δηλωμένο ρεπό με κάρτες',
    DECLARED_WORK_NO_CARDS_LEAVE: 'Εργασία χωρίς κάρτες - άδεια',
    DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED: 'Εργασία χωρίς κάρτες - υποχρεωτική αργία',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED:
        'Μη υποχρεωτική αργία - εταιρεία κλειστή',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS:
        'Μη υποχρεωτική αργία - εταιρεία λειτουργεί',
    ZERO_LENGTH_CARD_INTERVAL: 'Μηδενικό διάστημα κάρτας',
    DECLARED_NON_WORK_WITH_CARDS: 'Μη εργασία με κάρτες',
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
    REPO_TRANSFER_CANDIDATE: 'Πιθανή μεταφορά ρεπό',
    LEGAL_CLASSIFICATION_REQUIRED: 'Απαιτείται νομοθετική ταξινόμηση',
    UNKNOWN_PATTERN: 'Άγνωστο μοτίβο'
};

const policyPreviewStatusLabels = {
    OK: {
        label: 'OK',
        description: 'Εντάξει',
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
        label: 'Άγνωστο μοτίβο',
        description: 'Άγνωστο μοτίβο',
        badgeClass: 'text-bg-secondary'
    }
};

const policyPreviewPolicyLabels = {
    NO_APOLOGISTIKO_BIBLIO_OK: 'Δεν αφορά απολογιστικό βιβλίο',
    CARD_NOT_REQUIRED_DECLARED_SCHEDULE_OK: 'Δεν απαιτείται κάρτα για προδηλωμένο ωράριο',
    DECLARED_REPO_OR_NON_WORK_WITH_CARDS: 'Δηλωμένο ρεπό ή μη εργασία με κάρτες',
    NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY: 'Εργασία χωρίς κάρτες λόγω άδειας ή αργίας',
    UNKNOWN: 'Άγνωστη πολιτική'
};

const policyPreviewScenarioLabels = {
    UNKNOWN_PATTERN_REQUIRES_REVIEW: 'Άγνωστο μοτίβο που χρειάζεται έλεγχο',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED:
        'Εργασία χωρίς κάρτες σε προαιρετική αργία με κλειστή εταιρεία',
    DECLARED_WORK_NO_CARDS_LEAVE: 'Εργασία χωρίς κάρτες λόγω άδειας',
    DECLARED_REPO_WITH_CARDS: 'Δηλωμένο ρεπό με κάρτες',
    DECLARED_NON_WORK_WITH_CARDS: 'Δηλωμένη μη εργασία με κάρτες',
    UNKNOWN: 'Άγνωστο σενάριο'
};

const policyPreviewActionLabels = {
    REVIEW_ONLY: 'Μόνο για έλεγχο',
    PREFILL: 'Προσυμπλήρωση',
    OK: 'Καμία ενέργεια',
    UNKNOWN: 'Άγνωστη ενέργεια'
};

const policyPreviewReasonLabels = {
    UNKNOWN_PATTERN: 'Άγνωστο μοτίβο',
    NO_APOLOGISTIKO_REVIEW_REQUIRED: 'Απαιτείται έλεγχος μη απολογιστικού βιβλίου',
    DECLARED_LEAVE_FOUND: 'Βρέθηκε δηλωμένη άδεια',
    DECLARED_HOLIDAY_FOUND: 'Βρέθηκε δηλωμένη αργία',
    CARD_NOT_REQUIRED: 'Δεν απαιτείται κάρτα εργασίας',
    EMPLOYEE_CARD_NOT_REQUIRED: 'Δεν απαιτείται κάρτα εργασίας',
    NO_APOLOGISTIKO_BIBLIO: 'Δεν αφορά απολογιστικό βιβλίο',
    UNKNOWN: 'Άγνωστη αιτιολογία'
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
let currentPolicyPreviewGrouping = null;
let currentAtomicRepoTransferProjection = null;
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

function renderScenarioBadge(row) {
    const decision = row?.scenarioDecision;

    if (!decision || !decision.scenario_code) return '';

    const label = scenarioLabel(decision);
    const confidence = scenarioConfidenceLabel(decision.confidence);
    const badgeClass =
        decision.requires_review === true
            ? 'review-scenario-badge review-scenario-badge-review'
            : 'review-scenario-badge review-scenario-badge-classified';
    const title = scenarioTitle(decision);
    const confidenceHtml = canSeePolicyPriorityBadges() && confidence
        ? `<span class="review-scenario-confidence">${escapeHtml(confidence)}</span>`
        : '';

    return `
        <div class="review-scenario-badge-row">
            <span class="${badgeClass}" title="${escapeHtml(title)}">
                ${escapeHtml(label)}
            </span>
            ${confidenceHtml}
        </div>
    `;
}

function isScenarioReviewRow(row) {
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
    renderReviewRows(getVisibleReviewRows(), currentReviewDeviations);
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
                ${confidence ? `<span class="review-badge">Βεβαιότητα: ${escapeHtml(confidence)}</span>` : ''}
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
    const dayName = days[dt.getDay()];

    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();

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
                gap: 0.25rem;
                margin-top: 0.25rem;
            }

            .review-scenario-badge {
                display: inline-block;
                padding: 0.12rem 0.4rem;
                border-radius: 999px;
                font-size: 0.72rem;
                font-weight: 700;
                line-height: 1.25;
                white-space: nowrap;
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
    const effectiveRepo = dev.effective_mhniaia_repo ?? dev.mhniaia_repo ?? dev.expected_repo ?? '';
    const effectiveType = employmentTypeLabel(dev.effective_typos_apasxolhshs);
    const effectiveDate = dev.effective_profile_date ? formatDate(dev.effective_profile_date) : '';
    const hasReadableEmploymentType =
        effectiveType && effectiveType !== '-' && !/^\d+$/.test(String(effectiveType));

    if (!dev.profile_changed_inside_week) {
        return `
            ${hasReadableEmploymentType ? `<div>${escapeHtml(effectiveType)}</div>` : ''}
            <small class="text-muted">Αναμενόμενα ρεπό profile: ${escapeHtml(effectiveRepo)}</small>
        `;
    }

    return `
        <div class="fw-bold text-warning-emphasis">Τελικό προφίλ εβδομάδας</div>
        ${hasReadableEmploymentType ? `<div>${escapeHtml(effectiveType)}</div>` : ''}
        <div>${escapeHtml(effectiveRepo)} ${Number(effectiveRepo) === 1 ? 'ρεπό' : 'ρεπό'}</div>
        ${
            effectiveDate
                ? `<small class="text-muted">Ισχύει από: ${escapeHtml(effectiveDate)}</small>`
                : ''
        }
    `;
}

function renderDeviationNoteCell(dev) {
    if (dev.profile_changed_inside_week) {
        const excessRepo =
            Number(dev.actual_repo ?? dev.pragmatikaRepo ?? 0) -
            Number(dev.expected_repo ?? dev.mhniaia_repo ?? 0);
        const excessText =
            excessRepo > 0
                ? `<div>Πλεονάζοντα ρεπό: <strong>${escapeHtml(excessRepo)}</strong></div>`
                : '';

        return `
            <div class="fw-bold text-warning-emphasis">
                ⚠ Αλλαγή όρων εργασίας μέσα στην εβδομάδα
            </div>
            <small class="text-muted">
                Υπερισχύουν οι όροι εργασίας που ίσχυαν το Σάββατο της εβδομάδας.
            </small>
            ${excessText}
            ${dev.note ? `<div class="small mt-1">${escapeHtml(dev.note)}</div>` : ''}
        `;
    }

    return dev.note ? escapeHtml(dev.note) : '-';
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
                <tr class="${dev.profile_changed_inside_week ? 'table-warning' : ''}">
                    <td>${formatDate(dev.week_apo || dev.weekStart)}</td>
                    <td>${formatDate(dev.week_eos || dev.weekEnd)}</td>
                    <td class="text-end">${escapeHtml(dev.expected_repo ?? dev.mhniaia_repo ?? '')}</td>
                    <td class="text-end fw-bold">${escapeHtml(dev.actual_repo ?? dev.pragmatikaRepo ?? '')}</td>
                    <td>${renderDeviationProfileCell(dev)}</td>
                    <td>${renderDeviationNoteCell(dev)}</td>
                </tr>
            `
        )
        .join('');

    wrapperTr.innerHTML = `
        <td colspan="13" class="p-2 bg-warning-subtle">
            <div class="fw-bold mb-1">Αποκλίσεις εβδομαδιαίων ρεπό</div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered mb-0 bg-white">
                    <thead class="table-light">
                        <tr>
                            <th>Από</th>
                            <th>Έως</th>
                            <th class="text-end">Αναμενόμενα ρεπό</th>
                            <th class="text-end">Πραγματικά ρεπό</th>
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

function renderReviewRows(rows = [], deviations = []) {
    ensureReviewTableStructure();

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

            groupTr.addEventListener('click', () => {
                groupTr.classList.toggle('collapsed');

                const rows = document.querySelectorAll(
                    `tr.employee-detail-row[data-group-id="${groupId}"],
                     tr.employee-subtotal-row[data-group-id="${groupId}"],
                     tr.employee-deviation-row[data-group-id="${groupId}"]`
                );

                rows.forEach((r) => {
                    r.classList.toggle('d-none');
                });
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

        const effectiveTyposApasxolhshs = String(
            row.effective_typos_apasxolhshs ?? row.typos_apasxolhshs ?? ''
        ).trim();
        const reviewPhaseCode = String(
            row.review_phase_code ?? row.review_kathestos_code ?? ''
        ).trim();

        const isFullTimeProfile = reviewPhaseCode
            ? reviewPhaseCode === '0'
            : row.effective_is_full_time === true ||
              row.effective_is_full_time === 'true' ||
              row.effective_is_full_time === 1 ||
              row.effective_is_full_time === '1' ||
              effectiveTyposApasxolhshs === '0';

        const isApologistikoRepoRow =
            row.apologistiko_biblio === true &&
            effectiveKathgoria === 'ΑΝ' &&
            num(row.cards_ores_ergasias) === 0 &&
            isFullTimeProfile;

        const isApologistikoNonWorkRow =
            row.apologistiko_biblio === true &&
            (effectiveKathgoria === 'ΜΕ' || (effectiveKathgoria === 'ΑΝ' && !isFullTimeProfile)) &&
            num(row.cards_ores_ergasias) === 0;

        const noCardsDisplayStatus = String(
            row.noCardsDisplayStatus || row.no_cards_display_status || ''
        ).trim();
        const hasNoCardsDisplayStatus =
            noCardsDisplayStatus === 'ΑΔΕΙΑ' || noCardsDisplayStatus === 'ΑΡΓΙΑ';

        const apologistikoDisplayText = hasNoCardsDisplayStatus
            ? noCardsDisplayStatus
            : isApologistikoRepoRow
            ? 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ'
            : isApologistikoNonWorkRow
              ? 'ΜΗ ΕΡΓΑΣΙΑ'
              : apologistikoText;

        const apologistikoDisplayClass = hasNoCardsDisplayStatus
            ? noCardsDisplayStatus === 'ΑΔΕΙΑ'
                ? 'cell-no-card-adeia'
                : 'cell-no-card-argia'
            : isApologistikoRepoRow
            ? 'cell-repo-day'
            : isApologistikoNonWorkRow
              ? 'cell-non-work-day'
              : isApologistikoIntervalPresent(row)
                ? 'cell-apologistiko'
                : hasAdeiaSuggestion(row)
                  ? 'cell-adeia-suggestion'
                  : '';

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

        const argiaHoursValue = hours(calculateHolidayDisplayHours(row, holidayLikeDateSet));

        const yperoriaTotal = sumNomimiYperoria(row) + sumParanomiYperoria(row);

        tr.innerHTML = `
            <td>${renderReviewDateCell(row)}</td>
            <td>${row.ypokatasthma || ''}</td>
            <td>${row.kodikos || ''}</td>
            <td${tdClass(declaredClass)}>${declaredText}</td>
            <td>${renderIntervalCell(row, 'cards_apo_ora', 'cards_eos_ora')}</td>
            <td${tdClass(apologistikoDisplayClass)}>
                ${apologistikoDisplayText}
                ${renderScenarioBadge(row)}
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
            label: 'Άγνωστη τιμή',
            description: 'Άγνωστη τιμή',
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

    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();

    return `${day}/${month}/${year}`;
}

function formatPolicyPreviewHours(value) {
    if (value === null || value === undefined || value === '') return '-';

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) return '-';

    return numericValue.toFixed(2);
}

function formatPolicyPreviewUnknownCode(value, fallbackLabel = 'Άγνωστη τιμή') {
    const key = String(value || '').trim();

    return key ? fallbackLabel : '-';
}

function getPolicyPreviewPolicyLabel(policyCode) {
    const key = String(policyCode || '').trim() || 'UNKNOWN';

    return policyPreviewPolicyLabels[key] || formatPolicyPreviewUnknownCode(key, 'Άγνωστη πολιτική');
}

function getPolicyPreviewScenarioLabel(scenarioCode) {
    const key = String(scenarioCode || '').trim() || 'UNKNOWN';

    return (
        policyPreviewScenarioLabels[key] || formatPolicyPreviewUnknownCode(key, 'Άγνωστο σενάριο')
    );
}

function getPolicyPreviewActionLabel(actionType) {
    const key = String(actionType || '').trim() || 'UNKNOWN';

    return policyPreviewActionLabels[key] || formatPolicyPreviewUnknownCode(key, 'Άγνωστη ενέργεια');
}

function getPolicyPreviewReasonLabel(reasonCode) {
    const key = String(reasonCode || '').trim() || 'UNKNOWN';

    return policyPreviewReasonLabels[key] || formatPolicyPreviewUnknownCode(key, 'Άγνωστη αιτιολογία');
}

function getPolicyPreviewFlagLabel(flagKey) {
    const key = String(flagKey || '').trim();

    return policyPreviewFlagLabels[key] || formatPolicyPreviewUnknownCode(key, 'Άγνωστη ένδειξη');
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

    if (policyLabel && policyLabel !== 'Άγνωστη πολιτική') return policyLabel;
    if (scenarioLabel && scenarioLabel !== 'Άγνωστο σενάριο') return scenarioLabel;

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
        atomicGroupProjection: payload.atomic_group_projection || null
    };
}

function buildPolicyPreviewApprovalsParams(baseParams) {
    return new URLSearchParams({
        apo_hmeromhnia: baseParams.get('apo_hmeromhnia') || '',
        eos_hmeromhnia: baseParams.get('eos_hmeromhnia') || '',
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
            decisionTypes: new Set(),
            count: 0
        };
        const decisionType = String(record?.decision_type || '').trim();

        if (decisionType) existing.decisionTypes.add(decisionType);
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
    const buttons = [...policyPreviewDecisionButtons];

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
    const existingDecisionTypes = approvalState?.decisionTypes || new Set();
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
                latest.notes
                    ? `<div class="small mt-1"><span class="fw-semibold">Σημειώσεις:</span> ${escapeHtml(
                          latest.notes
                      )}</div>`
                    : ''
            }
        `
        : '<div class="small text-muted">Δεν έχει καταγραφεί απόφαση για αυτή την ομάδα.</div>';

    const buttonsHtml = getPolicyPreviewDecisionButtons(group)
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

async function confirmPolicyPreviewDecision(decisionType) {
    const decisionLabel = getPolicyPreviewDecisionLabel(decisionType);
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
            </div>
        `,
        input: 'textarea',
        inputLabel: 'Σημειώσεις',
        inputPlaceholder: 'Προαιρετικές σημειώσεις',
        inputAttributes: { maxlength: '2000' },
        showCancelButton: true,
        confirmButtonText: 'Καταγραφή απόφασης',
        cancelButtonText: 'Άκυρο',
        reverseButtons: true
    });

    return result.isConfirmed ? String(result.value || '').trim() : null;
}

async function submitPolicyPreviewDecision(group, decisionType) {
    if (policyPreviewApprovalSubmitting) return;
    if (!currentPolicyPreviewBaseParams) {
        throw new Error('Δεν είναι διαθέσιμη η περίοδος της προεπισκόπησης.');
    }
    if (!group?.group_id || !group?.group_key || !Array.isArray(group?.items) || !group.items.length) {
        throw new Error('Η ομάδα δεν περιέχει έγκυρα δεδομένα για καταγραφή απόφασης.');
    }

    const notes = await confirmPolicyPreviewDecision(decisionType);
    if (notes === null) return;

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
                group: {
                    group_id: group.group_id,
                    group_key: group.group_key,
                    scope: currentPolicyPreviewGrouping?.scope || 'page',
                    status: group.status,
                    policy_code: group.policy_code,
                    scenario_code: group.scenario_code,
                    action_type: group.action_type,
                    reason_code: group.reason_code
                },
                decision_type: decisionType,
                notes,
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

        renderPolicyPreviewGroups(currentPolicyPreviewGrouping, {
            expandedGroupId: group.group_id
        });

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

function renderPolicyPreviewGroupingSummary(grouping) {
    const summary = grouping?.summary || {};
    const byStatus = summary.by_status || {};
    const statusEntries = Object.entries(byStatus);

    return `
        <div class="policy-preview-summary-meta mb-2">
            <span class="badge text-bg-light border">
                Εμβέλεια: ${escapeHtml(getPolicyPreviewScopeLabel(grouping?.scope))}
            </span>
            <span class="badge text-bg-light border">
                Σύνολο εγγραφών σελίδας: ${escapeHtml(summary.total ?? 0)}
            </span>
            <span class="badge text-bg-light border">
                Ομάδες: ${escapeHtml(summary.groups_count ?? 0)}
            </span>
        </div>
        <div class="small text-muted mb-2">
            Η ομαδοποίηση αφορά τις εγγραφές της τρέχουσας σελίδας αποτελεσμάτων.
        </div>
        <div class="policy-preview-summary-meta">
            <span class="small fw-semibold">Ανά κατάσταση:</span>
            ${
                statusEntries.length > 0
                    ? statusEntries
                          .map(
                              ([status, count]) => `
                                  <span class="badge text-bg-light border">
                                      ${renderPolicyPreviewStatusBadge(status)}
                                      <span class="ms-1">${escapeHtml(count)}</span>
                                  </span>
                              `
                          )
                          .join('')
                    : '<span class="small text-muted">-</span>'
            }
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
    const row = reviewRow || {};
    const rows = reviewRow
        ? [
              ['Παράρτημα', row.ypokatasthma || '-'],
              ['Κωδικός εργαζομένου', row.kodikos || item.employee_kodikos || '-'],
              ['Ημερομηνία', formatPolicyPreviewDate(row.hmeromhnia || item.hmeromhnia)],
              ['Προδηλωμένο', row.kathgoria_ergasias || item.kathgoria_ergasias || '-'],
              ['Ωράριο', formatPolicyPreviewIntervals(row, 'apo_ora', 'eos_ora')],
              ['Προδηλωμένες ώρες', formatPolicyPreviewHours(row.ores_ergasias)],
              ['Κάρτες', formatPolicyPreviewIntervals(row, 'cards_apo_ora', 'cards_eos_ora')],
              ['Ώρες καρτών', formatPolicyPreviewHours(row.cards_ores_ergasias ?? item.cards_ores_ergasias)],
              [
                  'Απολογιστικό',
                  row.kathgoria_ergasias_apologistika ||
                      item.kathgoria_ergasias_apologistika ||
                      '-'
              ],
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
        ['Προδηλωμένο', item.kathgoria_ergasias || '-'],
        ['Απολογιστικό', item.kathgoria_ergasias_apologistika || '-'],
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
    const note = reviewRow
        ? 'Εμφανίζονται τα στοιχεία που είναι ήδη διαθέσιμα στο τρέχον read-only response της σελίδας.'
        : 'Τα πλήρη στοιχεία της εγγραφής δεν είναι διαθέσιμα στο τρέχον response. Για πλήρη στοιχεία ProdhlomenaOrariaModel θα χρειαστεί ξεχωριστό read-only endpoint.';
    const html = `
        <div class="text-start">
            <table class="table table-sm table-bordered align-middle mb-2">
                <tbody>
                    ${renderPolicyPreviewDetailsRows(item, reviewRow)}
                    <tr>
                        <th class="text-start">Προτεινόμενες τιμές</th>
                        <td>${renderPolicyPreviewCompactValues(item.proposed_values)}</td>
                    </tr>
                    <tr>
                        <th class="text-start">Ενδείξεις</th>
                        <td>${renderPolicyPreviewFlags(item.flags)}</td>
                    </tr>
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

function renderPolicyPreviewGroupItems(items = [], groupIndex = 0) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<div class="text-muted small p-2">Δεν υπάρχουν items για αυτή την ομάδα.</div>';
    }

    return `
        <table class="table table-sm table-bordered align-middle mb-0 policy-preview-items-table">
                <thead class="table-light">
                    <tr>
                        <th>Κωδικός</th>
                        <th>Ημ/νία</th>
                        <th>Προδηλωμένο</th>
                        <th>Απολογιστικό</th>
                        <th>Ώρες καρτών</th>
                        <th>Ενδείξεις</th>
                        <th>Λεπτομέρειες</th>
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
                                    <td>${escapeHtml(formatPolicyPreviewHours(item.cards_ores_ergasias))}</td>
                                    <td>${renderPolicyPreviewFlags(item.flags)}</td>
                                    <td>
                                        <button
                                            type="button"
                                            class="btn btn-sm btn-outline-primary policy-preview-details-btn"
                                            data-group-index="${escapeHtml(groupIndex)}"
                                            data-item-index="${escapeHtml(itemIndex)}">
                                            Εμφάνιση
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

function renderAtomicRepoTransferItem(item = {}, role) {
    const isSource = role === 'SOURCE_BECOMES_WORK';
    const proposedValues = item.proposed_values || {};
    const title = isSource ? 'Ημέρα που γίνεται εργασία' : 'Ημέρα που γίνεται ρεπό';
    const panelClass = isSource
        ? 'atomic-repo-transfer-source'
        : 'atomic-repo-transfer-target';
    const currentCategory = item.kathgoria_ergasias || '-';
    const proposedCategory =
        proposedValues.kathgoria_ergasias_apologistika ||
        item.kathgoria_ergasias_apologistika ||
        '-';
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
                    <dt>Τρέχον</dt>
                    <dd>${escapeHtml(currentCategory)}</dd>
                </div>
                <div>
                    <dt>Πρόταση</dt>
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
        'Το επιλεγμένο διάστημα δεν περιλαμβάνει ολόκληρη εβδομάδα.',
    NO_SOURCE_CANDIDATE:
        'Δεν βρέθηκε ημέρα ρεπό κατά την οποία ο εργαζόμενος απασχολήθηκε.',
    REPO_DEFICIT_REMAINS:
        'Η προτεινόμενη αλλαγή δεν αποκαθιστά τον απαιτούμενο αριθμό ρεπό.',
    INCOMPLETE_EMPLOYEE_WEEK: 'Δεν υπάρχουν πλήρη στοιχεία για ολόκληρη την εβδομάδα.',
    ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED:
        'Η εκ περιτροπής απασχόληση δεν υποστηρίζεται ακόμη από την αυτόματη διαδικασία.',
    NO_TARGET_CANDIDATE: 'Δεν βρέθηκε διαθέσιμη ημέρα για τη μεταφορά του ρεπό.',
    INVALID_MHNIAIA_REPO: 'Ο προβλεπόμενος αριθμός εβδομαδιαίων ρεπό δεν είναι έγκυρος.',
    MULTIPLE_SOURCE_CANDIDATES:
        'Βρέθηκαν περισσότερες από μία πιθανές ημέρες εργασίας σε δηλωμένο ρεπό και απαιτείται επιλογή.'
});

const atomicRepoTransferUnknownDiagnosticLabel = 'Άλλη περίπτωση που χρειάζεται έλεγχο.';

function getAtomicRepoTransferDiagnosticEntries(reasonCounts = {}) {
    return Object.entries(reasonCounts || {})
        .map(([code, rawCount]) => ({
            count: Number(rawCount),
            label:
                atomicRepoTransferDiagnosticLabels[String(code || '').trim()] ||
                atomicRepoTransferUnknownDiagnosticLabel
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
                    .map(({ count, label }) => {
                        const countLabel = count === 1 ? 'περίπτωση' : 'περιπτώσεις';
                        return `<div class="atomic-repo-transfer-diagnostic-message">${escapeHtml(
                            count
                        )} ${countLabel}: ${escapeHtml(label)}</div>`;
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

function renderAtomicRepoTransferGroup(group = {}, index = 0) {
    const items = Array.isArray(group.items) ? group.items : [];
    const source = items.find((item) => item?.role === 'SOURCE_BECOMES_WORK') || {};
    const target = items.find((item) => item?.role === 'TARGET_BECOMES_REPO') || {};
    const employeeCode = source.employee_kodikos || target.employee_kodikos || '-';
    const warnings = Array.isArray(group.warnings) ? group.warnings : [];
    const isExpanded = index === 0;
    const detailsId = `atomicRepoTransferPair-${index}`;
    return `
        <article class="atomic-repo-transfer-group" data-atomic-group-id="${escapeHtml(
            group.group_id || ''
        )}">
            <div class="atomic-repo-transfer-group-header">
                <div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <span class="badge text-bg-warning">Πρόταση προς έλεγχο από HR</span>
                        <span class="fw-semibold">Συνδεδεμένη πρόταση μεταφοράς ρεπό</span>
                    </div>
                    <div class="small text-muted">
                        Εργαζόμενος: ${escapeHtml(employeeCode)} · Ημερομηνίες πρότασης:
                        ${escapeHtml(formatPolicyPreviewDate(group.first_date))}–${escapeHtml(
                            formatPolicyPreviewDate(group.last_date)
                        )}
                    </div>
                    <div class="atomic-repo-transfer-safety-flags">
                        <span>Μία πρόταση / δύο συνδεδεμένες αλλαγές</span>
                        <span>Μόνο για έλεγχο</span>
                        <span>Δεν μπορεί να εφαρμοστεί</span>
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
            <div
                class="atomic-repo-transfer-pair ${isExpanded ? '' : 'd-none'}"
                id="${escapeHtml(detailsId)}">
                <div class="atomic-repo-transfer-pair-grid">
                    ${renderAtomicRepoTransferItem(source, 'SOURCE_BECOMES_WORK')}
                    ${renderAtomicRepoTransferItem(target, 'TARGET_BECOMES_REPO')}
                </div>
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
}

function renderAtomicRepoTransferProjection(projection) {
    if (!projection) return '';

    const groups = Array.isArray(projection.groups) ? projection.groups : [];
    const groupsHtml = groups.length
        ? groups.map((group, index) => renderAtomicRepoTransferGroup(group, index)).join('')
        : `
            <div class="atomic-repo-transfer-empty">
                Δεν δημιουργήθηκε αυτόματη πρόταση.
            </div>
        `;

    return `
        <section class="atomic-repo-transfer-section" aria-labelledby="atomicRepoTransferTitle">
            <div class="card border rounded atomic-repo-transfer-card">
                <div class="card-body">
                    <div class="atomic-repo-transfer-header">
                        <div class="fw-semibold" id="atomicRepoTransferTitle">
                            Προτάσεις Μεταφοράς Ρεπό
                        </div>
                        <span class="atomic-repo-transfer-readonly-badge">Μόνο για έλεγχο</span>
                    </div>
                    <div class="atomic-repo-transfer-main-warning">
                        <div>Η πρόταση μεταφοράς ρεπό περιλαμβάνει δύο συνδεδεμένες αλλαγές και εφαρμόζεται μόνο ως σύνολο.</div>
                        <div>Η πρόταση εμφανίζεται μόνο για έλεγχο. Δεν έχει γίνει καμία αλλαγή στα δεδομένα.</div>
                    </div>
                    <div class="atomic-repo-transfer-unavailable">
                        Η εφαρμογή της πρότασης δεν είναι ακόμη διαθέσιμη.
                    </div>
                    ${renderAtomicRepoTransferSummary(projection)}
                    ${renderAtomicRepoTransferDiagnostics(projection)}
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
    const groupsHtml =
        groups.length > 0
            ? groups
                  .map((group, index) => {
                      const groupElementId = `policyPreviewGroupItems-${index}`;
                      const groupTitle = getPolicyPreviewGroupTitle(group);
                      const groupDescription = renderPolicyPreviewGroupDescription(group);
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
                                      <div class="policy-preview-group-line text-muted mb-1">
                                          Εγγραφές: ${escapeHtml(group.count ?? 0)}
                                          · Εργαζόμενοι: ${escapeHtml(group.employees_count ?? 0)}
                                          · Από: ${escapeHtml(formatPolicyPreviewDate(group.first_date))}
                                          · Έως: ${escapeHtml(formatPolicyPreviewDate(group.last_date))}
                                      </div>
                                      <div class="policy-preview-group-line text-muted">
                                          ${escapeHtml(groupDescription)}
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
                              ${renderPolicyPreviewApprovalPanel(group, index)}
                              <div
                                  class="policy-preview-group-items ${isExpanded ? '' : 'd-none'} mt-2"
                                  id="${escapeHtml(groupElementId)}">
                                  ${renderPolicyPreviewGroupItems(group.items, index)}
                              </div>
                          </div>
                      `;
                  })
                  .join('')
            : `
                <div class="text-muted small border rounded p-2">
                    Δεν βρέθηκαν ομάδες για τα τρέχοντα φίλτρα.
                </div>
            `;

    container.innerHTML = `
        ${renderAtomicRepoTransferProjection(currentAtomicRepoTransferProjection)}
        <div class="card border rounded policy-preview-card">
            <div class="card-body">
                <div class="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-1">
                    <div>
                        <div class="fw-semibold">Ομαδοποίηση Ελέγχου Πολιτικών</div>
                    </div>
                    <span class="badge text-bg-light border">Έκδοση: ${escapeHtml(grouping.version ?? '-')}</span>
                </div>
                ${renderPolicyPreviewGroupingSummary(grouping)}
                ${
                    currentPolicyPreviewApprovalsError
                        ? `<div class="alert alert-warning py-1 px-2 small mb-2">${escapeHtml(
                              currentPolicyPreviewApprovalsError
                          )}</div>`
                        : ''
                }
                ${renderPolicyPreviewApprovalHistorySection()}
                ${renderPolicyPreviewApplyDryRunSection()}
                <hr class="my-2">
                ${groupsHtml}
            </div>
        </div>
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
}

async function loadResults() {
    try {
        currentAtomicRepoTransferProjection = null;
        renderPolicyPreviewGroups(null, { loading: true });

        const params = new URLSearchParams({
            apo_hmeromhnia: document.getElementById('apo_hmeromhnia')?.value || '',
            eos_hmeromhnia: document.getElementById('eos_hmeromhnia')?.value || '',
            ypokatasthma: document.getElementById('ypokatasthma')?.value || '',
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
        try {
            const scenarioRows = await fetchScenarioClassifications(params);
            const scenarioByProdhlomenaId = buildScenarioClassificationsMap(scenarioRows);
            attachScenarioClassifications(rows, scenarioByProdhlomenaId);
        } catch (scenarioError) {
            console.warn('[loadResults] Scenario classifications unavailable:', scenarioError);
        }

        currentReviewRows = rows;
        currentReviewDeviations = payload.deviations || [];
        renderCurrentReviewRows();

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
                                ${row[field] ? 'checked' : ''}
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
                        value="${row.kathgoria_adeias_apologistika || ''}"
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
document.getElementById('exportExcelBtn')?.addEventListener('click', exportExcel);
document.getElementById('exportPdfBtn')?.addEventListener('click', exportPdf);
document.getElementById('searchBtn')?.addEventListener('click', loadResults);
