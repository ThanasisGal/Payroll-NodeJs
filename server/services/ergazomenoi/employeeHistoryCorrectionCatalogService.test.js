'use strict';

const assert = require('node:assert/strict');
const { test, before, after, mock } = require('node:test');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
before(() => forbidRealSettlementMongo(mock)); after(() => mock.restoreAll());
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
        specialCategoryModel: model([{ kodikos: '0004', perigrafh: 'Συνθετική ειδική κατηγορία' }], events, 'special'),
        kpkModel: model([{ kodikos: '0115', perigrafh: 'ΒΑΡΕΑ' },
            { kodikos: '0111', perigrafh: 'ΣΥΝΤΑΞΗ' }], events, 'kpk'),
        contractTypeModel: model([{ kodikos: '0002', perigrafh: 'Σύμβαση' }],
            events, 'type'),
        contractCategoryModel: model([{ kodikos: '0004', perigrafh: 'Κατηγορία', afora_thn_symbash: '0002' }],
            events, 'category'),
        contractSpecialtyModel: model([{ kodikos: '0003', perigrafh: 'Ειδικότητα', afora_thn_symbash_kathgoria: '00020004' }],
            events, 'specialty'), contractItemModel: model([], events, 'items')
    });
    assert.deepEqual(catalogs.KPK_EFKA, [
        { code: '0111', label: 'ΣΥΝΤΑΞΗ' },
        { code: '0115', label: 'ΒΑΡΕΑ' }
    ]);
    assert.deepEqual(catalogs.SPECIAL_EMPLOYEE_CATEGORY, [{ code: '0004', label: 'Συνθετική ειδική κατηγορία' }]);
    assert.deepEqual(catalogs.CONTRACT_TYPE,
        [{ code: '0002', label: 'Σύμβαση' }]);
    assert.deepEqual(catalogs.CONTRACT_CATEGORY,
        [{ code: '0004', label: 'Κατηγορία', afora_thn_symbash: '0002' }]);
    assert.deepEqual(catalogs.CONTRACT_SPECIALTY,
        [{ code: '0003', label: 'Ειδικότητα', afora_thn_symbash_kathgoria: '00020004' }]);
    assert.equal(events.filter(event => event[1] === 'session' && event[2] === session).length, 6);
});

test('άγνωστες ή ελλιπείς εγγραφές καταλόγου δεν γίνονται επιτρεπτές τιμές', async () => {
    const events = [];
    const empty = model([{ kodikos: '', perigrafh: 'Χωρίς κωδικό' },
        { kodikos: '0999', perigrafh: '' }, null], events, 'empty');
    const catalogs = await loadEmployeeHistoryCorrectionCatalogs({
        kpkModel: empty, specialCategoryModel: empty, contractTypeModel: empty,
        contractCategoryModel: empty, contractSpecialtyModel: empty, contractItemModel: empty
    });
    assert.deepEqual(catalogs, { KPK_EFKA: [], SPECIAL_EMPLOYEE_CATEGORY: [], CONTRACT_TYPE: [],
        CONTRACT_CATEGORY: [], CONTRACT_SPECIALTY: [], CONTRACT_ITEM: [] });
});

test('η ατομική αποθήκευση φορτώνει μόνο τους τέσσερις καταλόγους που ελέγχει, με ίδιες τιμές και συνεδρία', async () => {
    const events = [], session = { id: 'synthetic-selected-catalogs' };
    const dependencies = Object.fromEntries(['kpkModel', 'specialCategoryModel', 'contractTypeModel',
        'contractCategoryModel', 'contractSpecialtyModel', 'contractItemModel'].map(name => [name,
        model([{ kodikos: '01', perigrafh: 'Συνθετική τιμή' }], events, name)]));
    const all = await loadEmployeeHistoryCorrectionCatalogs({ ...dependencies, session });
    assert.equal(events.filter(event => event[1] === 'find').length, 6);
    events.length = 0;
    const requiredCatalogs = ['KPK_EFKA', 'CONTRACT_TYPE', 'CONTRACT_CATEGORY', 'CONTRACT_SPECIALTY'];
    const selected = await loadEmployeeHistoryCorrectionCatalogs({ ...dependencies, session, requiredCatalogs });
    for (const name of requiredCatalogs) assert.deepEqual(selected[name], all[name]);
    assert.equal(events.filter(event => event[1] === 'find').length, 4);
    assert.equal(events.filter(event => event[1] === 'session' && event[2] === session).length, 4);
    assert.equal(events.some(event => ['specialCategoryModel', 'contractItemModel'].includes(event[0])), false);
    assert.deepEqual(selected.SPECIAL_EMPLOYEE_CATEGORY, []);
    assert.deepEqual(selected.CONTRACT_ITEM, []);
});

test('η προεπιλεγμένη πηγή ειδικών κατηγοριών είναι το υφιστάμενο πραγματικό μοντέλο, μόνο με ανάγνωση', async () => {
    const { EidikesKathgoriesModel } = require('../../models/stathera_arxeia');
    assert.equal(EidikesKathgoriesModel.schema.path('kodikos').instance, 'String');
    assert.equal(EidikesKathgoriesModel.collection.name, 'Eidikes_Kathgories');
    const events = [], empty = model([], events, 'empty');
    const stub = mock.method(EidikesKathgoriesModel, 'find', model([{ kodikos: '0000', perigrafh: 'Συνθετική προεπιλογή' }], events, 'actual-special-model').find);
    try {
        const result = await loadEmployeeHistoryCorrectionCatalogs({ kpkModel: empty, contractTypeModel: empty,
            contractCategoryModel: empty, contractSpecialtyModel: empty, contractItemModel: empty });
        assert.deepEqual(result.SPECIAL_EMPLOYEE_CATEGORY, [{ code: '0000', label: 'Συνθετική προεπιλογή' }]);
        assert.deepEqual(events.find(event => event[0] === 'actual-special-model' && event[1] === 'find').slice(2),
            [{}, { _id: 0, kodikos: 1, perigrafh: 1 }]);
    } finally { stub.mock.restore(); }
});
