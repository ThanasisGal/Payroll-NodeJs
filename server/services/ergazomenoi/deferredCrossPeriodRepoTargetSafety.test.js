'use strict';
const assert = require('assert');
const { analyzeDeferredCrossPeriodRepoTransfer } = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const { assessAnalysis, REQUIREMENT_STATUS } = require('./deferredCrossPeriodRepoAuthoritativeService');

function rows() {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date('2026-04-27T00:00:00Z'); date.setUTCDate(date.getUTCDate() + index);
        return { _id: `r${index}`, team: 'T', company_kod: 'C', kodikos: '1',
            hmeromhnia: date.toISOString().slice(0, 10), kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: 8, apo_ora_01: '09:00', eos_ora_01: '17:00',
            cards_ores_ergasias: 8, cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' };
    });
}
function analyze(mutator) {
    const week = rows(); Object.assign(week[3], { kathgoria_ergasias: 'ΑΝ' });
    Object.assign(week[4], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
    Object.assign(week[6], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0,
        cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
    mutator?.(week[4]);
    return analyzeDeferredCrossPeriodRepoTransfer({ weekRows: week,
        employmentProfile: { typos_apasxolhshs: 'PLHRHS', hmeres_ergasias_ebdomadas: 5 } });
}
const valid = analyze();
assert.equal(valid.target.prodhlomena_oraria_id, 'r4');
const worked = analyze(row => { row.ores_pragmatikhs_ergasias_apologistika = 2;
    row.apo_ora_01_apologistika = '12:00'; row.eos_ora_01_apologistika = '14:00'; });
assert.equal((worked.semantic_proposal?.selectable_target_candidates || []).length, 0);
const card = analyze(row => { row.cards_apo_ora_01 = '09:00'; row.cards_eos_ora_01 = '10:00'; });
assert.equal((card.semantic_proposal?.selectable_target_candidates || []).length, 0);
const orphan = analyze(row => { row.cards_apo_ora_01 = '09:00'; });
assert.equal((orphan.semantic_proposal?.selectable_target_candidates || []).length, 0);
const noRest = assessAnalysis(worked);
assert.equal(noRest.requirement_status, REQUIREMENT_STATUS.NO_VALID_REST_DAY);
console.log('deferred cross-period valid target safety tests passed');
