const USER_PRIVILEGE_FORM_CATALOG_SEED = Object.freeze([
    { form: 'Companies', formLabel: 'Γενικά Στοιχεία', sidebarOrder: 1000, active: true, showInPrivileges: true },
    { form: 'Ypokatasthmata', formLabel: 'Υποκαταστήματα', sidebarOrder: 2000, active: true, showInPrivileges: true },
    { form: 'NomimoiEkprosopoi', formLabel: 'Νόμιμοι Εκπρόσωποι', sidebarOrder: 3000, active: true, showInPrivileges: true },
    { form: 'Passwords', formLabel: 'Κωδικοί Πρόσβασης', sidebarOrder: 4000, active: true, showInPrivileges: true },
    { form: 'Antistoixiseis', formLabel: 'Αντιστοιχίσεις Κ.Π.Κ.', sidebarOrder: 5000, active: true, showInPrivileges: true },
    { form: 'Trapezes', formLabel: 'Τράπεζες Ανά Εταιρεία', sidebarOrder: 6000, active: true, showInPrivileges: true },
    { form: 'Ergazomenoi', formLabel: 'Στοιχεία Εργαζομένων', sidebarOrder: 7000, active: true, showInPrivileges: true },
    { form: 'AntigrafhProgrammatonErgasias', formLabel: 'Αντιγραφή Προγράμματος Από Έως Ημερ/νία', sidebarOrder: 8000, active: true, showInPrivileges: true },
    { form: 'LhpshOrarionApoErganh', formLabel: 'Λήψη Προδηλωμένων Ωραρίων από ΕΡΓΑΝΗ', sidebarOrder: 9000, active: true, showInPrivileges: true },
    { form: 'LhpshProdhlomenonOrarionMonoDaneizomenon', formLabel: 'Λήψη Προδηλωμένων Ωραρίων — ΜΟΝΟ Δανειζόμενων Εργαζόμενων', sidebarOrder: 9500, active: true, showInPrivileges: true },
    { form: 'LhpshOrarionApoKartes', formLabel: 'Λήψη Ωρών Απασχόλησης από Κάρτες Εργασίας', sidebarOrder: 10000, active: true, showInPrivileges: true },
    { form: 'LhpshPshfiakonKartonMonoDaneizomenon', formLabel: 'Λήψη Ψηφιακών Καρτών — ΜΟΝΟ Δανειζόμενων Εργαζόμενων', sidebarOrder: 10500, active: true, showInPrivileges: true },
    { form: 'CalcApasxolhseisPeriodoy', formLabel: 'Υπολογισμός Απασχολήσεων Βάσει των Ψηφιακών Καρτών', sidebarOrder: 11000, active: true, showInPrivileges: true },
    { form: 'ElegxosApasxolhseonPeriodoy', formLabel: 'Έλεγχος Απασχολήσεων', sidebarOrder: 13000, active: true, showInPrivileges: true },
    { form: 'ApologistikosPinakasOrarion', formLabel: 'Απολογιστικός Πίνακας Ωραρίων', sidebarOrder: 14000, active: true, showInPrivileges: true },
    { form: 'ApologistikosPinakasYperorion', formLabel: 'Απολογιστικός Πίνακας Υπερωριών', sidebarOrder: 15000, active: true, showInPrivileges: true },
    { form: 'YpobolhAdeion', formLabel: 'Υποβολή Αδειών', sidebarOrder: 15500, active: true, showInPrivileges: true },
    { form: 'Krathseis', formLabel: 'Κρατήσεις', sidebarOrder: 16000, active: true, showInPrivileges: true },
    { form: 'Symbaseis', formLabel: 'Συμβάσεις', sidebarOrder: 17000, active: true, showInPrivileges: true },
    { form: 'KathgoriesSymbaseon', formLabel: 'Κατηγορίες Συμβάσεων', sidebarOrder: 18000, active: true, showInPrivileges: true },
    { form: 'EidikothtesSymbaseon', formLabel: 'Ειδικότητες Συμβάσεων', sidebarOrder: 19000, active: true, showInPrivileges: true },
    { form: 'StoixeiaSymbaseon', formLabel: 'Στοιχεία Συμβάσεων', sidebarOrder: 20000, active: true, showInPrivileges: true },
    { form: 'KlimakiaSymbaseon', formLabel: 'Κλιμάκια Συμβάσεων', sidebarOrder: 21000, active: true, showInPrivileges: true },
    { form: 'YpologismoiKlimakionSymbaseon', formLabel: 'Υπολογισμός Κλιμακίων Συμβάσεων', sidebarOrder: 22000, active: true, showInPrivileges: true },
    { form: 'Apasxolhseis', formLabel: 'Απασχολήσεις', sidebarOrder: 23000, active: true, showInPrivileges: true },
    { form: 'EktyposhAtomikonEkkathariseon', formLabel: 'Αποδείξεις Μισθοδοσίας', sidebarOrder: 24000, active: true, showInPrivileges: true },
    { form: 'EktyposhSymbaseonErgazomenon', formLabel: 'Εργαζόμενων', sidebarOrder: 25000, active: true, showInPrivileges: true },
    { form: 'SynthrhshProgrammatosErgasias', formLabel: 'Συντήρηση ωραρίων εργασίας', sidebarOrder: 100000, active: true, showInPrivileges: false },
    { form: 'ExagoghOrarionSeErganh', formLabel: 'Εξαγωγή Ωραρίων στο ΕΡΓΑΝΗ', sidebarOrder: 101000, active: true, showInPrivileges: false }
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
