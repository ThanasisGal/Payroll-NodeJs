'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadEmployeeHistoryCorrectionCatalogs } =
    require('./employeeHistoryCorrectionCatalogService');

function model(rows, events, name) {
    return { find(filter, projection) {
        events.push([name, 'find', filter, projection]);
        const query = {
            sort(value) { events.push([name, 'sort', value]); return this; },
            session(value) { events.push([name, 'session', value]); return this; },
            lean() { events.push([name, 'lean']); return Promise.resolve(rows); }
        };
        return query;
    } };
}

test('φορτώνει τους υφιστάμενους επίσημους καταλόγους στην ίδια συνεδρία και τους εξυγιαίνει', async () => {
    const events = [];
    const session = { id: 'transaction' };
    const catalogs = await loadEmployeeHistoryCorrectionCatalogs({ session,
        kpkModel: model([{ kodikos: '0115', perigrafh: 'ΒΑΡΕΑ' },
            { kodikos: '0111', perigrafh: 'ΣΥΝΤΑΞΗ' }], events, 'kpk'),
        contractTypeModel: model([{ kodikos: '0002', perigrafh: 'Σύμβαση' }],
            events, 'type'),
        contractCategoryModel: model([{ kodikos: '0004', perigrafh: 'Κατηγορία' }],
            events, 'category'),
        contractSpecialtyModel: model([{ kodikos: '0003', perigrafh: 'Ειδικότητα' }],
            events, 'specialty')
    });
    assert.deepEqual(catalogs.KPK_EFKA, [
        { code: '0111', label: 'ΣΥΝΤΑΞΗ' },
        { code: '0115', label: 'ΒΑΡΕΑ' }
    ]);
    assert.deepEqual(catalogs.CONTRACT_TYPE,
        [{ code: '0002', label: 'Σύμβαση' }]);
    assert.deepEqual(catalogs.CONTRACT_CATEGORY,
        [{ code: '0004', label: 'Κατηγορία' }]);
    assert.deepEqual(catalogs.CONTRACT_SPECIALTY,
        [{ code: '0003', label: 'Ειδικότητα' }]);
    assert.equal(events.filter(event => event[1] === 'session' && event[2] === session).length, 4);
});

test('άγνωστες ή ελλιπείς εγγραφές καταλόγου δεν γίνονται επιτρεπτές τιμές', async () => {
    const events = [];
    const empty = model([{ kodikos: '', perigrafh: 'Χωρίς κωδικό' },
        { kodikos: '0999', perigrafh: '' }, null], events, 'empty');
    const catalogs = await loadEmployeeHistoryCorrectionCatalogs({
        kpkModel: empty, contractTypeModel: empty,
        contractCategoryModel: empty, contractSpecialtyModel: empty
    });
    assert.deepEqual(catalogs, { KPK_EFKA: [], CONTRACT_TYPE: [],
        CONTRACT_CATEGORY: [], CONTRACT_SPECIALTY: [] });
});
