const mongoose = require('mongoose');
const { UserPrivilegesModel } = require('../models/privileges');
const UserPrivilegeFormCatalogModel = require('../models/userPrivilegeFormCatalog');
const {
    userPrivilegeSidebarHierarchy,
    validateUserPrivilegeSidebarHierarchy,
    compareHierarchyEntries
} = require('../constants/userPrivilegeSidebarHierarchy');

const BLOCKED_KEYS = new Set([
    '__proto__', 'prototype', 'constructor', '_id', '__v', 'userId', 'form',
    'createdAt', 'updatedAt'
]);

function isSafePrivilegeKey(key) {
    return typeof key === 'string' &&
        key.length > 0 &&
        !BLOCKED_KEYS.has(key) &&
        !key.startsWith('$') &&
        !key.includes('.');
}

function getSchemaPrivilegeKeys(model = UserPrivilegesModel) {
    return Object.keys(model.schema.paths)
        .filter((path) => path.startsWith('privileges.'))
        .map((path) => path.slice('privileges.'.length))
        .filter(isSafePrivilegeKey);
}

function ownKeys(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? Object.keys(value)
        : [];
}

function assertSafeObjectKeys(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw contractError('MALFORMED_PAYLOAD', `${label} πρέπει να είναι object`);
    }
    for (const key of Object.keys(value)) {
        if (!isSafePrivilegeKey(key)) {
            throw contractError('UNSAFE_KEY', `Μη επιτρεπτό πεδίο στο ${label}`);
        }
    }
}

function contractError(code, message, status = 400) {
    return Object.assign(new Error(message), { code, status });
}

function validateCatalogEntries(catalogEntries) {
    if (!Array.isArray(catalogEntries)) {
        throw contractError('CATALOG_UNAVAILABLE', 'Ο κατάλογος φορμών δεν είναι διαθέσιμος', 503);
    }
    const forms = new Set();
    const orders = new Set();
    return catalogEntries.map((entry) => {
        const form = typeof entry?.form === 'string' ? entry.form.trim() : '';
        const formLabel = typeof entry?.formLabel === 'string' ? entry.formLabel.trim() : '';
        const sidebarOrder = entry?.sidebarOrder;
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(form) || !formLabel || !Number.isInteger(sidebarOrder) || sidebarOrder < 0) {
            throw contractError('INVALID_CATALOG_ENTRY', 'Μη έγκυρη ρύθμιση καταλόγου φορμών', 500);
        }
        if (forms.has(form) || orders.has(sidebarOrder)) {
            throw contractError('DUPLICATE_CATALOG_ENTRY', 'Διπλή ρύθμιση καταλόγου φορμών', 500);
        }
        forms.add(form);
        orders.add(sidebarOrder);
        return { ...entry, form, formLabel, sidebarOrder };
    });
}

function serializePrivilegeDocuments(
    catalogEntries,
    documents,
    schemaKeys = getSchemaPrivilegeKeys(),
    hierarchyEntries = userPrivilegeSidebarHierarchy
) {
    const columns = [...schemaKeys];
    const catalog = validateCatalogEntries(catalogEntries);
    validateUserPrivilegeSidebarHierarchy(hierarchyEntries);
    const hierarchyByForm = new Map(hierarchyEntries.map((item) => [item.form, item]));
    if (hierarchyByForm.size !== catalog.length ||
        catalog.some((entry) => !hierarchyByForm.has(entry.form)) ||
        hierarchyEntries.some((item) => !catalog.some((entry) => entry.form === item.form))) {
        throw contractError(
            'PRIVILEGE_HIERARCHY_MISMATCH',
            'Η ρύθμιση πλοήγησης δικαιωμάτων δεν συμφωνεί με τον κατάλογο',
            500
        );
    }
    const documentsByForm = new Map(
        (Array.isArray(documents) ? documents : []).map((doc) => [String(doc.form), doc])
    );
    const rows = catalog
        .map((entry) => {
            const doc = documentsByForm.get(entry.form);
            const navigation = hierarchyByForm.get(entry.form);
            const raw = doc?.privileges?.toObject
                ? doc.privileges.toObject()
                : (doc?.privileges || {});
            const privileges = Object.create(null);
            columns.forEach((key) => { privileges[key] = raw[key] === true; });
            return {
                id: doc?._id ? String(doc._id) : null,
                form: entry.form,
                formLabel: entry.formLabel,
                sidebarOrder: entry.sidebarOrder,
                exists: Boolean(doc),
                applicableKeys: [...columns],
                privileges,
                navigation: {
                    itemLabel: navigation.itemLabel,
                    itemOrder: navigation.itemOrder,
                    ancestors: navigation.ancestors.map((ancestor) => ({
                        key: ancestor.key,
                        label: ancestor.label,
                        order: ancestor.order
                    }))
                }
            };
        })
        .sort((left, right) => compareHierarchyEntries(
            hierarchyByForm.get(left.form),
            hierarchyByForm.get(right.form)
        ));
    return { columns, rows };
}

function validateFullUpdatePayload(payload, catalogEntries, canonicalDocuments, schemaKeys = getSchemaPrivilegeKeys()) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw contractError('MALFORMED_PAYLOAD', 'Μη έγκυρο payload');
    }
    const topKeys = Object.keys(payload);
    if (topKeys.some((key) => key !== 'rows') || !Array.isArray(payload.rows)) {
        throw contractError('MALFORMED_PAYLOAD', 'Το payload πρέπει να περιέχει μόνο rows');
    }

    const catalog = validateCatalogEntries(catalogEntries);
    const catalogByForm = new Map(catalog.map((entry) => [entry.form, entry]));
    const canonicalByForm = new Map(canonicalDocuments.map((doc) => [String(doc.form), doc]));
    if (payload.rows.length !== catalogByForm.size) {
        throw contractError('ROW_SET_MISMATCH', 'Απαιτείται πλήρης ενημέρωση όλων των γραμμών');
    }

    const seen = new Set();
    return payload.rows.map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
            throw contractError('MALFORMED_ROW', 'Μη έγκυρη γραμμή');
        }
        const rowKeys = Object.keys(row);
        if (rowKeys.some((key) => !['id', 'form', 'privileges'].includes(key))) {
            throw contractError('UNKNOWN_ROW_FIELD', 'Άγνωστο πεδίο γραμμής');
        }
        if (typeof row.form !== 'string' || !catalogByForm.has(row.form)) {
            throw contractError('UNKNOWN_FORM', 'Άγνωστη ή ανενεργή φόρμα');
        }
        if (seen.has(row.form)) throw contractError('DUPLICATE_ROW', 'Διπλή φόρμα');
        seen.add(row.form);

        const catalogEntry = catalogByForm.get(row.form);
        const canonical = canonicalByForm.get(row.form) || null;
        if (canonical) {
            if (typeof row.id !== 'string' || !mongoose.isValidObjectId(row.id) || row.id !== String(canonical._id)) {
                throw contractError('ROW_ID_MISMATCH', 'Το αναγνωριστικό γραμμής δεν συμφωνεί');
            }
        } else if (row.id !== null) {
            throw contractError('UNEXPECTED_ROW_ID', 'Νέα φόρμα δεν πρέπει να έχει αναγνωριστικό');
        }
        assertSafeObjectKeys(row.privileges, 'privileges');

        const allowed = [...schemaKeys];
        const submitted = Object.keys(row.privileges).sort();
        const sortedAllowed = [...allowed].sort();
        if (submitted.length !== sortedAllowed.length || submitted.some((key, i) => key !== sortedAllowed[i])) {
            throw contractError('PRIVILEGE_KEYS_MISMATCH', 'Άγνωστα ή ελλιπή privilege keys');
        }

        const values = Object.create(null);
        for (const key of allowed) {
            if (typeof row.privileges[key] !== 'boolean') {
                throw contractError('INVALID_BOOLEAN', 'Τα δικαιώματα πρέπει να είναι JSON booleans');
            }
            values[key] = row.privileges[key];
        }
        return { catalogEntry, canonical, values, allowed };
    });
}

async function updateAllPrivilegesAtomically({
    userId,
    payload,
    model = UserPrivilegesModel,
    catalogModel = UserPrivilegeFormCatalogModel,
    connection = mongoose.connection,
    authorizeTarget
}) {
    const session = await connection.startSession();
    try {
        await session.withTransaction(async () => {
            if (typeof authorizeTarget === 'function') {
                await authorizeTarget(session);
            }
            const catalog = await catalogModel.find({
                active: true,
                showInPrivileges: true,
                form: mongoose.trusted({
                    $in: userPrivilegeSidebarHierarchy.map((entry) => entry.form)
                })
            })
                .select('_id form formLabel sidebarOrder')
                .sort({ sidebarOrder: 1, form: 1 })
                .session(session)
                .lean();
            const canonical = await model.find({ userId })
                .select('_id userId form privileges __v')
                .session(session)
                .lean();
            const plan = validateFullUpdatePayload(
                payload,
                catalog,
                canonical,
                getSchemaPrivilegeKeys(model)
            );

            for (const item of plan) {
                const update = Object.create(null);
                item.allowed.forEach((key) => { update[`privileges.${key}`] = item.values[key]; });
                if (item.canonical) {
                    const result = await model.updateOne(
                        { _id: item.canonical._id, userId, form: item.catalogEntry.form, __v: item.canonical.__v },
                        { $set: update, $inc: { __v: 1 } },
                        { session, runValidators: true }
                    );
                    if (result.matchedCount !== 1) {
                        throw contractError('CONCURRENT_UPDATE', 'Τα δικαιώματα άλλαξαν ταυτόχρονα. Επαναφορτώστε τη σελίδα.', 409);
                    }
                } else {
                    const privileges = Object.create(null);
                    item.allowed.forEach((key) => { privileges[key] = item.values[key]; });
                    try {
                        await model.create([{
                            userId,
                            form: item.catalogEntry.form,
                            privileges
                        }], { session });
                    } catch (error) {
                        if (error?.code === 11000) {
                            throw contractError(
                                'CONCURRENT_INSERT',
                                'Η φόρμα δικαιωμάτων δημιουργήθηκε ταυτόχρονα. Επαναφορτώστε τη σελίδα.',
                                409
                            );
                        }
                        throw error;
                    }
                }
            }
        });
    } catch (error) {
        if (!error.status && /transaction|replica set/i.test(String(error.message))) {
            throw contractError('TRANSACTIONS_UNAVAILABLE', 'Η ασφαλής συναλλαγή δεν είναι διαθέσιμη', 503);
        }
        throw error;
    } finally {
        await session.endSession();
    }
}

module.exports = {
    isSafePrivilegeKey,
    getSchemaPrivilegeKeys,
    validateCatalogEntries,
    serializePrivilegeDocuments,
    validateFullUpdatePayload,
    updateAllPrivilegesAtomically,
    contractError
};
