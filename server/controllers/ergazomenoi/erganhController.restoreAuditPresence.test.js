'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
mongoose.connect = mongoose.createConnection = () => { throw new Error('REAL_DB_FORBIDDEN'); };
const protection = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAppliedProtectionService');
const { ProdhlomenaOrariaAuditModel } = require('../../models/ergazomenoi');
const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
// Compile only the actual handler and guard, with fake persistence boundaries.
// No route, controller module initialization or DB connection is executed.
const handlerSource = source.slice(source.indexOf('static restoreProdhlomenaOrariaReviewRecord =') +
    'static restoreProdhlomenaOrariaReviewRecord ='.length,
source.indexOf('static getProdhlomenaOrariaReviewAudit =')).trim().replace(/;$/, '');
const guardSource = source.slice(source.indexOf('function blocksInteractiveAppliedIdentityChange('),
    source.indexOf('function clampDateStartUtc('));
const compile = new Function('dependencies', `
    const { mongoose, canReviewEdit, ProdhlomenaOrariaModel, ProdhlomenaOrariaAuditModel,
        assertActiveEmploymentReviewPeriodNormal, loadAppliedProtectionForRows, loadAppliedRepoTransferProtectionContext,
        sanitizeAppliedRepoTransferUpdate, APPLIED_PROTECTION_DIAGNOSTIC,
        runWithPeriodWriteFence, console } = dependencies;
    ${guardSource}
    return (${handlerSource});
`);
const id = '6a92b46e5de956f225bd3a4f';
const auditId = '7a92b46e5de956f225bd3a4f';
const copy = (v) => {
    if (v instanceof Date) return new Date(v.getTime());
    if (v instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(v.toHexString());
    if (Array.isArray(v)) return v.map(copy);
    if (v && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(
        Object.entries(v).map(([key, value]) => [key, copy(value)]));
    return v;
};
function harness({ oldValues, newValues, extra = {}, context = { entriesByRowId: {} } }) {
    const state = { row: { _id: new mongoose.Types.ObjectId(id), team: 'THA', company_kod: 'company',
        ypokatasthma: '0000', kodikos: '0031', hmeromhnia: new Date('2026-04-05'),
        is_locked: false, ...copy(newValues), ...extra }, audits: [], fence: 0 };
    let audit = { oldValues, newValues };
    const session = { transaction: true };
    const calls = { updates: [], reads: 0, preflightProtection: 0, freshProtection: 0 };
    const options = { auditFailure: false, contextFailure: false, concurrentApply: false };
    const rowModel = {
        findOne() { return { lean: async () => copy(state.row), session(actual) {
            assert.equal(actual, session); calls.reads++;
            return { lean: async () => copy(state.row) };
        } }; },
        async updateOne(filter, update, opts) {
            assert.equal(opts.session, session); assert.equal(filter._id, id);
            calls.updates.push(copy(update));
            Object.assign(state.row, copy(update.$set));
            for (const key of Object.keys(update.$unset || {})) delete state.row[key];
            return { matchedCount: 1 };
        }
    };
    const handler = compile({ mongoose, canReviewEdit: () => true,
        ProdhlomenaOrariaModel: rowModel,
        ProdhlomenaOrariaAuditModel: {
            findOne: () => ({ lean: async () => copy(audit) }),
            async create(records, opts) {
                assert.equal(opts.session, session);
                if (options.auditFailure) throw new Error('audit failure');
                state.audits.push(...copy(records));
            }
        },
        assertActiveEmploymentReviewPeriodNormal: async () => ({ scope: {}, token: {} }),
        loadAppliedProtectionForRows: async () => { calls.preflightProtection++; return copy(context); },
        loadAppliedRepoTransferProtectionContext: async ({ scopes, session: actual }) => {
            assert.equal(actual, session);
            assert.equal(calls.reads, 1 + calls.freshProtection);
            assert.ok(state.fence > 0);
            assert.deepEqual(scopes, [{ team: state.row.team, company_kod: state.row.company_kod,
                ypokatasthma: state.row.ypokatasthma, loadedRowIds: [state.row._id] }]);
            calls.freshProtection++;
            if (options.contextFailure) throw new Error('fresh protection load failure');
            return copy(context);
        },
        sanitizeAppliedRepoTransferUpdate: protection.sanitizeAppliedRepoTransferUpdate,
        APPLIED_PROTECTION_DIAGNOSTIC: protection.DIAGNOSTIC,
        runWithPeriodWriteFence: async ({ work }) => {
            if (options.concurrentApply) {
                assert.equal(calls.preflightProtection, 1);
                assert.deepEqual(context.entriesByRowId, {});
                const protectedValues = { kathgoria_ergasias_apologistika: 'ΕΡΓ',
                    repo_apologistika: false, apologistiko_biblio: true };
                context = { entriesByRowId: { [id]: { state: protection.PROTECTION_STATE.PROTECTED, protectedValues } } };
                Object.assign(state.row, protectedValues);
            }
            const before = copy(state); state.fence++;
            try { return await work({ session }); }
            catch (error) { Object.assign(state, before); throw error; }
        },
        console: { error() {} }
    });
    async function run(nextAudit = audit) {
        audit = nextAudit;
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; } };
        await handler({ session: { userTeam: 'THA', companyInUse: 'company', userName: 'reviewer' },
            params: { id, auditId } }, res);
        return res;
    }
    return { state, calls, options, run };
}

for (const [field, value, after] of [['argia', null, true], ['kathgoria_adeias_apologistika', '', 'POSSIBLE_LEAVE'],
    ['ores_ergasias_apologistika', 0, 5], ['argia', false, true]]) test(`legacy restore preserves exact ${String(value)} via set`, async () => {
    const h = harness({ oldValues: { [field]: value }, newValues: { [field]: after } });
    assert.equal((await h.run()).statusCode, 200);
    assert.equal(h.calls.updates[0].$set[field], value);
    assert.equal(Object.hasOwn(h.calls.updates[0], '$unset'), false);
    assert.equal(h.state.row.is_locked, true);
});

test('mixed set/unset and audit-of-restore reflect actual before state and are reversible', async () => {
    const h = harness({ oldValues: { argia: null }, newValues: { argia: true, ores_ergasias_apologistika: 4.98 },
        extra: { argia: false, ores_ergasias_apologistika: 6, untouched: 'sentinel' } });
    assert.equal((await h.run()).statusCode, 200);
    assert.deepEqual(h.calls.updates[0].$unset, { ores_ergasias_apologistika: '' });
    assert.equal(h.state.row.argia, null);
    assert.equal(Object.hasOwn(h.state.row, 'ores_ergasias_apologistika'), false);
    const restoreAudit = h.state.audits[0];
    assert.equal(restoreAudit.oldValues.argia, false);
    assert.equal(restoreAudit.oldValues.ores_ergasias_apologistika, 6);
    assert.equal(Object.hasOwn(restoreAudit.newValues, 'ores_ergasias_apologistika'), false);
    assert.equal((await h.run(restoreAudit)).statusCode, 200);
    assert.equal(h.state.row.argia, false);
    assert.equal(h.state.row.ores_ergasias_apologistika, 6);
    assert.equal(h.state.row.untouched, 'sentinel');
    assert.equal(h.state.row.is_locked, true); // historical restore behavior
});

test('restore of an audit that added a field can be reversed without a sentinel', async () => {
    const h = harness({ oldValues: {}, newValues: { ores_ergasias_apologistika: 4.98 } });
    await h.run();
    assert.equal(Object.hasOwn(h.state.row, 'ores_ergasias_apologistika'), false);
    const reverse = copy(h.state.audits[0]);
    await h.run(reverse);
    assert.equal(h.state.row.ores_ergasias_apologistika, 4.98);
    assert.equal(h.calls.reads, 2);
});

for (const field of protection.IDENTITY_FIELDS) test(`applied identity ${field} cannot be unset`, async () => {
    const protectedValues = { kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false, apologistiko_biblio: true };
    const h = harness({ oldValues: {}, newValues: { [field]: protectedValues[field] }, extra: protectedValues,
        context: { entriesByRowId: { [id]: { state: protection.PROTECTION_STATE.PROTECTED, protectedValues } } } });
    assert.equal((await h.run()).statusCode, 409);
    assert.equal(h.calls.updates.length, 0); assert.equal(h.state.audits.length, 0);
});

test('applied identity set guard remains active', async () => {
    const protectedValues = { kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false, apologistiko_biblio: true };
    const h = harness({ oldValues: { repo_apologistika: true }, newValues: { repo_apologistika: false },
        extra: protectedValues, context: { entriesByRowId: { [id]: { state: protection.PROTECTION_STATE.PROTECTED, protectedValues } } } });
    assert.equal((await h.run()).statusCode, 409); assert.equal(h.calls.updates.length, 0);
});

test('own undefined audit fails closed instead of being interpreted as missing', async () => {
    const h = harness({ oldValues: { argia: undefined }, newValues: { argia: true } });
    const result = await h.run();
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.code, 'REVIEW_AUDIT_UNREPRESENTABLE_VALUE');
    assert.equal(h.calls.updates.length, 0);
});

test('restore audit failure rolls back row and fence', async () => {
    const h = harness({ oldValues: {}, newValues: { argia: true } });
    const before = copy(h.state); h.options.auditFailure = true;
    assert.equal((await h.run()).statusCode, 500);
    assert.deepEqual(h.state, before);
});

test('existing audit model preserves null and omitted keys through offline BSON serialization', () => {
    const model = new ProdhlomenaOrariaAuditModel({ oldValues: { argia: null },
        newValues: { argia: true, ores_ergasias_apologistika: 4.98 } });
    const stored = mongoose.mongo.BSON.deserialize(mongoose.mongo.BSON.serialize(model.toObject()));
    assert.equal(stored.oldValues.argia, null);
    assert.equal(Object.hasOwn(stored.oldValues, 'ores_ergasias_apologistika'), false);
});

test('schema-minimized empty object audit values fail closed before restore', async () => {
    const h = harness({ oldValues: { compensation_breakdown_apologistika: {} },
        newValues: { compensation_breakdown_apologistika: { status: 'READY' } } });
    const result = await h.run();
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.code, 'REVIEW_AUDIT_UNREPRESENTABLE_VALUE');
    assert.equal(h.calls.updates.length, 0);
});


for (const direction of ['set', 'unset']) test(`concurrent apply after unprotected preflight blocks ${direction}`, async () => {
    const h = harness({ oldValues: direction === 'set' ? { repo_apologistika: true } : {},
        newValues: { repo_apologistika: false } });
    h.options.concurrentApply = true;
    const result = await h.run();
    assert.equal(result.statusCode, 409);
    assert.equal(h.calls.preflightProtection, 1);
    assert.equal(h.calls.freshProtection, 1);
    assert.equal(h.calls.updates.length, 0);
    assert.equal(h.state.audits.length, 0);
    assert.equal(Object.hasOwn(h.state.row, 'repo_apologistika'), true);
    assert.equal(h.state.row.repo_apologistika, false);
    assert.equal(h.state.fence, 0);
});

test('authoritative context load failure rolls back fence before any update/audit', async () => {
    const h = harness({ oldValues: {}, newValues: { argia: true } });
    const before = copy(h.state); h.options.contextFailure = true;
    assert.equal((await h.run()).statusCode, 500);
    assert.equal(h.calls.freshProtection, 1);
    assert.equal(h.calls.updates.length, 0);
    assert.deepEqual(h.state, before);
});

test('unprotected throughout uses fresh session context and still restores', async () => {
    const h = harness({ oldValues: { argia: null }, newValues: { argia: true } });
    assert.equal((await h.run()).statusCode, 200);
    assert.equal(h.calls.preflightProtection, 1);
    assert.equal(h.calls.freshProtection, 1);
    assert.equal(h.calls.updates.length, 1);
    assert.equal(h.state.audits.length, 1);
    assert.equal(h.state.row.argia, null);
});
