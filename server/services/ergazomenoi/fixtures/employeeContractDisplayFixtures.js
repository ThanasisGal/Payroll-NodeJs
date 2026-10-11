'use strict';
const S = require('../employeeContractDescriptionService');
const row = { symbash: '0002', kathgoria_symbashs: '0003', eidikothta_symbashs: '0001',
    stoixeio_symbashs_01: '0001', poso_symbashs_01: 990, poso_symbashs_basei_oron_ergasias_01: 0,
    stoixeio_symbashs_02: '0007', poso_symbashs_02: 0, poso_symbashs_basei_oron_ergasias_02: 99 };
const data = {
    CONTRACT_TYPE: [{ kodikos: '0002', perigrafh: 'ΞΕΝΟΔΟΧΕΙΑ' }],
    CONTRACT_CATEGORY: [
        { kodikos: '0003', perigrafh: 'ΑΛΛΗ ΚΑΤΗΓΟΡΙΑ', afora_thn_symbash: '0001' },
        { kodikos: '0003', perigrafh: 'ΚΑΤΗΓΟΡΙΑ Γ ' + 'Περιγραφή '.repeat(35), afora_thn_symbash: '0002' }],
    CONTRACT_SPECIALTY: [
        { kodikos: '0001', perigrafh: 'ΑΡΧΙΜΑΓΕΙΡΟΣ', afora_thn_symbash_kathgoria: '00010003' },
        { kodikos: '0001', perigrafh: 'ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ', afora_thn_symbash_kathgoria: '00020003' },
        { kodikos: '0001', perigrafh: 'ΠΛΥΝΤΡΙΑ', afora_thn_symbash_kathgoria: '00020004' }],
    CONTRACT_ITEM: [
        { kodikos: '0001', perigrafh: 'ΑΛΛΟ ΣΤΟΙΧΕΙΟ', afora_thn_symbash_kathgoria_eidikothta: '000100030001' },
        { kodikos: '0001', perigrafh: 'ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ', afora_thn_symbash_kathgoria_eidikothta: '000200030001' },
        { kodikos: '0001', perigrafh: 'ΑΛΛΟ ΣΤΟΙΧΕΙΟ ΕΙΔΙΚΟΤΗΤΑΣ', afora_thn_symbash_kathgoria_eidikothta: '000200030002' },
        { kodikos: '0007', perigrafh: 'ΕΠΙΔΟΜΑ ΕΠΟΧΙΑΚΗΣ ΑΠΑΣΧΟΛΗΣΗΣ', afora_thn_symbash_kathgoria_eidikothta: '000200030001' }]
};
const catalogs = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, S.contractDescriptionCatalog(rows, name)]));
module.exports = { row, catalogs, data };
