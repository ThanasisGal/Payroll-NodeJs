'use strict';

// Local proposal choices only. This module does not normalize persisted records.
const { CANONICAL_EMPLOYMENT_TYPES, normalizeEmploymentTypeValue, resolveEmploymentTypeSemantics } =
    require('../../utils/ergazomenoi/employmentTypeSemantics');
const { registryEntryForCanonicalField } = require('./employeeHistoryCorrectionFieldRegistryService');
const EMPLOYMENT_FIELDS = ['typos_apasxolhshs', 'kathestos_apasxolhshs'];
const CATEGORY_FIELD = 'eidikh_kathgoria_ergazomenoy';
const employmentOptions = () => CANONICAL_EMPLOYMENT_TYPES.map((id, index) => ({ id,
    label: `${id} - ${['Πλήρης απασχόληση', 'Μερική απασχόληση', 'Εκ περιτροπής εργασία'][index]}` }));
const storesCode = field => EMPLOYMENT_FIELDS.includes(field);
const catalogFor = field => field === CATEGORY_FIELD ? 'SPECIAL_EMPLOYEE_CATEGORY' :
    /^stoixeio_symbashs_\d{2}$/.test(field) ? 'CONTRACT_ITEM' : registryEntryForCanonicalField(field)?.catalog;

function proposalChoice(field, proposed, source, catalogs) {
    if (EMPLOYMENT_FIELDS.includes(field)) {
        const semantics = resolveEmploymentTypeSemantics(source || {});
        const normalized = normalizeEmploymentTypeValue(proposed);
        const resolved = semantics.status === 'RESOLVED';
        const value = resolved ? semantics.effectiveValue : null;
        const selectionRequired = !resolved || !normalized || normalized !== value;
        return { value, selectionRequired, reason: selectionRequired ?
            resolved ? `Πρόταση από το ανεξάρτητα καταγεγραμμένο ${semantics.source === 'CANONICAL' ? 'καθεστώς' : 'τύπο'} απασχόλησης της ίδιας πηγής. Απαιτείται επιλογή και επιβεβαίωση του χρήστη. Η εβδομάδα εργασίας δεν χρησιμοποιήθηκε.` :
                'Η καταγεγραμμένη τιμή απασχόλησης λείπει, δεν είναι έγκυρη ή συγκρούεται με το καθεστώς. Επιλέξτε 0, 1 ή 2 με τεκμήριο. Δεν εφαρμόστηκε αυτόματη αντικατάσταση.' : '' };
    }
    if (field === CATEGORY_FIELD) {
        if (proposed === null || proposed === undefined || proposed === '') return { value: null, selectionRequired: false, reason: '' };
        const valid = typeof proposed === 'string' && (catalogs.SPECIAL_EMPLOYEE_CATEGORY || []).some(item => item.code === proposed);
        return { value: valid ? proposed : null, selectionRequired: !valid, reason: valid ? '' :
            'Η καταγεγραμμένη ειδική κατηγορία δεν υπάρχει στον διαθέσιμο κατάλογο. Επιλέξτε έγκυρη κατηγορία. Δεν έγινε αυτόματη αντικατάσταση.' };
    }
    return null;
}
module.exports = { EMPLOYMENT_FIELDS, CATEGORY_FIELD, employmentOptions, storesCode, catalogFor, proposalChoice };
