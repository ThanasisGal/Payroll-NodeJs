'use strict';

const FORM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const PATH_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;
const SIDEBAR_NODE_ID_PATTERN = /^li[0-9]+$/;

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
    const sidebarNodeIds = new Set();
    const pathDefinitions = new Map();
    const siblingOrders = new Map();

    entries.forEach((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw hierarchyError('INVALID_PRIVILEGE_HIERARCHY_ENTRY');
        }
        if (!FORM_KEY_PATTERN.test(entry.form || '') ||
            !SIDEBAR_NODE_ID_PATTERN.test(entry.sidebarNodeId || '') ||
            typeof entry.itemLabel !== 'string' || !entry.itemLabel.trim() ||
            !Number.isInteger(entry.itemOrder) || entry.itemOrder < 0 ||
            !Array.isArray(entry.ancestors) || entry.ancestors.length === 0) {
            throw hierarchyError('INVALID_PRIVILEGE_HIERARCHY_ENTRY');
        }
        if (forms.has(entry.form)) throw hierarchyError('DUPLICATE_PRIVILEGE_HIERARCHY_FORM');
        if (sidebarNodeIds.has(entry.sidebarNodeId)) {
            throw hierarchyError('DUPLICATE_PRIVILEGE_HIERARCHY_NODE_ID');
        }
        forms.add(entry.form);
        sidebarNodeIds.add(entry.sidebarNodeId);

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

function entry(form, sidebarNodeId, itemLabel, itemOrder, ancestors) {
    return { form, sidebarNodeId, itemLabel, itemOrder, ancestors };
}

const files = { key: 'files', label: 'Αρχεία', order: 100 };
const movements = { key: 'movements', label: 'Κινήσεις', order: 200 };
const reports = { key: 'reports', label: 'Εκτυπώσεις', order: 300 };
const companies = { key: 'companies', label: 'Εταιρείες', order: 100 };
const employees = { key: 'employees', label: 'Εργαζόμενοι', order: 200 };
const ergani = { key: 'ergani-ii', label: 'ΕΡΓΑΝΗ ΙΙ', order: 300 };
const submissions = { key: 'file-submissions', label: 'Αποστολή Αρχείων', order: 600 };
const contracts = { key: 'contracts', label: 'Συμβάσεις', order: 500 };
const employmentReports = { key: 'employment-reports', label: 'Απασχολήσεις', order: 100 };
const contractReports = { key: 'contract-reports', label: 'Συμβάσεις', order: 200 };

const userPrivilegeSidebarHierarchy = [
    entry('Companies', 'li211', 'Γενικά Στοιχεία', 100, [files, companies]),
    entry('Ypokatasthmata', 'li212', 'Υποκαταστήματα', 200, [files, companies]),
    entry('NomimoiEkprosopoi', 'li213', 'Νόμιμοι Εκπρόσωποι', 300, [files, companies]),
    entry('Passwords', 'li214', 'Κωδικοί Πρόσβασης', 400, [files, companies]),
    entry('Antistoixiseis', 'li215', 'Αντιστοιχίσεις Κ.Π.Κ.', 500, [files, companies]),
    entry('Trapezes', 'li216', 'Τράπεζες Ανά Εταιρεία', 600, [files, companies]),
    entry('Ergazomenoi', 'li221', 'Στοιχεία Εργαζομένων', 100, [files, employees]),
    entry('AntigrafhProgrammatonErgasias', 'li232', 'Αντιγραφή Προγράμματος Από Έως Ημερ/νία', 100, [files, ergani]),
    entry('LhpshOrarionApoErganh', 'li233', 'Λήψη Προδηλωμένων Ωραρίων από ΕΡΓΑΝΗ', 200, [files, ergani]),
    entry('LhpshOrarionApoKartes', 'li234', 'Λήψη Ωρών Απασχόλησης από Κάρτες Εργασίας', 300, [files, ergani]),
    entry('CalcApasxolhseisPeriodoy', 'li235', 'Υπολογισμός Απασχολήσεων Βάσει των Ψηφιακών Καρτών', 400, [files, ergani]),
    entry('ElegxosApasxolhseonPeriodoy', 'li236', 'Έλεγχος Απασχολήσεων', 500, [files, ergani]),
    entry('ApologistikosPinakasOrarion', 'li2371', 'Απολογιστικός Πίνακας Ωραρίων', 100, [files, ergani, submissions]),
    entry('ApologistikosPinakasYperorion', 'li2372', 'Απολογιστικός Πίνακας Υπερωριών', 200, [files, ergani, submissions]),
    entry('Krathseis', 'li24', 'Κρατήσεις', 400, [files]),
    entry('Symbaseis', 'li251', 'Συμβάσεις', 100, [files, contracts]),
    entry('KathgoriesSymbaseon', 'li252', 'Κατηγορίες Συμβάσεων', 200, [files, contracts]),
    entry('EidikothtesSymbaseon', 'li253', 'Ειδικότητες Συμβάσεων', 300, [files, contracts]),
    entry('StoixeiaSymbaseon', 'li254', 'Στοιχεία Συμβάσεων', 400, [files, contracts]),
    entry('KlimakiaSymbaseon', 'li255', 'Κλιμάκια Συμβάσεων', 500, [files, contracts]),
    entry('YpologismoiKlimakionSymbaseon', 'li256', 'Υπολογισμός Κλιμακίων Συμβάσεων', 600, [files, contracts]),
    entry('Apasxolhseis', 'li32', 'Απασχολήσεις', 100, [movements]),
    entry('EktyposhAtomikonEkkathariseon', 'li411', 'Αποδείξεις Μισθοδοσίας', 100, [reports, employmentReports]),
    entry('EktyposhSymbaseonErgazomenon', 'li422', 'Εργαζόμενων', 100, [reports, contractReports])
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
