'use strict';

const assert = require('node:assert/strict');
const { materializeSourceValues, materializeTargetValues } =
    require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');

const source = {
    kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, cards_ores_ergasias: 9.6,
    cards_apo_ora_01: '12:59', cards_eos_ora_01: '22:35'
};
const target = {
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    apo_ora_01: '12:00', eos_ora_01: '20:00', cards_ores_ergasias: 0
};

const flexible120 = materializeSourceValues(source, target, { evelikth_proselefsh: 120 });
assert.equal(flexible120.proposedValues.apologistiko_biblio, false);
assert.equal(flexible120.proposedValues.apo_ora_01_apologistika, '12:59');
assert.equal(flexible120.proposedValues.eos_ora_01_apologistika, '20:59');
assert.notEqual(flexible120.proposedValues.eos_ora_01_apologistika, '22:35');
assert.equal(materializeSourceValues(source, target, { evelikth_proselefsh: 59 })
    .proposedValues.apologistiko_biblio, false);
assert.equal(materializeSourceValues(source, target, { evelikth_proselefsh: 58 })
    .proposedValues.apologistiko_biblio, true);

const targetValues = materializeTargetValues('ΑΝ');
assert.equal(targetValues.repo_apologistika, true);
assert.equal(targetValues.apologistiko_biblio, true);
assert.equal(targetValues.ores_ergasias_apologistika, 0);
assert.equal(targetValues.ores_pragmatikhs_ergasias_apologistika, 0);
assert.equal(targetValues.apo_ora_01_apologistika, '');
assert.equal(targetValues.eos_ora_01_apologistika, '');

console.log('weekly repo-transfer book materialization tests passed');
