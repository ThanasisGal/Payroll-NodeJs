'use strict';

const FORM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const PATH_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

function hierarchyError(code) {
    return Object.assign(new Error('Μη έγκυρη ρύθμιση ιεραρχίας δικαιωμάτων'), {
        code,
        status: 500
    });
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

function pathIdentity(ancestors) {
    return ancestors.map((ancestor) => ancestor.key).join('/');
}

function validateUserPrivilegeSidebarHierarchy(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw hierarchyError('INVALID_PRIVILEGE_HIERARCHY');
    }

    const forms = new Set();
    const pathDefinitions = new Map();
    const siblingOrders = new Map();

    entries.forEach((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw hierarchyError('INVALID_PRIVILEGE_HIERARCHY_ENTRY');
        }
        if (!FORM_KEY_PATTERN.test(entry.form || '') ||
            typeof entry.itemLabel !== 'string' || !entry.itemLabel.trim() ||
            !Number.isInteger(entry.itemOrder) || entry.itemOrder < 0 ||
            !Array.isArray(entry.ancestors) || entry.ancestors.length === 0) {
            throw hierarchyError('INVALID_PRIVILEGE_HIERARCHY_ENTRY');
        }
        if (forms.has(entry.form)) throw hierarchyError('DUPLICATE_PRIVILEGE_HIERARCHY_FORM');
        forms.add(entry.form);

        const parentKeys = [];
        entry.ancestors.forEach((ancestor) => {
            if (!ancestor || typeof ancestor !== 'object' || Array.isArray(ancestor) ||
                !PATH_KEY_PATTERN.test(ancestor.key || '') ||
                typeof ancestor.label !== 'string' || !ancestor.label.trim() ||
                !Number.isInteger(ancestor.order) || ancestor.order < 0) {
                throw hierarchyError('INVALID_PRIVILEGE_HIERARCHY_ANCESTOR');
            }

            const parentPath = parentKeys.join('/');
            const currentPath = [...parentKeys, ancestor.key].join('/');
            const definition = `${ancestor.label.trim()}\u0000${ancestor.order}\u0000${parentPath}`;
            if (pathDefinitions.has(currentPath) && pathDefinitions.get(currentPath) !== definition) {
                throw hierarchyError('CONFLICTING_PRIVILEGE_HIERARCHY_PATH');
            }
            pathDefinitions.set(currentPath, definition);

            const orderKey = `${parentPath}\u0000${ancestor.order}`;
            const nodeIdentity = `path:${currentPath}`;
            if (siblingOrders.has(orderKey) && siblingOrders.get(orderKey) !== nodeIdentity) {
                throw hierarchyError('DUPLICATE_PRIVILEGE_HIERARCHY_ORDER');
            }
            siblingOrders.set(orderKey, nodeIdentity);
            parentKeys.push(ancestor.key);
        });

        const leafParent = parentKeys.join('/');
        const leafOrderKey = `${leafParent}\u0000${entry.itemOrder}`;
        const leafIdentity = `form:${entry.form}`;
        if (siblingOrders.has(leafOrderKey) && siblingOrders.get(leafOrderKey) !== leafIdentity) {
            throw hierarchyError('DUPLICATE_PRIVILEGE_HIERARCHY_ORDER');
        }
        siblingOrders.set(leafOrderKey, leafIdentity);
    });

    return true;
}

function compareHierarchyEntries(left, right) {
    const leftOrders = left.ancestors.map((item) => item.order).concat(left.itemOrder);
    const rightOrders = right.ancestors.map((item) => item.order).concat(right.itemOrder);
    const length = Math.max(leftOrders.length, rightOrders.length);
    for (let index = 0; index < length; index += 1) {
        if (leftOrders[index] === undefined) return -1;
        if (rightOrders[index] === undefined) return 1;
        if (leftOrders[index] !== rightOrders[index]) return leftOrders[index] - rightOrders[index];
    }
    return left.form.localeCompare(right.form);
}

function entry(form, itemLabel, itemOrder, ancestors) {
    return { form, itemLabel, itemOrder, ancestors };
}

const files = { key: 'files', label: 'Αρχεία', order: 0 };
const movements = { key: 'movements', label: 'Κινήσεις', order: 1 };
const reports = { key: 'reports', label: 'Εκτυπώσεις', order: 2 };
const companies = { key: 'companies', label: 'Εταιρείες', order: 0 };
const employees = { key: 'employees', label: 'Εργαζόμενοι', order: 1 };
const ergani = { key: 'ergani-ii', label: 'ΕΡΓΑΝΗ ΙΙ', order: 2 };
const submissions = { key: 'file-submissions', label: 'Αποστολή Αρχείων', order: 5 };
const contracts = { key: 'contracts', label: 'Συμβάσεις', order: 4 };
const employmentReports = { key: 'employment-reports', label: 'Απασχολήσεις', order: 0 };
const contractReports = { key: 'contract-reports', label: 'Συμβάσεις', order: 1 };

const userPrivilegeSidebarHierarchy = [
    entry('Companies', 'Γενικά Στοιχεία', 0, [files, companies]),
    entry('Ypokatasthmata', 'Υποκαταστήματα', 1, [files, companies]),
    entry('NomimoiEkprosopoi', 'Νόμιμοι Εκπρόσωποι', 2, [files, companies]),
    entry('Passwords', 'Κωδικοί Πρόσβασης', 3, [files, companies]),
    entry('Antistoixiseis', 'Αντιστοιχίσεις Κ.Π.Κ.', 4, [files, companies]),
    entry('Trapezes', 'Τράπεζες Ανά Εταιρεία', 5, [files, companies]),
    entry('Ergazomenoi', 'Στοιχεία Εργαζομένων', 0, [files, employees]),
    entry('AntigrafhProgrammatonErgasias', 'Αντιγραφή Προγράμματος Από Έως Ημερ/νία', 0, [files, ergani]),
    entry('LhpshOrarionApoErganh', 'Λήψη Προδηλωμένων Ωραρίων από ΕΡΓΑΝΗ', 1, [files, ergani]),
    entry('LhpshOrarionApoKartes', 'Λήψη Ωρών Απασχόλησης από Κάρτες Εργασίας', 2, [files, ergani]),
    entry('CalcApasxolhseisPeriodoy', 'Υπολογισμός Απασχολήσεων Βάσει των Ψηφιακών Καρτών', 3, [files, ergani]),
    entry('ElegxosApasxolhseonPeriodoy', 'Έλεγχος Απασχολήσεων', 4, [files, ergani]),
    entry('ApologistikosPinakasOrarion', 'Απολογιστικός Πίνακας Ωραρίων', 0, [files, ergani, submissions]),
    entry('ApologistikosPinakasYperorion', 'Απολογιστικός Πίνακας Υπερωριών', 1, [files, ergani, submissions]),
    entry('Krathseis', 'Κρατήσεις', 3, [files]),
    entry('Symbaseis', 'Συμβάσεις', 0, [files, contracts]),
    entry('KathgoriesSymbaseon', 'Κατηγορίες Συμβάσεων', 1, [files, contracts]),
    entry('EidikothtesSymbaseon', 'Ειδικότητες Συμβάσεων', 2, [files, contracts]),
    entry('StoixeiaSymbaseon', 'Στοιχεία Συμβάσεων', 3, [files, contracts]),
    entry('KlimakiaSymbaseon', 'Κλιμάκια Συμβάσεων', 4, [files, contracts]),
    entry('YpologismoiKlimakionSymbaseon', 'Υπολογισμός Κλιμακίων Συμβάσεων', 5, [files, contracts]),
    entry('Apasxolhseis', 'Απασχολήσεις', 0, [movements]),
    entry('EktyposhAtomikonEkkathariseon', 'Αποδείξεις Μισθοδοσίας', 0, [reports, employmentReports]),
    entry('EktyposhSymbaseonErgazomenon', 'Εργαζόμενων', 0, [reports, contractReports])
];

validateUserPrivilegeSidebarHierarchy(userPrivilegeSidebarHierarchy);
userPrivilegeSidebarHierarchy.sort(compareHierarchyEntries);
deepFreeze(userPrivilegeSidebarHierarchy);

const hierarchyByForm = new Map(userPrivilegeSidebarHierarchy.map((item) => [item.form, item]));

function getUserPrivilegeNavigation(form) {
    return hierarchyByForm.get(form) || null;
}

module.exports = {
    userPrivilegeSidebarHierarchy,
    validateUserPrivilegeSidebarHierarchy,
    compareHierarchyEntries,
    getUserPrivilegeNavigation,
    pathIdentity
};
