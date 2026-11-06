'use strict';

// Synthetic identities and amounts only. No database or employee data is read.
const { buildCompleteProfileSnapshot } = require('../../../utils/ergazomenoi/employmentProfileHistory');
const scope = Object.freeze({ team: 'TEST', company_kod: 'synthetic-company', kodikos: '0015' });
const START = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END = 'hmeromhnia_isxyos_oron_ergasias_eos';
function fixture() {
    const row = (n, from, to, days) => ({
        ...buildCompleteProfileSnapshot({ effectiveFrom: from || '2026-04-26' }), ...scope,
        _id: `507f1f77bcf86cd79943910${n}`, aa_eggrafhs: `000${n}`,
        hmeromhnia_proslhpshs: '2026-04-26',
        hmeromhnia_lhxhs_symbashs: '2026-10-31',
        hmeromhnia_allaghs_symbashs: n >= 5 ? '2026-06-22' : n === 4 ? '2026-06-09' : null,
        [START]: from, [END]: to, afora_proslhpsh: n === 1,
        afora_allagh_oron_ergasias: n !== 1,
        hmeres_ergasias_ebdomadas: days, ores_ergasias_ebdomadas: days * 8,
        mo_oron_hmerhsias_ergasias: 8, evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40,
        createdAt: new Date('2026-04-26'), updatedAt: new Date('2026-11-01'),
        history_reference_fence: n
    });
    const rows = [row(1, null, null, 0), row(2, '2026-05-25', '2026-06-08', 4),
        row(3, '2026-05-25', '2026-06-21', 2), row(4, '2026-06-09', '2026-06-21', 3),
        row(5, '2026-06-22', '2026-10-15', 5), row(6, '2026-06-22', '2026-09-15', 5)];
    // The hire anchor does not certify historical pay, insurance or terms.
    rows[0] = { ...scope, _id: rows[0]._id, aa_eggrafhs: '0001', afora_proslhpsh: true,
        hmeromhnia_proslhpshs: '2026-04-26', hmeromhnia_lhxhs_symbashs: '2026-10-31',
        createdAt: rows[0].createdAt, updatedAt: rows[0].updatedAt, history_reference_fence: 1 };
    rows[5].hmeromhnia_apoxorhshs = '2026-09-15';
    const employee = { ...rows[5], _id: '507f1f77bcf86cd799439199', energos: false,
        oristikh_enhmerosh: true, logos_peratosis: '6' };
    const predeclaredScheduleRows = [];
    for (let date = new Date('2026-04-26'); date <= new Date('2026-05-24'); date.setUTCDate(date.getUTCDate() + 1)) {
        const sunday = date.getUTCDay() === 0;
        predeclaredScheduleRows.push({ ...scope, _id: `synthetic-schedule-${date.toISOString().slice(0, 10)}`,
            hmeromhnia: new Date(date), kathgoria_ergasias: sunday ? 'ΕΡΓ' : 'ΜΕ',
            apo_ora_01: sunday ? '10:00' : '', eos_ora_01: sunday ? '18:00' : '' });
    }
    return { scope: { ...scope }, currentEmployee: employee, completeHistoryRows: rows,
        predeclaredScheduleRows,
        protectedReferenceSummary: Object.fromEntries(rows.map(record => [record._id, [{
            collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: `synthetic-frozen-${record.aa_eggrafhs}`,
            historyId: record._id, frozen_snapshot: { finalized: true, amount: 123.45 }
        }]])),
        erganiFacts: [{ kind: 'FIXED_TERM_MUTUAL_TERMINATION', date: '2026-09-15', reason: '6' },
            { kind: 'VOLUNTARY_DEPARTURE', date: '2026-09-15', withdrawn: true }],
        auditEvidence: [{ _id: 'synthetic-existing-audit', operation: 'WITHDRAW_ERRONEOUS_DEPARTURE' }] };
}

// Explicitly hypothetical AFTER state: these additional confirmations are test
// inputs, never facts asserted about the real 0015. In this scenario 0003 is a
// genuine 25/05–31/05 period, followed by 0002 from 01/06–08/06.
function certifiedFixture({ technicalRows = false } = {}) {
    const data=fixture(),originals=data.completeHistoryRows;
    const replacement=(n,source,from,to,days)=>({...source,_id:`507f1f77bcf86cd79943910${n}`,
        aa_eggrafhs:`000${n}`,[START]:from,[END]:to,afora_proslhpsh:from==='2026-04-26',
        afora_allagh_oron_ergasias:true,hmeres_ergasias_ebdomadas:days,ores_ergasias_ebdomadas:days*8,
        mo_oron_hmerhsias_ergasias:8});
    const initial=replacement(7,originals[1],'2026-04-26','2026-05-24',1);
    initial.hmeromhnia_allaghs_symbashs=null;
    const fourDay=replacement(8,originals[1],'2026-06-01','2026-06-08',4);
    const twoDay=replacement(9,originals[2],'2026-05-25','2026-05-31',2);
    const retire=(row,survivor)=>({...row,employment_history_canonical_status:'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id:survivor._id});
    data.completeHistoryRows=[originals[0],retire(originals[1],fourDay),retire(originals[2],twoDay),
        originals[3],retire(originals[4],originals[5]),originals[5],initial,fourDay,twoDay];
    if(technicalRows)for(const n of [10,11])data.completeHistoryRows.push({...scope,
        _id:`507f1f77bcf86cd7994391${n}`,aa_eggrafhs:String(n).padStart(4,'0'),
        hmeromhnia_proslhpshs:'2026-04-26',afora_allagh_oron_ergasias:false,
        hmeromhnia_allaghs_orarioy_apo:'2026-10-01',hmeromhnia_allaghs_orarioy_eos:'2026-10-31'});
    for(const row of data.completeHistoryRows)data.protectedReferenceSummary[row._id] ||= [];
    data.auditEvidence.push({_id:'synthetic-confirmation-audit',operation:'EXPLICIT_HYPOTHETICAL_PERIOD_CONFIRMATION'});
    // A mutable Employee value must not rewrite completed historical pay.
    data.currentEmployee.pragmatikosMisthos=1500;
    return data;
}
module.exports = { fixture, certifiedFixture, scope };
