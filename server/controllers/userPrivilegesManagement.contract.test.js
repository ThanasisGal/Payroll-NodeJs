const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const mongoose = require('mongoose');

const root = path.resolve(__dirname, '..', '..');
const { UserPrivilegesModel } = require('../models/privileges');
const UserPrivilegeFormCatalogModel = require('../models/userPrivilegeFormCatalog');
const {
    USER_ROLE_CODES,
    getUserRoleLabel,
    isUserPrivilegesManagerRole
} = require('../constants/userRoles');
const {
    USER_PRIVILEGE_FORM_CATALOG_SEED,
    validateCatalogSeed
} = require('../seeds/userPrivilegeFormCatalogSeedData');
const {
    isSafePrivilegeKey,
    getSchemaPrivilegeKeys,
    validateCatalogEntries,
    serializePrivilegeDocuments,
    validateFullUpdatePayload,
    updateAllPrivilegesAtomically
} = require('../services/userPrivilegesManagementService');
const UserModel = require('../models/userModel');
const { requireUserPrivilegesManagerRole } = require('../middlewares/requireAdminRole');
const userPrivilegesController = require('./userPrivilegesController');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function id(n) { return new mongoose.Types.ObjectId(`0000000000000000000000${String(n).padStart(2, '0')}`); }
function privilegeDoc(n, userId = 'user-1', form = `Form${n}`) {
    return {
        _id: id(n), userId, form, __v: 0,
        privileges: { admin: false, create: true, read: true, update: false, delete: false, print: true, export: false }
    };
}
function payloadFor(docs) {
    return { rows: docs.map((doc) => ({ id: String(doc._id), form: doc.form, privileges: { admin: true, create: false, read: true, update: true, delete: false, print: false, export: true } })) };
}
function catalogFor(docs) {
    return docs.map((doc, index) => ({
        form: doc.form,
        formLabel: `Ελληνική ονομασία ${doc.form}`,
        sidebarOrder: index,
        active: true,
        showInPrivileges: true
    }));
}
function catalogModelFor(entries) {
    return {
        find() {
            return {
                select() { return this; },
                sort() { return this; },
                session() { return this; },
                lean: async () => entries
            };
        }
    };
}
function hierarchyFor(catalog) {
    return catalog.map((entry, index) => ({
        form: entry.form,
        sidebarNodeId: `li${index + 1}`,
        itemLabel: entry.formLabel,
        itemOrder: index,
        ancestors: [{ key: 'test-root', label: 'Δοκιμές', order: 0 }]
    }));
}

test('A and S are the only user-privilege manager roles', () => {
    assert.strictEqual(isUserPrivilegesManagerRole('A'), true);
    assert.strictEqual(isUserPrivilegesManagerRole(' s '), true);
    for (const role of ['HR', 'C', 'U', 'V']) assert.strictEqual(isUserPrivilegesManagerRole(role), false, role);
});

test('A/S middleware admits active A and S and rejects HR/C/U/V for page and APIs', async () => {
    const originalFindById = UserModel.findById;
    try {
        for (const role of USER_ROLE_CODES) {
            UserModel.findById = () => ({ select: () => ({ lean: async () => ({ privileges: role, situation: 'A' }) }) });
            let nextCalls = 0;
            const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, send() { return this; }, redirect() { return this; } };
            await requireUserPrivilegesManagerRole({ session: { userId: 'actor' } }, res, () => { nextCalls += 1; });
            assert.strictEqual(nextCalls, ['A', 'S'].includes(role) ? 1 : 0, role);
            if (!['A', 'S'].includes(role)) assert.strictEqual(res.statusCode, 403, role);
        }
    } finally {
        UserModel.findById = originalFindById;
    }
});

test('central role labels cover every supported role', () => {
    assert.deepStrictEqual(USER_ROLE_CODES.map(getUserRoleLabel), ['Admin', 'Supervisor', 'HR', 'Customer', 'User', 'Visitor']);
});

test('schema and collection contract remain compatible', () => {
    assert.strictEqual(UserPrivilegesModel.collection.name, 'User_Privileges');
    assert.strictEqual(UserPrivilegesModel.schema.path('userId').instance, 'String');
    assert.strictEqual(UserPrivilegesModel.schema.path('form').instance, 'String');
    assert.deepStrictEqual(getSchemaPrivilegeKeys(), ['admin', 'create', 'read', 'update', 'delete', 'print', 'export']);
    assert.ok(UserPrivilegesModel.schema.indexes().some(([keys, options]) => keys.userId === 1 && keys.form === 1 && options.unique));
});

test('catalog schema uses central display metadata and required indexes', () => {
    assert.strictEqual(UserPrivilegeFormCatalogModel.collection.name, 'User_Privilege_Form_Catalog');
    assert.strictEqual(UserPrivilegeFormCatalogModel.schema.path('form').options.immutable, true);
    assert.strictEqual(UserPrivilegeFormCatalogModel.schema.path('formLabel').options.required, true);
    assert.strictEqual(UserPrivilegeFormCatalogModel.schema.path('sidebarOrder').options.required, true);
    assert.strictEqual(UserPrivilegeFormCatalogModel.schema.path('active').options.default, true);
    assert.strictEqual(UserPrivilegeFormCatalogModel.schema.path('showInPrivileges').options.default, true);
    const indexes = UserPrivilegeFormCatalogModel.schema.indexes();
    assert.ok(indexes.some(([keys, options]) => keys.form === 1 && options.unique));
    assert.ok(indexes.some(([keys]) => keys.active === 1 && keys.sidebarOrder === 1));
    assert.ok(!UserPrivilegesModel.schema.path('formLabel'));
    assert.ok(!UserPrivilegesModel.schema.path('sidebarOrder'));
});

test('unsafe and MongoDB path keys are rejected', () => {
    for (const key of ['__proto__', 'prototype', 'constructor', '$set', 'read.value', '_id', '__v', 'userId', 'form']) {
        assert.strictEqual(isSafePrivilegeKey(key), false, key);
    }
});

test('serialization produces stable safe columns and per-row applicability', () => {
    const docs = [privilegeDoc(2, 'user-1', 'Beta'), privilegeDoc(1, 'user-1', 'Alpha')];
    const catalog = [
        { form: 'Alpha', formLabel: 'Άλφα', sidebarOrder: 0 },
        { form: 'Beta', formLabel: 'Βήτα', sidebarOrder: 1 }
    ];
    const result = serializePrivilegeDocuments(catalog, docs, undefined, hierarchyFor(catalog));
    assert.deepStrictEqual(result.columns, ['admin', 'create', 'read', 'update', 'delete', 'print', 'export']);
    assert.deepStrictEqual(result.rows.map((row) => row.form), ['Alpha', 'Beta']);
    assert.ok(result.rows[1].applicableKeys.includes('export'));
    assert.ok(!Object.keys(result.rows[0]).includes('userId'));
    assert.strictEqual(result.rows[0].form, 'Alpha');
    assert.strictEqual(result.rows[0].formLabel, 'Άλφα');
    assert.deepStrictEqual(result.rows.map((row) => row.sidebarOrder), [0, 1]);
    assert.deepStrictEqual(result.rows[0].navigation, {
        itemLabel: 'Άλφα',
        itemOrder: 0,
        ancestors: [{ key: 'test-root', label: 'Δοκιμές', order: 0 }]
    });
});

test('seed catalog validates unique forms and visible orders', () => {
    assert.strictEqual(validateCatalogSeed(), USER_PRIVILEGE_FORM_CATALOG_SEED);
    assert.throws(() => validateCatalogSeed([
        { form: 'One', formLabel: 'Ένα', sidebarOrder: 0 },
        { form: 'Two', formLabel: 'Δύο', sidebarOrder: 0 }
    ]), /Duplicate visible sidebarOrder/);
    assert.throws(() => validateCatalogEntries([
        { form: 'One', formLabel: '', sidebarOrder: 0 }
    ]), (error) => error.code === 'INVALID_CATALOG_ENTRY');
});

test('seed script is explicit, idempotent and never deletes unknown catalog rows', () => {
    const source = fs.readFileSync(path.join(root, 'server/seeds/seedUserPrivilegeFormCatalog.js'), 'utf8');
    assert.ok(source.includes("process.argv.includes('--dry-run')"));
    assert.ok(source.includes("process.argv.includes('--apply')"));
    assert.ok(source.includes('$setOnInsert'));
    assert.ok(source.includes('bulkWrite'));
    assert.ok(source.includes('upsert: true'));
    assert.ok(!/\bdelete(?:One|Many)\b/.test(source));
    assert.ok(!/require\(['"]\.\.\/app/.test(source));
});

test('a catalog form without a user document is serialized with false privileges', () => {
    const catalog = [{
        form: 'ElegxosApasxolhseonPeriodoy',
        formLabel: 'Έλεγχος Απασχολήσεων',
        sidebarOrder: 12
    }];
    const serialized = serializePrivilegeDocuments(catalog, [], undefined, hierarchyFor(catalog));
    assert.strictEqual(serialized.rows.length, 1);
    assert.deepStrictEqual(serialized.rows[0], {
        id: null,
        form: 'ElegxosApasxolhseonPeriodoy',
        formLabel: 'Έλεγχος Απασχολήσεων',
        sidebarOrder: 12,
        exists: false,
        applicableKeys: ['admin', 'create', 'read', 'update', 'delete', 'print', 'export'],
        privileges: Object.assign(Object.create(null), {
            admin: false, create: false, delete: false, export: false,
            print: false, read: false, update: false
        }),
        navigation: {
            itemLabel: 'Έλεγχος Απασχολήσεων',
            itemOrder: 0,
            ancestors: [{ key: 'test-root', label: 'Δοκιμές', order: 0 }]
        }
    });
    const payload = { rows: [{
        id: null,
        form: catalog[0].form,
        privileges: { admin: false, create: false, delete: false, export: false, print: false, read: true, update: false }
    }] };
    const plan = validateFullUpdatePayload(payload, catalog, []);
    assert.strictEqual(plan.length, 1);
    assert.strictEqual(plan[0].canonical, null);
    assert.strictEqual(plan[0].catalogEntry.form, 'ElegxosApasxolhseonPeriodoy');
    assert.ok(!Object.prototype.hasOwnProperty.call(payload.rows[0], 'formLabel'));
});

test('YpobolhAdeion without a user document is serialized with every privilege false', () => {
    const catalog = [{ form: 'YpobolhAdeion', formLabel: 'Υποβολή Αδειών', sidebarOrder: 15500 }];
    const result = serializePrivilegeDocuments(catalog, [], undefined, hierarchyFor(catalog));
    assert.strictEqual(result.rows[0].exists, false);
    assert.strictEqual(result.rows[0].id, null);
    assert.ok(Object.values(result.rows[0].privileges).every((value) => value === false));
});

test('mixed existing and missing documents are left-joined in catalog sidebar order', () => {
    const catalog = [
        { form: 'FirstForm', formLabel: 'Πρώτη', sidebarOrder: 4 },
        { form: 'MissingForm', formLabel: 'Δεύτερη', sidebarOrder: 5 },
        { form: 'LastForm', formLabel: 'Τρίτη', sidebarOrder: 6 }
    ];
    const documents = [
        privilegeDoc(2, 'user-1', 'LastForm'),
        privilegeDoc(1, 'user-1', 'FirstForm')
    ];
    const result = serializePrivilegeDocuments(catalog, documents, undefined, hierarchyFor(catalog));
    assert.deepStrictEqual(result.rows.map((row) => row.form), ['FirstForm', 'MissingForm', 'LastForm']);
    assert.deepStrictEqual(result.rows.map((row) => row.exists), [true, false, true]);
    assert.strictEqual(result.rows[1].id, null);
    assert.ok(Object.values(result.rows[1].privileges).every((value) => value === false));
});

test('serialization fails closed when hierarchy is missing or malformed', () => {
    const catalog = [{ form: 'Alpha', formLabel: 'Άλφα', sidebarOrder: 0 }];
    assert.throws(
        () => serializePrivilegeDocuments(catalog, [], undefined, []),
        (error) => error.status === 500
    );
    assert.throws(
        () => serializePrivilegeDocuments(catalog, [], undefined, [{
            form: 'Alpha',
            sidebarNodeId: 'li1',
            itemLabel: 'Άλφα',
            itemOrder: -1,
            ancestors: [{ key: 'root', label: 'Ρίζα', order: 0 }]
        }]),
        (error) => error.status === 500
    );
});

test('runtime serialization reads labels only from the catalog', () => {
    const source = fs.readFileSync(path.join(root, 'server/services/userPrivilegesManagementService.js'), 'utf8');
    assert.ok(!source.includes('userPrivilegeFormLabels'));
    assert.ok(!source.includes('getUserPrivilegeFormLabel'));
    assert.ok(source.includes('formLabel: entry.formLabel'));
});

test('full update accepts exact canonical rows and JSON booleans', () => {
    const docs = [privilegeDoc(1), privilegeDoc(2)];
    const plan = validateFullUpdatePayload(payloadFor(docs), catalogFor(docs), docs);
    assert.strictEqual(plan.length, 2);
    assert.strictEqual(plan[0].values.admin, true);
});

test('full update rejects unknown, duplicate, missing, extra and foreign rows', () => {
    const docs = [privilegeDoc(1), privilegeDoc(2)];
    const cases = [];
    const duplicate = payloadFor(docs); duplicate.rows[1].form = duplicate.rows[0].form; cases.push(duplicate);
    const missing = payloadFor(docs); missing.rows.pop(); cases.push(missing);
    const extra = payloadFor(docs); extra.rows.push({ ...extra.rows[0], id: String(id(3)) }); cases.push(extra);
    const foreign = payloadFor(docs); foreign.rows[0].id = String(id(9)); cases.push(foreign);
    for (const value of cases) assert.throws(() => validateFullUpdatePayload(value, catalogFor(docs), docs));
});

test('full update rejects tampered form, userId, unknown keys and non-booleans', () => {
    const docs = [privilegeDoc(1)];
    const catalog = catalogFor(docs);
    const form = payloadFor(docs); form.rows[0].form = 'Other'; assert.throws(
        () => validateFullUpdatePayload(form, catalog, docs),
        (error) => error.code === 'UNKNOWN_FORM'
    );
    const owner = payloadFor(docs); owner.rows[0].userId = 'other'; assert.throws(() => validateFullUpdatePayload(owner, catalog, docs));
    const display = payloadFor(docs); display.rows[0].formLabel = 'Παραποιημένη ετικέτα'; assert.throws(() => validateFullUpdatePayload(display, catalog, docs));
    const navigation = payloadFor(docs); navigation.rows[0].navigation = {}; assert.throws(() => validateFullUpdatePayload(navigation, catalog, docs));
    const unknown = payloadFor(docs); unknown.rows[0].privileges.execute = true; assert.throws(() => validateFullUpdatePayload(unknown, catalog, docs));
    const polluted = payloadFor(docs); polluted.rows[0].privileges = JSON.parse('{"admin":true,"create":false,"read":true,"update":true,"delete":false,"print":false,"export":true,"constructor":false}'); assert.throws(() => validateFullUpdatePayload(polluted, catalog, docs));
    for (const bad of ['true', 1, null, {}, []]) {
        const invalid = payloadFor(docs); invalid.rows[0].privileges.admin = bad; assert.throws(() => validateFullUpdatePayload(invalid, catalog, docs));
    }
});

test('transactional writer updates every row and rejects partial match atomically', async () => {
    const docs = [privilegeDoc(1), privilegeDoc(2)];
    let writes = 0; let reads = 0; let transactions = 0; let ended = 0; const updates = [];
    let activeSession;
    const model = {
        schema: UserPrivilegesModel.schema,
        find() {
            return { select() { return { session(session) { activeSession = session; return { lean: async () => { reads += 1; return docs; } }; } }; } };
        },
        async updateOne(filter, update, options) { writes += 1; updates.push({ filter, update, options }); return { matchedCount: 1 }; }
    };
    const session = { async withTransaction(fn) { transactions += 1; await fn(); }, async endSession() { ended += 1; } };
    const catalogModel = catalogModelFor(catalogFor(docs));
    await updateAllPrivilegesAtomically({ userId: 'user-1', payload: payloadFor(docs), model, catalogModel, connection: { startSession: async () => session } });
    assert.deepStrictEqual({ reads, writes, transactions, ended }, { reads: 1, writes: 2, transactions: 1, ended: 1 });
    assert.strictEqual(activeSession, session);
    assert.ok(updates.every((entry) => entry.options.session === session));
    assert.ok(updates.every((entry) => entry.filter.__v === 0 && entry.update.$inc.__v === 1));

    let call = 0;
    model.updateOne = async () => ({ matchedCount: ++call === 2 ? 0 : 1 });
    await assert.rejects(() => updateAllPrivilegesAtomically({ userId: 'user-1', payload: payloadFor(docs), model, catalogModel, connection: { startSession: async () => session } }), /ταυτόχρονα/);
});

test('transaction retry rebuilds canonical plan from the same session without external side effects', async () => {
    const docs = [privilegeDoc(1)];
    let reads = 0; let writes = 0; let callbacks = 0; let authorizations = 0;
    const session = {
        async withTransaction(fn) { callbacks += 1; await fn(); callbacks += 1; await fn(); },
        async endSession() {}
    };
    const model = {
        schema: UserPrivilegesModel.schema,
        find() { return { select() { return { session(received) { assert.strictEqual(received, session); return { lean: async () => { reads += 1; return docs; } }; } }; } }; },
        async updateOne(_filter, update) { writes += 1; assert.strictEqual(update.$inc.__v, 1); return { matchedCount: 1 }; }
    };
    await updateAllPrivilegesAtomically({
        userId: 'user-1',
        payload: payloadFor(docs),
        model,
        catalogModel: catalogModelFor(catalogFor(docs)),
        connection: { startSession: async () => session },
        authorizeTarget: async (receivedSession) => {
            authorizations += 1;
            assert.strictEqual(receivedSession, session);
        }
    });
    assert.deepStrictEqual(
        { callbacks, authorizations, reads, writes },
        { callbacks: 2, authorizations: 2, reads: 2, writes: 2 }
    );
});

test('transaction atomically updates existing rows and creates missing catalog rows', async () => {
    const existing = privilegeDoc(1, 'user-1', 'ExistingForm');
    const catalog = [
        { form: 'ExistingForm', formLabel: 'Υπάρχουσα', sidebarOrder: 0 },
        { form: 'MissingForm', formLabel: 'Νέα', sidebarOrder: 1 }
    ];
    const payload = {
        rows: [
            payloadFor([existing]).rows[0],
            {
                id: null,
                form: 'MissingForm',
                privileges: { admin: false, create: false, read: true, update: false, delete: false, print: false, export: false }
            }
        ]
    };
    const writes = [];
    const model = {
        schema: UserPrivilegesModel.schema,
        find() { return { select() { return { session() { return { lean: async () => [existing] }; } }; } }; },
        async updateOne(filter, update, options) {
            writes.push({ type: 'update', filter, update, options });
            return { matchedCount: 1 };
        },
        async create(documents, options) {
            writes.push({ type: 'create', documents, options });
            return documents;
        }
    };
    const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
    await updateAllPrivilegesAtomically({
        userId: 'user-1',
        payload,
        model,
        catalogModel: catalogModelFor(catalog),
        connection: { startSession: async () => session }
    });
    assert.deepStrictEqual(writes.map((write) => write.type), ['update', 'create']);
    assert.strictEqual(writes[1].documents[0].form, 'MissingForm');
    assert.strictEqual(writes[1].documents[0].privileges.read, true);
    assert.strictEqual(writes[1].options.session, session);

    model.create = async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); };
    await assert.rejects(
        () => updateAllPrivilegesAtomically({
            userId: 'user-1',
            payload,
            model,
            catalogModel: catalogModelFor(catalog),
            connection: { startSession: async () => session }
        }),
        (error) => error.code === 'CONCURRENT_INSERT' && error.status === 409
    );
});

test('transaction aborts before privilege reads and writes when target scope authorization fails', async () => {
    let reads = 0; let writes = 0; let ended = 0;
    const session = {
        async withTransaction(fn) { await fn(); },
        async endSession() { ended += 1; }
    };
    const model = {
        schema: UserPrivilegesModel.schema,
        find() { reads += 1; throw new Error('must not read privileges'); },
        async updateOne() { writes += 1; return { matchedCount: 1 }; }
    };
    await assert.rejects(
        () => updateAllPrivilegesAtomically({
            userId: 'foreign-user',
            payload: { rows: [] },
            model,
            catalogModel: catalogModelFor([]),
            connection: { startSession: async () => session },
            authorizeTarget: async () => {
                throw Object.assign(new Error('Ο χρήστης δεν βρέθηκε'), {
                    status: 404,
                    code: 'USER_NOT_FOUND'
                });
            }
        }),
        (error) => error.code === 'USER_NOT_FOUND'
    );
    assert.deepStrictEqual({ reads, writes, ended }, { reads: 0, writes: 0, ended: 1 });
});

test('transaction rolls back earlier row when a later version guard does not match', async () => {
    const docs = [privilegeDoc(1), privilegeDoc(2)];
    const committed = new Map(docs.map((doc) => [String(doc._id), doc.privileges.admin]));
    let staged;
    const session = {
        async withTransaction(fn) {
            staged = new Map(committed);
            try { await fn(); } catch (error) { staged = null; throw error; }
            committed.clear();
            for (const [key, value] of staged) committed.set(key, value);
        },
        async endSession() {}
    };
    let writeNumber = 0;
    const model = {
        schema: UserPrivilegesModel.schema,
        find() { return { select() { return { session() { return { lean: async () => docs }; } }; } }; },
        async updateOne(filter, update) {
            writeNumber += 1;
            if (writeNumber === 2) return { matchedCount: 0 };
            staged.set(String(filter._id), update.$set['privileges.admin']);
            return { matchedCount: 1 };
        }
    };
    await assert.rejects(() => updateAllPrivilegesAtomically({
        userId: 'user-1',
        payload: payloadFor(docs),
        model,
        catalogModel: catalogModelFor(catalogFor(docs)),
        connection: { startSession: async () => session }
    }));
    assert.deepStrictEqual([...committed.values()], [false, false]);
});

test('routes protect page and both APIs with the A/S middleware', () => {
    const routes = fs.readFileSync(path.join(root, 'server/routes/usersRoute.js'), 'utf8');
    for (const signature of [
        "router.get('/admin/user-privileges', requireUserPrivilegesManagerRole",
        "router.get('/admin/user-privileges/users', requireUserPrivilegesManagerRole",
        "router.get('/admin/user-privileges/:userId', requireUserPrivilegesManagerRole",
        "router.put('/admin/user-privileges/:userId', requireUserPrivilegesManagerRole"
    ]) assert.ok(routes.includes(signature), signature);
});

test('user API projection excludes all sensitive fields', () => {
    const controller = fs.readFileSync(path.join(root, 'server/controllers/userPrivilegesController.js'), 'utf8');
    const selects = [...controller.matchAll(/\.select\('([^']+)'\)/g)].map((match) => match[1]);
    const userSelect = selects.find((value) => value.includes('firstName'));
    assert.ok(userSelect);
    for (const sensitive of ['password', 'token', 'secret', 'mfa', 'session', 'isVerified', 'details']) assert.ok(!userSelect.toLowerCase().includes(sensitive));
});

test('selected user validation rejects malformed and missing ObjectIds', async () => {
    await assert.rejects(() => userPrivilegesController.requireExistingUser('not-an-object-id', 'TEAM1'), (error) => error.code === 'INVALID_USER_ID');
    const originalFindOne = UserModel.findOne;
    try {
        UserModel.findOne = () => ({ select: () => ({ lean: async () => null }) });
        await assert.rejects(() => userPrivilegesController.requireExistingUser(String(id(8)), 'TEAM1'), (error) => error.code === 'USER_NOT_FOUND');
    } finally {
        UserModel.findOne = originalFindOne;
    }
});

test('controller returns safe 400 and 404 responses for invalid and missing users', async () => {
    function response() {
        return {
            statusCode: 200,
            payload: null,
            status(code) { this.statusCode = code; return this; },
            json(value) { this.payload = value; return this; }
        };
    }

    const invalid = response();
    await userPrivilegesController.getPrivileges({ session: { userTeam: 'TEAM1' }, params: { userId: 'not-an-object-id' } }, invalid);
    assert.strictEqual(invalid.statusCode, 400);
    assert.strictEqual(invalid.payload.code, 'INVALID_USER_ID');

    const originalFindOne = UserModel.findOne;
    try {
        UserModel.findOne = () => ({ select: () => ({ lean: async () => null }) });
        const missing = response();
        await userPrivilegesController.getPrivileges({ session: { userTeam: 'TEAM1' }, params: { userId: String(id(8)) } }, missing);
        assert.strictEqual(missing.statusCode, 404);
        assert.strictEqual(missing.payload.code, 'USER_NOT_FOUND');
    } finally {
        UserModel.findOne = originalFindOne;
    }
});

test('read and write catalog flows ignore non-canonical legacy forms without weakening canonical rows', async () => {
    const previousSanitizeFilter = mongoose.get('sanitizeFilter');
    const visibleCatalog = USER_PRIVILEGE_FORM_CATALOG_SEED
        .filter((entry) => entry.active && entry.showInPrivileges);
    const originalFindOne = UserModel.findOne;
    const originalCatalogFind = UserPrivilegeFormCatalogModel.find;
    const originalPrivilegesFind = UserPrivilegesModel.find;
    let catalogFilter;
    let documentsFilter;
    try {
        UserModel.findOne = () => ({
            select: () => ({ lean: async () => ({ _id: id(8), privileges: 'U' }) })
        });
        UserPrivilegeFormCatalogModel.find = (filter) => {
            catalogFilter = filter;
            return {
                select() { return this; },
                sort() { return this; },
                lean: async () => visibleCatalog
            };
        };
        UserPrivilegesModel.find = (filter) => {
            documentsFilter = filter;
            return { select() { return this; }, lean: async () => [] };
        };
        const res = {
            statusCode: 200,
            payload: null,
            status(code) { this.statusCode = code; return this; },
            json(value) { this.payload = value; return this; }
        };
        await userPrivilegesController.getPrivileges({
            session: { userTeam: 'TEAM1' },
            params: { userId: String(id(8)) }
        }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.payload.rows.length, 27);
        assert.strictEqual(catalogFilter.form.$in.length, 27);
        assert.ok(catalogFilter.form.$in.includes('LhpshProdhlomenonOrarionMonoDaneizomenon'));
        assert.ok(catalogFilter.form.$in.includes('LhpshPshfiakonKartonMonoDaneizomenon'));
        assert.ok(!catalogFilter.form.$in.includes('CalcApasxolhseisDaneizomenoyProsopikoy'));
        assert.deepStrictEqual(documentsFilter.form.$in, catalogFilter.form.$in);
    } finally {
        UserModel.findOne = originalFindOne;
        UserPrivilegeFormCatalogModel.find = originalCatalogFind;
        UserPrivilegesModel.find = originalPrivilegesFind;
    }
    mongoose.set('sanitizeFilter', true);
    for (const [model, filter] of [
        [UserPrivilegeFormCatalogModel, catalogFilter],
        [UserPrivilegesModel, documentsFilter]
    ]) {
        const query = model.find(filter);
        mongoose.sanitizeFilter(query.getFilter());
        assert.doesNotThrow(() => query.cast());
    }

    let writeCatalogFilter;
    const document = privilegeDoc(1, 'user-1', 'OnlyForm');
    const catalog = catalogFor([document]);
    const model = {
        schema: UserPrivilegesModel.schema,
        find() {
            return { select() { return { session() { return { lean: async () => [document] }; } }; } };
        },
        async updateOne() { return { matchedCount: 1 }; }
    };
    const catalogModel = {
        find(filter) {
            writeCatalogFilter = filter;
            return {
                select() { return this; },
                sort() { return this; },
                session() { return this; },
                lean: async () => catalog
            };
        }
    };
    const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
    await updateAllPrivilegesAtomically({
        userId: 'user-1',
        payload: payloadFor([document]),
        model,
        catalogModel,
        connection: { startSession: async () => session }
    });
    assert.strictEqual(writeCatalogFilter.form.$in.length, 27);
    const writeCatalogQuery = UserPrivilegeFormCatalogModel.find(writeCatalogFilter);
    mongoose.sanitizeFilter(writeCatalogQuery.getFilter());
    assert.doesNotThrow(() => writeCatalogQuery.cast());
    mongoose.set('sanitizeFilter', previousSanitizeFilter);
});

test('missing one of the 27 canonical catalog rows remains a strict hierarchy mismatch', () => {
    const visibleCatalog = USER_PRIVILEGE_FORM_CATALOG_SEED
        .filter((entry) => entry.active && entry.showInPrivileges);
    const missingNewForm = visibleCatalog.filter(
        (entry) => entry.form !== 'LhpshPshfiakonKartonMonoDaneizomenon'
    );
    assert.strictEqual(visibleCatalog.length, 27);
    assert.strictEqual(missingNewForm.length, 26);
    assert.throws(
        () => serializePrivilegeDocuments(missingNewForm, []),
        (error) => error.code === 'PRIVILEGE_HIERARCHY_MISMATCH' && error.status === 500
    );
});

test('users dropdown response contains only safe descriptive fields and central role labels', async () => {
    const originalFind = UserModel.find;
    try {
        UserModel.find = () => ({
            select: () => ({
                sort: () => ({
                    lean: async () => [{ _id: id(7), kod: '7', firstName: 'Test', lastName: 'User', email: 'safe@example.invalid', team: 'T', privileges: 'S', situation: 'A', password: 'must-not-leak' }]
                })
            })
        });
        const res = { payload: null, json(value) { this.payload = value; return this; }, status() { return this; } };
        await userPrivilegesController.listUsers({ session: { userTeam: 'TEAM1' } }, res);
        assert.strictEqual(res.payload.items[0].roleLabel, 'Supervisor');
        assert.deepStrictEqual(Object.keys(res.payload.items[0]).sort(), ['active', 'label', 'role', 'roleLabel', 'value']);
        assert.ok(!JSON.stringify(res.payload).includes('must-not-leak'));
    } finally {
        UserModel.find = originalFind;
    }
});

test('page compiles and is CSP safe', () => {
    const filename = path.join(root, 'views/users/dikaiomataXrhston.ejs');
    const source = fs.readFileSync(filename, 'utf8');
    ejs.compile(source, { filename });
    assert.ok(!/<script(?![^>]*\bsrc=)/i.test(source));
    assert.ok(!/\son[a-z]+\s*=/i.test(source));
    assert.ok(!/javascript:/i.test(source));
    assert.ok(source.includes("script('admin/userPrivilegesManagement')"));
    assert.ok(source.includes('href="/mainapp"'));
    assert.ok(source.includes('id="userPrivilegesToggleAll" type="button" class="btn btn-success"'));
    assert.ok(source.includes('btn btn-brown rounded-4 mt-1 w-20 buttons-content'));
    assert.ok(source.includes('bi bi-floppy'));
    assert.ok(source.includes('bi bi-chevron-double-left'));
});

test('form names are normal weight and footer reuses exact employee maintenance button classes', () => {
    const view = fs.readFileSync(path.join(root, 'views/users/dikaiomataXrhston.ejs'), 'utf8');
    const employeeFooter = fs.readFileSync(
        path.join(root, 'views/ergazomenoi/ergazomenoi/partials/edit/cardFooters/cardFooter_Edit.ejs'),
        'utf8'
    );
    const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
    for (const classList of [
        'btn btn-brown rounded-4 mt-1 w-20 buttons-content',
        'btn btn-brown buttons-content rounded-4 mt-1 w-20'
    ]) {
        assert.ok(view.includes(classList));
        assert.ok(employeeFooter.includes(classList));
    }
    assert.ok(view.includes('href="/mainapp"'));
    assert.ok(!/style\s*=/.test(view));
    assert.ok(/\.user-privileges-form-name\s*\{[^}]*font-weight:\s*400;/s.test(css));
    assert.ok(!/<(?:strong|b)(?:\s|>)/.test(view));
    const brownRule = css.match(/\.btn-brown\s*\{([^}]*)\}/)?.[1] || '';
    for (const variable of [
        '--bs-btn-bg', '--bs-btn-border-color', '--bs-btn-hover-bg',
        '--bs-btn-focus-shadow-rgb', '--bs-btn-active-bg'
    ]) assert.ok(brownRule.includes(variable), variable);
});

test('user privilege TomSelect reserves an external reset lane without overriding global reset positioning', () => {
    const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
    const fieldRule = css.match(/\.user-privileges-user-field\s*\{([^}]*)\}/);
    const wrapperRule = css.match(/\.user-privileges-user-field \.ts-wrapper\s*\{([^}]*)\}/);
    assert.ok(fieldRule && /padding-inline-end:\s*2\.5rem/.test(fieldRule[1]));
    assert.ok(fieldRule && /box-sizing:\s*border-box/.test(fieldRule[1]));
    assert.ok(wrapperRule && /width:\s*100%/.test(wrapperRule[1]));
    assert.ok(!/\.user-privileges-user-field \.ts-single-reset-btn\s*\{/.test(css));
    assert.ok(/\.user-privileges-user-field \.ts-control \.item\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s.test(css));
});

test('frontend includes in-flight guard, current-user clearing and safe toggle-all', () => {
    const source = fs.readFileSync(path.join(root, 'public/js/admin/userPrivilegesManagement.js'), 'utf8');
    assert.ok(/if \(!canStartSave\(state\)\) return/.test(source));
    assert.ok(/clearTable\(userId/.test(source));
    assert.ok(/input\[type="checkbox"\]:not\(:disabled\)/.test(source));
    assert.ok(/every\(\(box\) => box\.checked\)/.test(source));
    assert.ok(/X-CSRF-Token/.test(source));
    assert.ok(/formCell\.textContent = getFormDisplayLabel\(row\)/.test(source));
    assert.ok(/return \{ id: tr\.dataset\.rowId \|\| null, form: tr\.dataset\.form, privileges \}/.test(source));
    assert.ok(source.includes('user-privileges-column-toggle'));
    assert.ok(source.includes('toggleColumn(elements.body'));
    assert.ok(!/eval\s*\(|new Function|\.innerHTML\s*=|onclick\s*=/.test(source));
});

test('mutating route remains under the global CSRF contract', () => {
    const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const routeSource = fs.readFileSync(path.join(root, 'server/routes/usersRoute.js'), 'utf8');
    assert.ok(appSource.includes("req.headers['x-csrf-token']"));
    assert.ok(appSource.includes("if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))"));
    assert.ok(appSource.includes("return res.status(403).json"));
    assert.ok(routeSource.includes("router.put('/admin/user-privileges/:userId'"));
});

test('sidebar uses the centralized A/S helper', () => {
    const source = fs.readFileSync(path.join(root, 'views/partials/sidebar.ejs'), 'utf8');
    assert.ok(source.includes('isUserPrivilegesManagerRole(userRole)'));
    assert.ok(source.includes('/admin/user-privileges'));
    assert.ok(!/userRole\s*===\s*['"](?:A|S)['"]/.test(source));
});

test('catalog visible order exactly matches canonical data-privilege-form sidebar order', () => {
    const source = fs.readFileSync(path.join(root, 'views/partials/sidebar.ejs'), 'utf8');
    const sidebarForms = [...source.matchAll(/data-privilege-form="([^"]+)"/g)].map((match) => match[1]);
    assert.strictEqual(new Set(sidebarForms).size, sidebarForms.length);
    const visibleCatalog = USER_PRIVILEGE_FORM_CATALOG_SEED
        .filter((entry) => entry.active && entry.showInPrivileges !== false)
        .sort((a, b) => a.sidebarOrder - b.sidebarOrder || a.form.localeCompare(b.form));
    assert.deepStrictEqual(visibleCatalog.map((entry) => entry.form), sidebarForms);
    assert.strictEqual(new Set(visibleCatalog.map((entry) => entry.sidebarOrder)).size, visibleCatalog.length);
    assert.deepStrictEqual(
        visibleCatalog.map((entry) => entry.sidebarOrder),
        [
            ...Array.from({ length: 9 }, (_, index) => (index + 1) * 1000),
            9500,
            10000,
            10500,
            11000,
            13000,
            14000,
            15000,
            15500,
            ...Array.from({ length: 10 }, (_, index) => (index + 16) * 1000)
        ]
    );
    const employmentReview = visibleCatalog.find((entry) => entry.form === 'ElegxosApasxolhseonPeriodoy');
    assert.deepStrictEqual(getSchemaPrivilegeKeys(),
        ['admin', 'create', 'read', 'update', 'delete', 'print', 'export']);
    assert.strictEqual(employmentReview.sidebarOrder, 13000);
    assert.strictEqual(employmentReview.formLabel, 'Έλεγχος Απασχολήσεων');
});

(async () => {
    let passed = 0;
    for (const item of tests) {
        await item.fn();
        passed += 1;
        console.log(`PASS ${item.name}`);
    }
    console.log(`PASS user privileges management contract (${passed} tests)`);
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
