'use strict';
const {buildCompleteProfileSnapshot}=require('../../server/utils/ergazomenoi/employmentProfileHistory');
function employeeActiveHistoryFixture(code='0031') {
 const scope={team:'TEST',company_kod:'610000000000000000000001',kodikos:code};
 const source={...scope,_id:'507f1f77bcf86cd799439199',hmeromhnia_proslhpshs:'2026-04-01',hmeromhnia_allaghs_symbashs:'2026-04-01',hmeromhnia_lhxhs_symbashs:'2026-10-31',
 hmeres_ergasias_ebdomadas:5,ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:8,kathestos_apasxolhshs:'0',typos_apasxolhshs:'0',typos_ebdomadas:'5HMERH',
 krathsh_01:'0101',symbash:'01',kathgoria_symbashs:'01',eidikothta_symbashs:'01',nomimosMisthos:1200,pragmatikosMisthos:1300,synolo_symbashs:1300,
 evelikth_proselefsh:0,symbatikes_ores_ergasias:40,dialleima_se_lepta:0,energos:true,oristikh_enhmerosh:true};
 const row={...buildCompleteProfileSnapshot({current:source,effectiveFrom:'2026-04-01'}),...scope,_id:'507f1f77bcf86cd799439101',aa_eggrafhs:'0001',afora_proslhpsh:true,createdAt:new Date('2026-04-01'),updatedAt:new Date('2026-04-01')};
 return {scope,employee:{...source,...row,_id:source._id},history:[row]};
}
module.exports={employeeActiveHistoryFixture};
