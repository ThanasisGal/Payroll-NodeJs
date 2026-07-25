const USER_PRIVILEGE_FORM_CATALOG_SEED = Object.freeze([
    { form: 'Companies', formLabel: 'Γενικά Στοιχεία', sidebarOrder: 0, active: true, showInPrivileges: true },
    { form: 'Ypokatasthmata', formLabel: 'Υποκαταστήματα', sidebarOrder: 1, active: true, showInPrivileges: true },
    { form: 'NomimoiEkprosopoi', formLabel: 'Νόμιμοι Εκπρόσωποι', sidebarOrder: 2, active: true, showInPrivileges: true },
    { form: 'Passwords', formLabel: 'Κωδικοί Πρόσβασης', sidebarOrder: 3, active: true, showInPrivileges: true },
    { form: 'Antistoixiseis', formLabel: 'Αντιστοιχίσεις Κ.Π.Κ.', sidebarOrder: 4, active: true, showInPrivileges: true },
    { form: 'Trapezes', formLabel: 'Τράπεζες Ανά Εταιρεία', sidebarOrder: 5, active: true, showInPrivileges: true },
    { form: 'Ergazomenoi', formLabel: 'Στοιχεία Εργαζομένων', sidebarOrder: 6, active: true, showInPrivileges: true },
    { form: 'AntigrafhProgrammatonErgasias', formLabel: 'Αντιγραφή Προγράμματος Από Έως Ημερ/νία', sidebarOrder: 7, active: true, showInPrivileges: true },
    { form: 'LhpshOrarionApoErganh', formLabel: 'Λήψη Προδηλωμένων Ωραρίων από ΕΡΓΑΝΗ', sidebarOrder: 8, active: true, showInPrivileges: true },
    { form: 'LhpshOrarionApoKartes', formLabel: 'Λήψη Ωρών Απασχόλησης από Κάρτες Εργασίας', sidebarOrder: 9, active: true, showInPrivileges: true },
    { form: 'CalcApasxolhseisPeriodoy', formLabel: 'Υπολογισμός Απασχολήσεων Βάσει των Ψηφιακών Καρτών', sidebarOrder: 10, active: true, showInPrivileges: true },
    { form: 'ElegxosApasxolhseonPeriodoy', formLabel: 'Έλεγχος Απασχολήσεων', sidebarOrder: 11, active: true, showInPrivileges: true },
    { form: 'ApologistikosPinakasOrarion', formLabel: 'Απολογιστικός Πίνακας Ωραρίων', sidebarOrder: 12, active: true, showInPrivileges: true },
    { form: 'ApologistikosPinakasYperorion', formLabel: 'Απολογιστικός Πίνακας Υπερωριών', sidebarOrder: 13, active: true, showInPrivileges: true },
    { form: 'Krathseis', formLabel: 'Κρατήσεις', sidebarOrder: 14, active: true, showInPrivileges: true },
    { form: 'Symbaseis', formLabel: 'Συμβάσεις', sidebarOrder: 15, active: true, showInPrivileges: true },
    { form: 'KathgoriesSymbaseon', formLabel: 'Κατηγορίες Συμβάσεων', sidebarOrder: 16, active: true, showInPrivileges: true },
    { form: 'EidikothtesSymbaseon', formLabel: 'Ειδικότητες Συμβάσεων', sidebarOrder: 17, active: true, showInPrivileges: true },
    { form: 'StoixeiaSymbaseon', formLabel: 'Στοιχεία Συμβάσεων', sidebarOrder: 18, active: true, showInPrivileges: true },
    { form: 'KlimakiaSymbaseon', formLabel: 'Κλιμάκια Συμβάσεων', sidebarOrder: 19, active: true, showInPrivileges: true },
    { form: 'YpologismoiKlimakionSymbaseon', formLabel: 'Υπολογισμός Κλιμακίων Συμβάσεων', sidebarOrder: 20, active: true, showInPrivileges: true },
    { form: 'Apasxolhseis', formLabel: 'Απασχολήσεις', sidebarOrder: 21, active: true, showInPrivileges: true },
    { form: 'EktyposhAtomikonEkkathariseon', formLabel: 'Αποδείξεις Μισθοδοσίας', sidebarOrder: 22, active: true, showInPrivileges: true },
    { form: 'EktyposhSymbaseonErgazomenon', formLabel: 'Εργαζόμενων', sidebarOrder: 23, active: true, showInPrivileges: true },
    { form: 'SynthrhshProgrammatosErgasias', formLabel: 'Συντήρηση ωραρίων εργασίας', sidebarOrder: 1000, active: true, showInPrivileges: false },
    { form: 'ExagoghOrarionSeErganh', formLabel: 'Εξαγωγή Ωραρίων στο ΕΡΓΑΝΗ', sidebarOrder: 1001, active: true, showInPrivileges: false }
]);

function validateCatalogSeed(entries = USER_PRIVILEGE_FORM_CATALOG_SEED) {
    const forms = new Set();
    const visibleOrders = new Set();
    for (const entry of entries) {
        if (!entry || typeof entry.form !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(entry.form)) {
            throw new Error('Invalid catalog canonical form');
        }
        if (typeof entry.formLabel !== 'string' || !entry.formLabel.trim()) {
            throw new Error(`Missing catalog label for ${entry.form}`);
        }
        if (!Number.isInteger(entry.sidebarOrder) || entry.sidebarOrder < 0) {
            throw new Error(`Invalid sidebarOrder for ${entry.form}`);
        }
        if (forms.has(entry.form)) throw new Error(`Duplicate catalog form: ${entry.form}`);
        forms.add(entry.form);
        if (entry.showInPrivileges !== false) {
            if (visibleOrders.has(entry.sidebarOrder)) {
                throw new Error(`Duplicate visible sidebarOrder: ${entry.sidebarOrder}`);
            }
            visibleOrders.add(entry.sidebarOrder);
        }
    }
    return entries;
}

module.exports = {
    USER_PRIVILEGE_FORM_CATALOG_SEED,
    validateCatalogSeed
};
