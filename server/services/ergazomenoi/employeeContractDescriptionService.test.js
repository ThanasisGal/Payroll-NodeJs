'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('./employeeContractDescriptionService');
const { loadEmployeeHistoryCorrectionCatalogs } = require('./employeeHistoryCorrectionCatalogService');
const { buildEmployeeHistoryReconstructionPreview, formatValue } = require('./employeeHistoryReconstructionPreviewService');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { planEmployeeHistoryAutomaticReconstruction } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { row, catalogs, data } = require('./fixtures/employeeContractDisplayFixtures');
const model = rows => ({ find() { return { sort() { return this; }, lean() { return Promise.resolve(rows); } }; } });

test('catalog loader preserves duplicate child codes, parent fields and full category descriptions', async () => {
    const result = await loadEmployeeHistoryCorrectionCatalogs({ kpkModel: model([]),
        contractTypeModel: model(data.CONTRACT_TYPE), contractCategoryModel: model(data.CONTRACT_CATEGORY),
        contractSpecialtyModel: model(data.CONTRACT_SPECIALTY), contractItemModel: model(data.CONTRACT_ITEM) });
    for (const key of Object.keys(data)) assert.deepEqual(result[key], catalogs[key]);
    assert.ok(result.CONTRACT_CATEGORY[1].label.length > 250);
});

test('same category, specialty and item codes resolve by every parent, regardless of ordering', () => {
    for (const lists of [catalogs, Object.fromEntries(Object.entries(catalogs).map(([key, value]) => [key, [...value].reverse()]))]) {
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_CATEGORY', '0003', row), data.CONTRACT_CATEGORY[1].perigrafh.trim());
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_SPECIALTY', '0001', row), 'ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ');
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_ITEM', '0001', row), 'ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ');
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_SPECIALTY', '0001', { ...row, kathgoria_symbashs: '0004' }), 'ΠΛΥΝΤΡΙΑ');
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_ITEM', '0001', { ...row, eidikothta_symbashs: '0002' }), 'ΑΛΛΟ ΣΤΟΙΧΕΙΟ ΕΙΔΙΚΟΤΗΤΑΣ');
        const other = { ...row, symbash: '0001' };
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_CATEGORY', '0003', other), 'ΑΛΛΗ ΚΑΤΗΓΟΡΙΑ');
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_SPECIALTY', '0001', other), 'ΑΡΧΙΜΑΓΕΙΡΟΣ');
        assert.equal(S.resolveContractDescription(lists, 'CONTRACT_ITEM', '0001', other), 'ΑΛΛΟ ΣΤΟΙΧΕΙΟ');
    }
    assert.equal(S.resolveContractDescription(catalogs, 'CONTRACT_SPECIALTY', '0001', { symbash: '0002' }), '');
    assert.equal(S.resolveContractDescription(catalogs, 'CONTRACT_ITEM', '0001', { ...row, eidikothta_symbashs: '9999' }), '');
    assert.equal(S.contractParentKey('0002', '', '0001'), '');
    assert.equal(formatValue('eidikothta_symbashs', '0001', catalogs, row), '0001 - ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ');
});

test('ambiguous full identities never pick an arbitrary description', () => {
    const conflicting = { ...catalogs, CONTRACT_SPECIALTY: [...catalogs.CONTRACT_SPECIALTY,
        { ...catalogs.CONTRACT_SPECIALTY[1], label: 'ΣΥΓΚΡΟΥΣΗ' }] };
    assert.equal(S.resolveContractDescription(conflicting, 'CONTRACT_SPECIALTY', '0001', row), '');
});

test('all fifteen slots retain only their own code, description and nonzero amounts', () => {
    const fixture = { ...row };
    for (let n = 3; n <= 15; n++) {
        const slot = String(n).padStart(2, '0');
        fixture[`poso_symbashs_${slot}`] = 0; fixture[`poso_symbashs_basei_oron_ergasias_${slot}`] = 0;
    }
    const resolve = code => S.resolveContractDescription(catalogs, 'CONTRACT_ITEM', code, fixture);
    assert.deepEqual(S.contractItemsForDisplay(fixture, resolve, String), [
        { index: '01', description: '0001 - ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ', contractAmount: '990', workTermsAmount: '' },
        { index: '02', description: '0007 - ΕΠΙΔΟΜΑ ΕΠΟΧΙΑΚΗΣ ΑΠΑΣΧΟΛΗΣΗΣ', contractAmount: '', workTermsAmount: '99' }
    ]);
    for (let n = 1; n <= 15; n++) {
        const slot = String(n).padStart(2, '0');
        fixture[`stoixeio_symbashs_${slot}`] = `CODE-${slot}`;
        fixture[`poso_symbashs_${slot}`] = n * 10; fixture[`poso_symbashs_basei_oron_ergasias_${slot}`] = n;
    }
    S.contractItemsForDisplay(fixture, code => code, String).forEach((item, index) => {
        assert.equal(item.contractAmount, String((index + 1) * 10));
        assert.equal(item.workTermsAmount, String(index + 1));
        assert.ok(item.description.startsWith(`CODE-${item.index} - `));
    });
});

test('original rows, proposed periods and changed values use their respective complete parent context', () => {
    const input = F.caseA();
    input.completeHistoryRows.forEach(r => Object.assign(r, row));
    Object.assign(input.currentEmployee, row);
    const plan = planEmployeeHistoryAutomaticReconstruction(input);
    const before = input.completeHistoryRows[0];
    const after = plan.proposedRows.find(r => String(r._id) === String(before._id));
    after.symbash = '0001';
    plan.rowDiffs.push({ historyId: before._id, field: 'symbash', before: '0002', after: '0001' },
        { historyId: before._id, field: 'eidikothta_symbashs', before: '0001', after: '0001' },
        { historyId: before._id, field: 'poso_symbashs_01', before: 990, after: 1000 });
    after.poso_symbashs_01 = 1000;
    const dto = buildEmployeeHistoryReconstructionPreview({ plan, completeHistoryRows: input.completeHistoryRows, catalogs });
    assert.ok(dto.periods.every(p => p.facts.some(f => f.value === '0001 - ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ')));
    const group = dto.originalRows[0].groups.find(g => g.title === 'Στοιχεία Σύμβασης');
    assert.equal(group.contractItems[0].contractAmount, '990');
    assert.equal(group.contractItems[0].workTermsAmount, '');
    assert.ok(group.fields.some(f => f.value === '0001 - ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ'));
    const change = dto.changes.find(c => c.field === 'Ειδικότητα Σύμβασης');
    assert.equal(change.before, '0001 - ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ');
    assert.equal(change.after, '0001 - ΑΡΧΙΜΑΓΕΙΡΟΣ');
    const itemChange = dto.changes.find(c => c.field === '0001 - ΑΛΛΟ ΣΤΟΙΧΕΙΟ');
    assert.match(itemChange.before, /ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ.*990/);
    assert.match(itemChange.after, /ΑΛΛΟ ΣΤΟΙΧΕΙΟ.*1\.000/);
    assert.doesNotMatch(JSON.stringify(dto), /Στοιχείο Σύμβασης \d{2}|Ποσό Σύμβασης \d{2}|poso_symbashs|stoixeio_symbashs/);
});

test('actual History details enrichment uses the same parents and never mutates business fields', async () => {
    const { enrichWithCatalogs } = require('../../../test/fixtures/employeeContractDetails');
    const rows = [row, { ...row, symbash: '0001' }], before = structuredClone(rows);
    const enriched = await enrichWithCatalogs(rows, catalogs);
    assert.equal(enriched[0].__lookups.eidikothtesAnaKathgoriaSymbaseon['0001'].perigrafh, 'ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ');
    assert.equal(enriched[1].__lookups.eidikothtesAnaKathgoriaSymbaseon['0001'].perigrafh, 'ΑΡΧΙΜΑΓΕΙΡΟΣ');
    assert.equal(enriched[0].__lookups.stoixeiaSymbaseon['01'].perigrafh, 'ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ');
    assert.equal(enriched[1].__lookups.stoixeiaSymbaseon['01'].perigrafh, 'ΑΛΛΟ ΣΤΟΙΧΕΙΟ');
    assert.deepEqual(rows, before);
    enriched.forEach((value, index) => {
        const { __lookups, ...business } = value;
        assert.deepEqual(business, before[index]);
    });
});

test('contract-item attention uses descriptions and each source parent without technical slot labels', () => {
    const input = F.caseA();
    input.completeHistoryRows.forEach(r => Object.assign(r, row));
    const plan = planEmployeeHistoryAutomaticReconstruction(input);
    const [first, second] = input.completeHistoryRows;
    second.symbash = '0001';
    plan.assumptions.push({ code: 'SAME_DATE_NON_EMPTY_CONFLICT', field: 'stoixeio_symbashs_01',
        selectedSourceHistoryId: first._id, sourceHistoryIds: [first._id, second._id],
        sourceValues: [{ historyId: first._id, value: '0001' }, { historyId: second._id, value: '0001' }] });
    plan.warnings.push({ code: 'HISTORICAL_NON_EMPTY_VALUE_CHANGE', field: 'poso_symbashs_01', sourceHistoryIds: [first._id] });
    const dto = buildEmployeeHistoryReconstructionPreview({ plan, completeHistoryRows: input.completeHistoryRows, catalogs });
    const attention = dto.attention.find(item => item.conflict);
    assert.deepEqual(attention.conflict.values, ['0001 - ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ', '0001 - ΑΛΛΟ ΣΤΟΙΧΕΙΟ']);
    assert.match(attention.field, /0001 - ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ/);
    assert.doesNotMatch(JSON.stringify(dto.attention), /Στοιχείο Σύμβασης \d{2}|Ποσό Σύμβασης \d{2}|stoixeio_symbashs|poso_symbashs/);
    const zero = S.contractItemsForDisplay({ stoixeio_symbashs_15: '0001', poso_symbashs_15: 0,
        poso_symbashs_basei_oron_ergasias_15: 0 }, () => 'ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ', String);
    assert.deepEqual(zero, [{ index: '15', description: '0001 - ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ', contractAmount: '', workTermsAmount: '' }]);
});
