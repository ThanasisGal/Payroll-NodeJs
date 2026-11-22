'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('./employeePendingHistorySectionAuthorizationService');

function permissions(grants = {}) {
    const visits = [];
    return { visits, model: { findOne: ({ userId, form }) => {
        assert.equal(userId, 'synthetic-second-actor');
        visits.push(form);
        return { select() { return this; }, session() { return this; },
            async lean() { return { privileges: grants[form] || {} }; } };
    } } };
}
const pending = missingFields => ({ id: 'server-owned-pending', missingFields });

test('salary, deductions, hours and dates have distinct pending rights', () => {
    assert.equal(P.sectionForField('pragmatikosMisthos'), 'APODOCHES');
    assert.equal(P.sectionForField('nomimosMisthos'), 'APODOCHES');
    assert.equal(P.sectionForField('poso_symbashs_01'), 'APODOCHES');
    assert.equal(P.sectionForField('krathsh_01'), 'KRATHSEIS');
    assert.equal(P.sectionForField('kpk_efka'), 'KRATHSEIS');
    assert.equal(P.sectionForField('ores_ergasias_ebdomadas'), null);
    assert.equal(P.sectionForField('hmeromhnia_allaghs_symbashs'), null);
});
test('general Employee update alone never grants salary or deduction completion', async () => {
    const { model } = permissions({ Ergazomenoi: { update: true } });
    await assert.rejects(P.assertPendingHistorySectionAuthorization({
        actorUserId: 'synthetic-second-actor',
        pending: pending([{ field: 'nomimosMisthos', group: 'Αποδοχές' }]),
        privilegeModel: model
    }), { code: P.DENIED, statusCode: 403 });
});
test('all required section privileges are needed for mixed pending fields', async () => {
    const { model, visits } = permissions({
        Ergazomenoi: { update: true }, ErgazomenoiApodoxes: { update: true }
    });
    await assert.rejects(P.assertPendingHistorySectionAuthorization({
        actorUserId: 'synthetic-second-actor',
        pending: pending([{ field: 'krathsh_01' }, { field: 'nomimosMisthos' }]),
        privilegeModel: model
    }), { code: P.DENIED, statusCode: 403 });
    assert.ok(visits.includes('ErgazomenoiKrathseis'));
});
test('second actor with both explicit section grants can complete, regardless of original pending actor', async () => {
    const { model } = permissions({
        Ergazomenoi: { update: true },
        ErgazomenoiApodoxes: { update: true },
        ErgazomenoiKrathseis: { update: true }
    });
    const result = await P.assertPendingHistorySectionAuthorization({
        actorUserId: 'synthetic-second-actor',
        pending: { ...pending([{ field: 'nomimosMisthos' }, { field: 'krathsh_01' }]),
            actorUserId: 'synthetic-first-actor' },
        privilegeModel: model
    });
    assert.deepEqual(result.required, ['APODOCHES', 'KRATHSEIS']);
});
test('general Employee Admin can close an assigned pending; no browser role flag is needed', async () => {
    const { model, visits } = permissions({ Ergazomenoi: { admin: true } });
    const r = await P.assertPendingHistorySectionAuthorization({
        actorUserId: 'synthetic-second-actor',
        pending: pending([{ field: 'krathsh_01' }]),
        privilegeModel: model
    });
    assert.equal(r.authorizedBy, 'EMPLOYEE_ADMIN');
    assert.deepEqual(visits, ['Ergazomenoi']);
});
test('missing identity, model, or pending ID fails closed', async () => {
    const { model } = permissions();
    for (const options of [
        { actorUserId: '', pending: pending([{ field: 'krathsh_01' }]), privilegeModel: model },
        { actorUserId: 'synthetic-second-actor', pending: null, privilegeModel: model },
        { actorUserId: 'synthetic-second-actor', pending: pending([{ field: 'krathsh_01' }]) }
    ]) await assert.rejects(P.assertPendingHistorySectionAuthorization(options), { code: P.DENIED });
});
