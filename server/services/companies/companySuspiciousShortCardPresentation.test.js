'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CompaniesModel = require('../../models/companies').CompaniesModel;
const { normalizeCompanyUpdatePayload } = require('./companyUpdateNormalization');

const root = path.resolve(__dirname, '../../..');
const addView = fs.readFileSync(path.join(root,
    'views/companies/genikastoixeia/partials/add/cardBodies/diafora.ejs'), 'utf8');
const editView = fs.readFileSync(path.join(root,
    'views/companies/genikastoixeia/partials/edit/cardBodies/diafora.ejs'), 'utf8');

test('company model defaults and edit normalization preserve suspicious-short settings', () => {
    const defaults = new CompaniesModel().toObject();
    assert.equal(defaults.elegxos_ypopta_mikron_diastimaton_kartas, false);
    assert.equal(defaults.poly_mikro_diastima_kartas_eos_lepta, 5);
    assert.equal(defaults.mikro_diastima_kartas_eos_lepta, 60);
    assert.equal(defaults.mikro_diastima_kartas_max_pososto_programmatos, 25);
    assert.equal(defaults
        .mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta, 60);
    const normalized = normalizeCompanyUpdatePayload({
        selectedUsers: ['507f191e810c19729de860ea'],
        elegxos_ypopta_mikron_diastimaton_kartas: true,
        poly_mikro_diastima_kartas_eos_lepta: '4',
        mikro_diastima_kartas_eos_lepta: '50',
        mikro_diastima_kartas_max_pososto_programmatos: '20',
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: '75'
    });
    assert.equal(normalized.company.elegxos_ypopta_mikron_diastimaton_kartas, true);
    assert.equal(normalized.company.poly_mikro_diastima_kartas_eos_lepta, 4);
    assert.equal(normalized.company.mikro_diastima_kartas_eos_lepta, 50);
    assert.equal(normalized.company.mikro_diastima_kartas_max_pososto_programmatos, 20);
    assert.equal(normalized.company
        .mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta, 75);
});

test('add/edit presentation contains exact Greek labels, help and safe bounds', () => {
    for (const source of [addView, editView]) {
        for (const label of [
            'Έλεγχος ύποπτα μικρών διαστημάτων κάρτας',
            'Πολύ μικρό διάστημα έως (λεπτά)',
            'Μικρό διάστημα έως (λεπτά)',
            'Μέγιστο ποσοστό του προδηλωμένου ωραρίου (%)',
            'Ελάχιστος χρόνος που λείπει από το προδηλωμένο ωράριο (λεπτά)',
            'Πόσος χρόνος πρέπει να λείπει από τις κάρτες σε σχέση με το προδηλωμένο ωράριο για να ζητηθεί έλεγχος.'
        ]) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.doesNotMatch(source, /ελάχιστο ακάλυπτο/i);
        assert.match(source, /max="<%= field\.includes\('pososto'\) \? 100 : 1440 %>"/);
    }
});
