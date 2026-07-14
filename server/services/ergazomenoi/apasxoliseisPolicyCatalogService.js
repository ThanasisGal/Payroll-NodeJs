// Pure policy catalog for Apasxoliseis scenario handling.
// This module must stay free of DB, controller, route, network, and filesystem dependencies.

const POLICY_RESULT_STATUS = Object.freeze({
    OK: 'OK',
    RESOLVED_BY_POLICY: 'RESOLVED_BY_POLICY',
    PREFILLED_PENDING_APPROVAL: 'PREFILLED_PENDING_APPROVAL',
    NEEDS_REVIEW: 'NEEDS_REVIEW',
    UNKNOWN_PATTERN: 'UNKNOWN_PATTERN',
    CONFLICT_AMBIGUOUS: 'CONFLICT_AMBIGUOUS'
});

const POLICY_MODE = Object.freeze({
    REVIEW_ONLY: 'REVIEW_ONLY',
    SUGGESTION: 'SUGGESTION',
    PREFILL: 'PREFILL',
    AUTO_APPLY: 'AUTO_APPLY'
});

// Safety level describes policy risk/review sensitivity, not confidence.
const POLICY_SAFETY_LEVEL = Object.freeze({
    LOW_RISK: 'LOW_RISK',
    MEDIUM_RISK: 'MEDIUM_RISK',
    HIGH_RISK: 'HIGH_RISK'
});

const POLICY_CATEGORIES = Object.freeze({
    BASELINE_OK: 'BASELINE_OK',
    ABSENCE_OR_HOLIDAY: 'ABSENCE_OR_HOLIDAY',
    WEEKLY_REPO: 'WEEKLY_REPO',
    CARDS_ON_NON_WORK: 'CARDS_ON_NON_WORK'
});

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }

    Object.freeze(value);

    Object.getOwnPropertyNames(value).forEach((propertyName) => {
        deepFreeze(value[propertyName]);
    });

    return value;
}

const POLICY_RESULT_STATUS_DEFINITIONS = deepFreeze([
    {
        status: POLICY_RESULT_STATUS.OK,
        label: 'Εντάξει',
        description: 'Η πολιτική ολοκληρώθηκε χωρίς ανάγκη περαιτέρω ενέργειας.'
    },
    {
        status: POLICY_RESULT_STATUS.RESOLVED_BY_POLICY,
        label: 'Επιλύθηκε από πολιτική',
        description: 'Το pattern εξηγήθηκε από πολιτική χωρίς αλλαγή δεδομένων.'
    },
    {
        status: POLICY_RESULT_STATUS.PREFILLED_PENDING_APPROVAL,
        label: 'Προσυμπληρώθηκε προς έγκριση',
        description: 'Υπάρχει προτεινόμενη προσυμπλήρωση που απαιτεί ανθρώπινη έγκριση.'
    },
    {
        status: POLICY_RESULT_STATUS.NEEDS_REVIEW,
        label: 'Χρειάζεται έλεγχο',
        description: 'Η περίπτωση πρέπει να ελεγχθεί από χρήστη πριν αποφασιστεί.'
    },
    {
        status: POLICY_RESULT_STATUS.UNKNOWN_PATTERN,
        label: 'Άγνωστο pattern',
        description: 'Δεν υπάρχει αρκετά σαφής αντιστοίχιση με γνωστή πολιτική.'
    },
    {
        status: POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS,
        label: 'Αμφίσημη σύγκρουση',
        description: 'Υπάρχουν συγκρουόμενα facts ή περισσότερες από μία πιθανές εξηγήσεις.'
    }
]);

const POLICY_MODE_DEFINITIONS = deepFreeze([
    {
        mode: POLICY_MODE.REVIEW_ONLY,
        label: 'Μόνο έλεγχος',
        description: 'Η πολιτική ταξινομεί ή εξηγεί την περίπτωση χωρίς προτεινόμενη αλλαγή.'
    },
    {
        mode: POLICY_MODE.SUGGESTION,
        label: 'Πρόταση',
        description: 'Η πολιτική μπορεί να εμφανίσει πρόταση προς αξιολόγηση από χρήστη.'
    },
    {
        mode: POLICY_MODE.PREFILL,
        label: 'Προσυμπλήρωση',
        description: 'Η πολιτική μπορεί να προτείνει πεδία για προσυμπλήρωση πριν από έγκριση.'
    },
    {
        mode: POLICY_MODE.AUTO_APPLY,
        label: 'Αυτόματη εφαρμογή',
        description: 'Μελλοντική λειτουργία για αυτόματη εφαρμογή πολιτικής όπου επιτρέπεται.'
    }
]);

const APASXOLISEIS_POLICY_CATALOG = deepFreeze([
    {
        policy_code: 'CARD_NOT_REQUIRED_DECLARED_SCHEDULE_OK',
        policy_version: 'preview:v1',
        title: 'Χωρίς υποχρέωση κάρτας εργασίας',
        description:
            'Τα προδηλωμένα ωράρια θεωρούνται αποδεκτά όταν ο εργαζόμενος δεν έχει υποχρέωση κάρτας εργασίας.',
        category: POLICY_CATEGORIES.BASELINE_OK,
        default_mode: POLICY_MODE.REVIEW_ONLY,
        supported_modes: [POLICY_MODE.REVIEW_ONLY],
        default_priority: 10,
        safety_level: POLICY_SAFETY_LEVEL.LOW_RISK,
        batch_approvable: false,
        requires_human_approval: false,
        required_facts: ['employee.karta_ergasias'],
        allowed_parameters_schema: {},
        proposed_update_fields: [],
        result_statuses: [POLICY_RESULT_STATUS.OK],
        related_scenario_codes: [],
        notes: [
            'Βασική ταξινόμηση μόνο για προεπισκόπηση χωρίς αλλαγές.',
            'Δεν δημιουργεί προτεινόμενες αλλαγές και δεν εφαρμόζει ενημερώσεις.'
        ]
    },
    {
        policy_code: 'NO_APOLOGISTIKO_BIBLIO_OK',
        policy_version: 'preview:v1',
        title: 'Δεν αφορά απολογιστικό βιβλίο',
        description:
            'Η εγγραφή θεωρείται αποδεκτή στην προεπισκόπηση όταν δεν αφορά απολογιστικό βιβλίο.',
        category: POLICY_CATEGORIES.BASELINE_OK,
        default_mode: POLICY_MODE.REVIEW_ONLY,
        supported_modes: [POLICY_MODE.REVIEW_ONLY],
        default_priority: 20,
        safety_level: POLICY_SAFETY_LEVEL.LOW_RISK,
        batch_approvable: false,
        requires_human_approval: false,
        required_facts: ['row.apologistiko_biblio'],
        allowed_parameters_schema: {},
        proposed_update_fields: [],
        result_statuses: [POLICY_RESULT_STATUS.OK],
        related_scenario_codes: [],
        notes: [
            'Βασική ταξινόμηση μόνο για προεπισκόπηση χωρίς αλλαγές.',
            'Δεν δημιουργεί προτεινόμενες αλλαγές και δεν εφαρμόζει ενημερώσεις.'
        ]
    },
    {
        policy_code: 'NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY',
        policy_version: 'foundation:v1',
        title: 'Προδηλωμένη εργασία χωρίς κάρτες λόγω άδειας ή αργίας',
        description:
            'Εξηγεί προδηλωμένη ΕΡΓ χωρίς κάρτες όταν τα facts δείχνουν καταχωρημένη άδεια ή αργία.',
        category: POLICY_CATEGORIES.ABSENCE_OR_HOLIDAY,
        default_mode: POLICY_MODE.SUGGESTION,
        supported_modes: [
            POLICY_MODE.REVIEW_ONLY,
            POLICY_MODE.SUGGESTION,
            POLICY_MODE.PREFILL
        ],
        default_priority: 100,
        safety_level: POLICY_SAFETY_LEVEL.MEDIUM_RISK,
        batch_approvable: true,
        requires_human_approval: true,
        required_facts: [
            'declared.isDeclaredWork',
            'declared.hasDeclaredHours',
            'cards.hasCards',
            'leave.hasDeclaredLeave',
            'holiday.isHoliday',
            'holiday.isMandatoryHoliday',
            'holiday.isOptionalHoliday',
            'holiday.companyWorksOnMandatoryHoliday',
            'holiday.companyWorksOnOptionalHoliday'
        ],
        allowed_parameters_schema: {
            allow_optional_holiday_leave_suggestion: {
                type: 'boolean',
                default: true,
                description: 'Επιτρέπει πρόταση άδειας για προαιρετική αργία όταν η εταιρεία λειτουργεί.'
            },
            default_leave_category: {
                type: 'string',
                default: 'ΑΔΑΛ',
                description: 'Προεπιλεγμένη κατηγορία άδειας όταν δεν υπάρχει σαφής τιμή.'
            }
        },
        proposed_update_fields: [
            'adeia_apologistika',
            'argia',
            'kathgoria_adeias_apologistika',
            'ores_apoysias_apologistika'
        ],
        result_statuses: [
            POLICY_RESULT_STATUS.RESOLVED_BY_POLICY,
            POLICY_RESULT_STATUS.PREFILLED_PENDING_APPROVAL,
            POLICY_RESULT_STATUS.NEEDS_REVIEW,
            POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS
        ],
        related_scenario_codes: [
            'DECLARED_WORK_NO_CARDS_LEAVE',
            'DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED',
            'DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED',
            'DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS'
        ],
        notes: [
            'Δεν εφαρμόζει αλλαγές και δεν γράφει απολογιστικά πεδία.',
            'Το AUTO_APPLY δεν είναι διαθέσιμο στο αρχικό foundation catalog.'
        ]
    },
    {
        policy_code: 'WEEKLY_REPO_BALANCE',
        policy_version: 'foundation:v1',
        title: 'Ισορροπία εβδομαδιαίων ρεπό',
        description:
            'Ελέγχει ή εξηγεί 1 ή 2 ρεπό ανά εβδομάδα και πιθανή αντικατάσταση ρεπό μέσα στην ίδια εβδομάδα.',
        category: POLICY_CATEGORIES.WEEKLY_REPO,
        default_mode: POLICY_MODE.REVIEW_ONLY,
        supported_modes: [POLICY_MODE.REVIEW_ONLY, POLICY_MODE.SUGGESTION],
        default_priority: 80,
        safety_level: POLICY_SAFETY_LEVEL.HIGH_RISK,
        batch_approvable: false,
        requires_human_approval: true,
        required_facts: [
            'identity.kodikos',
            'identity.hmeromhnia',
            'declared.isDeclaredRepo',
            'apologistika.existingFlags.repo_apologistika',
            'weeklyContext.possibleRepoTransfer',
            'weeklyContext.repoCount'
        ],
        allowed_parameters_schema: {
            expected_weekly_repo_count: {
                type: 'integer',
                minimum: 1,
                maximum: 2,
                default: 1,
                description: 'Αναμενόμενος αριθμός ρεπό στην εβδομάδα.'
            },
            allow_same_week_repo_transfer: {
                type: 'boolean',
                default: true,
                description: 'Επιτρέπει πρόταση αντικατάστασης ρεπό μέσα στην ίδια εβδομάδα.'
            }
        },
        proposed_update_fields: [
            'repo_apologistika',
            'kathgoria_ergasias_apologistika',
            'adeia_apologistika',
            'kathgoria_adeias_apologistika',
            'ores_apoysias_apologistika'
        ],
        result_statuses: [
            POLICY_RESULT_STATUS.OK,
            POLICY_RESULT_STATUS.RESOLVED_BY_POLICY,
            POLICY_RESULT_STATUS.NEEDS_REVIEW,
            POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS
        ],
        related_scenario_codes: ['REPO_TRANSFER_WITHIN_WEEK'],
        notes: [
            'Συνδέεται με existing weekly repo deviations logic.',
            'Παραμένει review-first μέχρι να οριστούν σαφείς κανόνες έγκρισης.'
        ]
    },
    {
        policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
        policy_version: 'foundation:v1',
        title: 'Δηλωμένο ρεπό ή μη εργασία με κάρτες',
        description:
            'Χειρίζεται περιπτώσεις όπου η ημέρα είναι δηλωμένη ως ΡΕΠΟ ή ΜΗ ΕΡΓΑΣΙΑ αλλά υπάρχουν κάρτες.',
        category: POLICY_CATEGORIES.CARDS_ON_NON_WORK,
        default_mode: POLICY_MODE.SUGGESTION,
        supported_modes: [
            POLICY_MODE.REVIEW_ONLY,
            POLICY_MODE.SUGGESTION,
            POLICY_MODE.PREFILL
        ],
        default_priority: 90,
        safety_level: POLICY_SAFETY_LEVEL.HIGH_RISK,
        batch_approvable: false,
        requires_human_approval: true,
        required_facts: [
            'declared.isDeclaredRepo',
            'declared.isDeclaredNonWork',
            'cards.hasCards',
            'cards.cardIntervalsNormalized',
            'cards.cardHours'
        ],
        allowed_parameters_schema: {
            copy_card_intervals_to_apologistika: {
                type: 'boolean',
                default: true,
                description: 'Επιτρέπει πρόταση μεταφοράς διαστημάτων καρτών σε απολογιστικά πεδία.'
            },
            default_work_category: {
                type: 'string',
                default: 'ΕΡΓ',
                description: 'Προεπιλεγμένη κατηγορία εργασίας όταν οι κάρτες δείχνουν εργασία.'
            }
        },
        proposed_update_fields: [
            'kathgoria_ergasias_apologistika',
            'apo_ora_01_apologistika',
            'eos_ora_01_apologistika',
            'apo_ora_02_apologistika',
            'eos_ora_02_apologistika',
            'apo_ora_03_apologistika',
            'eos_ora_03_apologistika',
            'ores_ergasias_apologistika'
        ],
        result_statuses: [
            POLICY_RESULT_STATUS.PREFILLED_PENDING_APPROVAL,
            POLICY_RESULT_STATUS.NEEDS_REVIEW,
            POLICY_RESULT_STATUS.CONFLICT_AMBIGUOUS
        ],
        related_scenario_codes: [
            'DECLARED_REPO_WITH_CARDS',
            'DECLARED_NON_WORK_WITH_CARDS'
        ],
        notes: [
            'Δεν αλλάζει τον υπολογισμό απασχολήσεων.',
            'Οι προτάσεις πεδίων προορίζονται για μελλοντική ροή έγκρισης.'
        ]
    }
]);

function getPolicyResultStatuses() {
    return POLICY_RESULT_STATUS_DEFINITIONS;
}

function getPolicyModes() {
    return POLICY_MODE_DEFINITIONS;
}

function getApasxoliseisPolicyCatalog() {
    return APASXOLISEIS_POLICY_CATALOG;
}

function getApasxoliseisPolicyByCode(policyCode) {
    return APASXOLISEIS_POLICY_CATALOG.find((policy) => policy.policy_code === policyCode) || null;
}

function getApasxoliseisPoliciesByCategory(category) {
    return APASXOLISEIS_POLICY_CATALOG.filter((policy) => policy.category === category);
}

function validateApasxoliseisPolicyCatalog() {
    const errors = [];
    const policyCodes = new Set();
    const validModes = new Set(Object.values(POLICY_MODE));
    const validStatuses = new Set(Object.values(POLICY_RESULT_STATUS));

    APASXOLISEIS_POLICY_CATALOG.forEach((policy, index) => {
        const reference = policy?.policy_code || `index:${index}`;

        if (!policy || typeof policy !== 'object') {
            errors.push(`${reference}: policy definition must be an object`);
            return;
        }

        if (!policy.policy_code) {
            errors.push(`${reference}: missing policy_code`);
        } else if (policyCodes.has(policy.policy_code)) {
            errors.push(`${reference}: duplicate policy_code`);
        } else {
            policyCodes.add(policy.policy_code);
        }

        if (!policy.policy_version) {
            errors.push(`${reference}: missing policy_version`);
        }

        if (!validModes.has(policy.default_mode)) {
            errors.push(`${reference}: invalid default_mode`);
        }

        if (!Array.isArray(policy.supported_modes)) {
            errors.push(`${reference}: supported_modes must be an array`);
        } else {
            policy.supported_modes.forEach((mode) => {
                if (!validModes.has(mode)) {
                    errors.push(`${reference}: invalid supported_mode ${mode}`);
                }
            });

            if (!policy.supported_modes.includes(policy.default_mode)) {
                errors.push(`${reference}: default_mode must be included in supported_modes`);
            }
        }

        if (!Array.isArray(policy.result_statuses)) {
            errors.push(`${reference}: result_statuses must be an array`);
        } else {
            policy.result_statuses.forEach((status) => {
                if (!validStatuses.has(status)) {
                    errors.push(`${reference}: invalid result_status ${status}`);
                }
            });
        }

        if (!Array.isArray(policy.proposed_update_fields)) {
            errors.push(`${reference}: proposed_update_fields must be an array`);
        }

        if (!Array.isArray(policy.required_facts)) {
            errors.push(`${reference}: required_facts must be an array`);
        }

        if (
            !policy.allowed_parameters_schema ||
            typeof policy.allowed_parameters_schema !== 'object' ||
            Array.isArray(policy.allowed_parameters_schema)
        ) {
            errors.push(`${reference}: allowed_parameters_schema must be an object`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    POLICY_RESULT_STATUS,
    POLICY_MODE,
    POLICY_SAFETY_LEVEL,
    POLICY_CATEGORIES,
    getPolicyResultStatuses,
    getPolicyModes,
    getApasxoliseisPolicyCatalog,
    getApasxoliseisPolicyByCode,
    getApasxoliseisPoliciesByCategory,
    validateApasxoliseisPolicyCatalog
};
