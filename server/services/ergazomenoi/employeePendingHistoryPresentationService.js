'use strict';

const { FORMS, sectionForField } = require('./employeePendingHistorySectionAuthorizationService');

async function privilege(lookup, actorUserId, form) {
    const q = lookup.findOne({ userId: String(actorUserId), form });
    const selected = typeof q?.select === 'function'
        ? q.select('privileges.admin privileges.read privileges.update') : q;
    const record = typeof selected?.lean === 'function' ? await selected.lean() : await selected;
    return record?.privileges || {};
}

async function presentPendingHistory({ pending, actorUserId, privilegeModel }) {
    if (!pending) return null;
    const closed = { canViewApodoxes: false, canViewKrathseis: false,
        missingFields: [{ group: 'Εκκρεμής μεταβολή', label: 'Απαιτείται εξουσιοδοτημένος χρήστης', reason: '' }] };
    if (!actorUserId || !privilegeModel?.findOne) return closed;
    const employee = await privilege(privilegeModel, actorUserId, 'Ergazomenoi');
    const admin = employee.admin === true;
    const grants = async form => {
        if (admin) return true;
        const p = await privilege(privilegeModel, actorUserId, form);
        return p.admin === true || p.read === true || p.update === true;
    };
    const [canViewApodoxes, canViewKrathseis] = await Promise.all([
        grants(FORMS.APODOCHES), grants(FORMS.KRATHSEIS)
    ]);
    const missingFields = [], masked = new Set();
    for (const item of Array.isArray(pending.missingFields) ? pending.missingFields : []) {
        const section = sectionForField(item?.field, item?.group);
        const forbidden = section === 'APODOCHES' && !canViewApodoxes ||
            section === 'KRATHSEIS' && !canViewKrathseis;
        if (!forbidden) {
            missingFields.push({ group: String(item?.group || ''),
                label: String(item?.label || ''), reason: String(item?.reason || '') });
        } else if (!masked.has(section)) {
            masked.add(section);
            missingFields.push({ group: 'Απαιτείται εξουσιοδοτημένος χρήστης',
                label: section === 'APODOCHES' ? 'Αποδοχές' : 'Κρατήσεις',
                reason: 'Η συμπλήρωση γίνεται από χρήστη με τα αντίστοιχα δικαιώματα.' });
        }
    }
    return { canViewApodoxes, canViewKrathseis, missingFields };
}
module.exports = { presentPendingHistory };
