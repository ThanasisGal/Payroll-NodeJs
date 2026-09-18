'use strict';

const mongoose = require('mongoose');
const {
    ErgazomenoiModel
} = require('../../models/ergazomenoi');
const {
    BASE_HISTORY_FIELDS
} = require('../../utils/ergazomenoi/employmentProfileHistory');
const {
    profileInput
} = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const {
    requireScopedEmployeeForUpdate
} = require('./employeeUpdateScope');
const {
    writeEmployeeRehire
} = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');

const REHIRE_WORK_TERM_FIELDS = Object.freeze([
    'eidikh_kathgoria_ergazomenoy',
    'kathestos_apasxolhshs',
    'typos_apasxolhshs',
    'typos_ebdomadas',
    'apasxolhsh_basei_symbashs',
    'pososto_prosayxhshs_6hs_hmeras',
    'hmeres_ergasias_ebdomadas',
    'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias',
    'symbatikes_ores_ergasias'
]);

const REHIRE_CHANGE_FIELDS = new Set([
    ...BASE_HISTORY_FIELDS,
    ...REHIRE_WORK_TERM_FIELDS
]);

function objectOrEmpty(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function pickRehireChanges(source = {}) {
    return Object.fromEntries(
        Object.entries(objectOrEmpty(source))
            .filter(([field, value]) =>
                REHIRE_CHANGE_FIELDS.has(field) && value !== undefined
            )
    );
}

function rehireMessage(error) {
    const messages = {
        EMPLOYEE_REHIRE_EMPLOYEE_REQUIRED:
            'Δεν βρέθηκαν τα στοιχεία του εργαζομένου για επαναπρόσληψη.',
        EMPLOYEE_REHIRE_ARCHIVED_EMPLOYEE:
            'Ο αρχειοθετημένος εργαζόμενος δεν μπορεί να επαναπροσληφθεί από αυτή τη λειτουργία.',
        EMPLOYEE_REHIRE_INVALID_DATE:
            'Η ημερομηνία επαναπρόσληψης δεν είναι έγκυρη.',
        EMPLOYEE_REHIRE_NO_EMPLOYMENT_CYCLE:
            'Δεν υπάρχει προηγούμενη εργασιακή σχέση για ασφαλή επαναπρόσληψη.',
        EMPLOYEE_REHIRE_CURRENT_CYCLE_MISMATCH:
            'Το τρέχον μητρώο δεν συμφωνεί με την τελευταία εργασιακή σχέση.',
        EMPLOYEE_REHIRE_CURRENT_RELATIONSHIP_OPEN:
            'Η τρέχουσα εργασιακή σχέση πρέπει πρώτα να έχει κλείσει με ημερομηνία αποχώρησης.',
        EMPLOYEE_REHIRE_DATE_NOT_AFTER_DEPARTURE:
            'Η επαναπρόσληψη πρέπει να είναι μεταγενέστερη της τελευταίας αποχώρησης.',
        EMPLOYEE_REHIRE_INVALID_CONTRACT_START:
            'Η έναρξη της νέας σύμβασης δεν μπορεί να προηγείται της επαναπρόσληψης.',
        EMPLOYEE_REHIRE_INVALID_SCHEDULE_START:
            'Η έναρξη του νέου ωραρίου δεν μπορεί να προηγείται της επαναπρόσληψης.',
        EMPLOYEE_REHIRE_INVALID_HISTORY_CONTRACT_START:
            'Η ιστορική έναρξη της νέας σύμβασης δεν είναι έγκυρη.',
        EMPLOYEE_REHIRE_INVALID_HISTORY_SCHEDULE_START:
            'Η ιστορική έναρξη του νέου ωραρίου δεν είναι έγκυρη.',
        EMPLOYEE_REHIRE_HISTORY_REQUIRED:
            'Δεν βρέθηκε η τελευταία ιστορική σχέση που πρέπει να κλείσει.',
        EMPLOYEE_REHIRE_HISTORY_INVALID:
            'Η τελευταία ιστορική σχέση έχει μη έγκυρα χρονικά όρια.',
        EMPLOYEE_REHIRE_HISTORY_END_BEFORE_DEPARTURE:
            'Το ιστορικό της τελευταίας σχέσης λήγει πριν από την καταχωρημένη αποχώρηση.',
        EMPLOYEE_REHIRE_HISTORY_STALE:
            'Το ιστορικό άλλαξε ταυτόχρονα. Ανανεώστε τα στοιχεία και δοκιμάστε ξανά.',
        EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE:
            'Η επαναπρόσληψη απαιτεί διαθέσιμη συναλλαγή MongoDB. Δεν αποθηκεύτηκε καμία αλλαγή.',
        EMPLOYEE_PROFILE_NOT_FOUND:
            'Ο εργαζόμενος δεν βρέθηκε.',
        EMPLOYEE_PROFILE_NON_APPEND_CHANGE:
            'Η νέα εργασιακή σχέση δεν μπορεί να εισαχθεί αναδρομικά πάνω σε νεότερο ιστορικό.'
    };

    if (error?.code === 'INVALID_EMPLOYMENT_PROFILE') {
        return `Μη έγκυρα στοιχεία νέας εργασιακής σχέσης (${error.field}): ${error.message}`;
    }

    return messages[error?.code] ||
        'Η επαναπρόσληψη απέτυχε. Δεν αποθηκεύτηκε καμία αλλαγή.';
}

function isExpectedRehireError(error) {
    const code = String(error?.code || '');
    return code === 'INVALID_EMPLOYMENT_PROFILE' ||
        code.startsWith('EMPLOYEE_REHIRE_') ||
        code.startsWith('EMPLOYEE_PROFILE_');
}

async function postEmployeeRehire(req, res) {
    const scoped = await requireScopedEmployeeForUpdate({
        req,
        res,
        model: ErgazomenoiModel,
        objectId: mongoose.Types.ObjectId
    });
    if (!scoped) return;

    const rawBody = objectOrEmpty(req.body);
    const payload = Object.keys(objectOrEmpty(rawBody.formData)).length
        ? objectOrEmpty(rawBody.formData)
        : rawBody;

    const employmentSource = Object.keys(objectOrEmpty(payload.employment)).length
        ? objectOrEmpty(payload.employment)
        : payload;
    const profileSource = Object.keys(objectOrEmpty(payload.profile)).length
        ? objectOrEmpty(payload.profile)
        : employmentSource;

    const rehireDate =
        payload.rehireDate ||
        employmentSource.rehireDate ||
        employmentSource.hmeromhnia_proslhpshs;

    const changes = pickRehireChanges(employmentSource);

    try {
        const result = await writeEmployeeRehire({
            scope: {
                team: req.session.userTeam,
                company_kod: req.session.companyInUse,
                kodikos: scoped.employeeCode
            },
            employeeId: String(scoped.employee._id),
            rehireDate,
            input: profileInput(profileSource, 'edit'),
            employeeChanges: changes,
            historyChanges: changes
        });

        return res.json({
            success: true,
            employeeId: String(scoped.employee._id),
            kodikos: scoped.employeeCode,
            cycle_no: result.cycle_no,
            rehire_date: result.rehire_date
        });
    } catch (error) {
        if (isExpectedRehireError(error)) {
            const message = rehireMessage(error);
            return res.status(error.statusCode || 409).json({
                success: false,
                reason: error.code || 'EMPLOYEE_REHIRE_FAILED',
                field: error.field,
                message,
                errorMessage: message
            });
        }

        console.error('Employee rehire failed', {
            category: error?.name || 'EMPLOYEE_REHIRE_FAILED'
        });
        return res.status(500).json({
            success: false,
            reason: 'EMPLOYEE_REHIRE_FAILED',
            message: 'Η επαναπρόσληψη απέτυχε. Δεν αποθηκεύτηκε καμία αλλαγή.',
            errorMessage: 'Η επαναπρόσληψη απέτυχε. Δεν αποθηκεύτηκε καμία αλλαγή.'
        });
    }
}

module.exports = {
    REHIRE_CHANGE_FIELDS,
    pickRehireChanges,
    postEmployeeRehire
};
