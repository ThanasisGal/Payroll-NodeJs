'use strict';
// All values, catalog entries and employee records in these probes are synthetic.
const R = require('../../server/utils/ergazomenoi/historicalProfileComparison');
const P = require('../../server/utils/ergazomenoi/employmentProfileContract');
const F = require('./employeeHistoryResolvedProposal');
const { harness } = require('./employeeGeneralHistoryFormHarness');
const date = '2026-12-01';
const six = { hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',
    ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:6.67 };
const thirty = { ores_ergasias_ebdomadas:30,mo_oron_hmerhsias_ergasias:6 };
const arrangement = { [P.ENABLED]:true,[P.TYPE]:'OTHER_APPROVED_ARRANGEMENT',
    [P.FROM]:date,[P.UNTIL]:'2026-12-31',[P.START]:'12:00',[P.END]:'12:30',
    [P.DAYS]:[1,3,5],[P.CATEGORY]:'01' };
const intervals = Object.fromEntries(P.BREAK_PAIRS.flatMap(([from,until],i)=>
    [[from,['12:00','14:00','16:00'][i]],[until,['12:10','14:10','16:10'][i]]]));
function changeFor(entry,current) {
    const field = entry.field;
    if (['hmeres_ergasias_ebdomadas','typos_ebdomadas'].includes(field)) return {...six};
    if (['ores_ergasias_ebdomadas','mo_oron_hmerhsias_ergasias'].includes(field)) return {...thirty};
    if (['kathestos_apasxolhshs','typos_apasxolhshs'].includes(field))
        return {kathestos_apasxolhshs:'1',typos_apasxolhshs:'1'};
    if (['symbash','kathgoria_symbashs','eidikothta_symbashs'].includes(field))
        return {symbash:'02',kathgoria_symbashs:'02',eidikothta_symbashs:'02'};
    if (P.ARRANGEMENT_FIELDS.includes(field)) return {...arrangement};
    if (P.BREAK_PAIRS.flat().includes(field)) return {...intervals};
    if (field === 'eidikh_kathgoria_ergazomenoy')
        return {[field]:'0004',dialleima_entos_ektos_orarioy:true};
    if (field === 'dialleima_se_lepta') return {[field]:15};
    if (field.startsWith('krathsh_')) return {[field]:'0102'};
    if (field.startsWith('stoixeio_symbashs_')) return {[field]:'BONUS'};
    if (entry.type === 'Boolean') return {[field]:!current[field]};
    if (entry.type === 'Number') return {[field]:Number(current[field] || 0)+1};
    throw Error('UNMAPPED_SYNTHETIC_CASE:'+field);
}
function formChanges(changes) {
    const result = {...changes,hmeromhnia_metabolhs:date};
    for (const [field,value] of Object.entries(changes)) {
        for (const alias of R.byField.get(field)?.formAliases || []) result[alias]=value;
        if (field.startsWith('stoixeio_symbashs_')) result[field+'_hidden']=value;
    }
    if (changes.hmeres_ergasias_ebdomadas) {
        result.apasxolhsh_basei_symbashs=result.apasxolhsh_basei_symbashs_stathera=String(changes.hmeres_ergasias_ebdomadas);
    }
    return result;
}
async function createHarness(options={}) {
    const h=await harness({approveCurrent:true,approvedTerms:{eidikothta_symbashs:'01'},...options});
    const catalogs = structuredClone(F.catalogs);
    catalogs.KPK_EFKA.push({code:'0102',label:'Συνθετικό δεύτερο πακέτο'});
    catalogs.CONTRACT_TYPE.push({code:'02',label:'Συνθετική δεύτερη σύμβαση'});
    catalogs.CONTRACT_CATEGORY.push({code:'02',label:'Συνθετική δεύτερη κατηγορία',afora_thn_symbash:'02'});
    catalogs.CONTRACT_SPECIALTY.push({code:'02',label:'Συνθετική δεύτερη ειδικότητα',afora_thn_symbash_kathgoria:'0202'});
    catalogs.CONTRACT_ITEM.push({code:'BONUS',label:'Συνθετικό επίδομα',afora_thn_symbash_kathgoria_eidikothta:'010101'});
    h.deps.correctionCatalogLoader=async()=>catalogs;
    return h;
}
function payload(h,changes) {
    return {...h.payload(formChanges(changes)),change:{kind:'NEW_CHANGE',effectiveFrom:date,correctedTerms:changes}};
}
async function confirm(h,body,preview) {
    return h.submit({...body,historyPreflight:false,historyDecision:preview.body.decision,
        historyConfirmation:preview.body.historyConfirmation});
}
module.exports={ date,six,thirty,arrangement,intervals,changeFor,formChanges,createHarness,payload,confirm };
