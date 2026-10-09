'use strict';

// Entirely synthetic: these factories never read a database or real employee.
const scope = Object.freeze({ team: 'TEST', company_kod: 'synthetic-company', kodikos: 'synthetic-employee' });
const workTerms = Object.freeze({ hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 });

function row(identity, extra = {}) {
    return { _id: `synthetic-${identity}`, aa_eggrafhs: identity, ...scope,
        hmeromhnia_allaghs_orarioy_apo: '2031-01-01',
        hmeromhnia_allaghs_orarioy_eos: '2020-01-01', ...extra };
}
function caseA() {
    return { scope, currentEmployee: { _id: 'synthetic-current', ...scope,
        hmeromhnia_proslhpshs: '2026-04-24', hmeromhnia_lhxhs_symbashs: '2026-10-05' },
    completeHistoryRows: [
        row('0001', { afora_proslhpsh: true, hmeromhnia_proslhpshs: '2026-04-24',
            hmeromhnia_allaghs_symbashs: '2026-04-24',
            hmeromhnia_isxyos_oron_ergasias_apo: null, hmeromhnia_isxyos_oron_ergasias_eos: null,
            hmeres_ergasias_ebdomadas: null, ores_ergasias_ebdomadas: null, mo_oron_hmerhsias_ergasias: null }),
        row('0002', { hmeromhnia_proslhpshs: '2026-04-24', ...workTerms,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25', hmeromhnia_lhxhs_symbashs: '2026-10-05' })
    ] };
}
function caseB() {
    return { scope, currentEmployee: { _id: 'synthetic-current', ...scope,
        hmeromhnia_proslhpshs: '2026-04-23' }, completeHistoryRows: [
        row('0002', { afora_proslhpsh: true, hmeromhnia_proslhpshs: '2026-04-23' }),
        row('0001', { hmeromhnia_allaghs_symbashs: '2026-04-23', hmeromhnia_lhxhs_symbashs: '2026-10-15' }),
        row('0003', { hmeromhnia_allaghs_symbashs: '2026-05-17', ...workTerms })
    ] };
}

module.exports = { scope, workTerms, row, caseA, caseB };
