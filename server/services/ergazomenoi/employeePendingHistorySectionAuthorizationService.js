'use strict';

// Server-owned evidence only. Browser tab state or request-supplied rights
// are never considered authorization.
const FORMS = Object.freeze({
    APODOCHES: 'ErgazomenoiApodoxes',
    KRATHSEIS: 'ErgazomenoiKrathseis'
});
const DENIED = 'EMPLOYEE_PENDING_HISTORY_SECTION_FORBIDDEN';

function sectionForField(field, group = '') {
    if (typeof field !== 'string' || !field.trim()) return null;
    if (/^(?:krathsh_\d+|kpk(?:_|$)|kpk_efka|asfal|eisfora)/i.test(field) ||
        /(?:asfalishs|eisfores)/i.test(field) || group === 'Ασφάλιση' || group === 'Κρατήσεις')
        return 'KRATHSEIS';
    if (/(?:Misthos|Hmeromisthio|Oromisthio|misthologik|epidoma)/i.test(field) ||
        /^(?:poso_symbashs|synolo_symbashs|forologikh_klimaka)/i.test(field) ||
        group === 'Αποδοχές') return 'APODOCHES';
    return null;
}

function requiredSections(pending) {
    if (!pending || typeof pending !== 'object' || !Array.isArray(pending.missingFields))
        return [];
    return [...new Set(pending.missingFields.map(item => sectionForField(item?.field, item?.group))
        .filter(Boolean))].sort();
}
function denied() {
    // No sensitive field name/value is reflected in an unauthorized reply.
    const error = new Error('Η συμπλήρωση της εκκρεμότητας απαιτεί εξουσιοδοτημένο χρήστη για τις αντίστοιχες ενότητες Αποδοχών ή Κρατήσεων.');
    error.code = DENIED;
    error.statusCode = 403;
    throw error;
}
async function privilege(privilegeModel, actorUserId, form, session) {
    const q = privilegeModel.findOne({ userId: String(actorUserId), form });
    const projection = q.select ? q.select('privileges.admin privileges.update') : q;
    const withSession = session && projection.session ? projection.session(session) : projection;
    return typeof withSession.lean === 'function' ? withSession.lean() : withSession;
}
async function assertPendingHistorySectionAuthorization({ actorUserId, pending,
    privilegeModel, session }) {
    if (!actorUserId || !privilegeModel?.findOne || !pending?.id) denied();
    const sections = requiredSections(pending);
    if (!sections.length) return { required: [] };
    // The outer writer already checks actor status, current team, employee identity
    // and general edit privilege. Recheck general Admin here: only explicit Admin
    // or each matching section privilege may complete protected fields.
    const employee = await privilege(privilegeModel, actorUserId, 'Ergazomenoi', session);
    if (employee?.privileges?.admin === true)
        return { required: sections, authorizedBy: 'EMPLOYEE_ADMIN' };
    for (const section of sections) {
        const permission = await privilege(privilegeModel, actorUserId, FORMS[section], session);
        if (permission?.privileges?.admin !== true && permission?.privileges?.update !== true)
            denied();
    }
    return { required: sections, authorizedBy: 'SECTION_PERMISSIONS' };
}
module.exports = { FORMS, DENIED, sectionForField, requiredSections,
    assertPendingHistorySectionAuthorization };
