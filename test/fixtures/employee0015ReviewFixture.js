'use strict';
const {fixture}=require('../../server/services/ergazomenoi/fixtures/employee0015HistoryFixture');
const catalogs={KPK_EFKA:[{code:'0101',label:'Συνθετική ασφάλιση'}],CONTRACT_TYPE:[{code:'01',label:'Συνθετική σύμβαση'}],
    CONTRACT_CATEGORY:[{code:'01',label:'Συνθετική κατηγορία',afora_thn_symbash:'01'}],
    CONTRACT_SPECIALTY:[{code:'01',label:'Συνθετική ειδικότητα',afora_thn_symbash_kathgoria:'0101'}]};
const initial={KPK:'0101',SPECIALTY:'01',CONTRACT_TYPE:'01',CONTRACT_CATEGORY:'01',LEGAL_PAY:200,ACTUAL_PAY:250,CONTRACT_PAY:250,
    kathestos_apasxolhshs:'2',typos_apasxolhshs:'2',typos_ebdomadas:'5HMERH',dialleima_se_lepta:0,
    dialleima_entos_ektos_orarioy:false,synexes_diakekomeno:false,typos_orarioy:false,evelikth_proselefsh:0,
    symbatikes_ores_ergasias:40,afora_egkekrimenh_rythmish_ergasias:false,INITIAL_EVIDENCE:'Συνθετική σύμβαση Α1, αρχικοί όροι'};
function data(){const value=fixture();value.scope.company_kod='610000000000000000000001';
    for(const row of [value.currentEmployee,...value.completeHistoryRows,...value.predeclaredScheduleRows])Object.assign(row,value.scope);
    return value;}
function decision(plan){const answer=(conflictId,values)=>({conflictId,intent:'ENTER_DIFFERENT_VALUE',value:'CONFIRMED_FACTS',values});
    return {snapshotFingerprint:plan.snapshotFingerprint,selections:{predeclared_review:{confirmation:{responsibilityAccepted:true,decisions:[
        answer('RECORDED_PERIOD',{VALID_FROM:'2026-05-25',VALID_UNTIL:'2026-05-31',PERIOD_EVIDENCE:'Συνθετικό έγγραφο Β2 με τις περιόδους'}),
        answer('INITIAL_TERMS',{...initial})]}}}};}
module.exports={data,decision,catalogs,initial};
