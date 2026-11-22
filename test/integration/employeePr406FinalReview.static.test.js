'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
test('EFKA sensitive partial is never included under an unauthorized pending context',()=>{
    const html=read('views/ergazomenoi/ergazomenoi/edit.ejs');
    assert.match(html,/<% if \(canSeePendingWithholdings\) \{ %>[\s\S]*?include\('\.\/partials\/edit\/cardBodies\/section1\/accordion\/efka'\)[\s\S]*?<% \} else \{ %>/);
    assert.match(html,/include\('\.\/partials\/edit\/cardBodies\/section1\/accordion\/stoixeiaApasxolhshs', \{ canSeePendingWithholdings \}\)/);
    assert.match(html,/kpk_efka_hidden\" value=\"<%= canSeePendingWithholdings/);
});
test('history display does not overwrite physical editor model and does not manufacture CLEAN',()=>{
    const controller=read('server/controllers/ergazomenoi/ergazomenoiController.js');
    assert.match(controller,/verifiedEmployeeHistoryDisplay/);
    assert.match(controller,/istorikoData = await enrichIstorikoRowsForDetails\(sortHistoryForPresentation\(persistedIstorikoData\)\)/);
    assert.match(controller,/historyDisplay\.hasAtomic && !historyDisplay\.verified/);
    assert.match(controller,/verifiedHistoryEffectiveEnds:historyDisplay\.boundaryEnds/);
    const table=read('views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs');
    assert.match(table,/Επαληθευμένη λογική λήξη βάσει audit/);
    assert.match(table,/data-record='<%- escapeDataAttrJson\(row\) %>'/);
});
test('NEW_CHANGE with verified approved predecessor never physically updates it',()=>{
    const service=read('server/services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService.js');
    assert.match(service,/request\.kind !== 'NEW_CHANGE' && targetApproval/);
    assert.match(service,/approvedEdition:plan\.approvedEdition/);
    assert.match(service,/if \(plan\.targetPatch\) \{/);
    assert.match(read('server/services/ergazomenoi/employeeHistoryProposalReadService.js'),/verifiedApprovals:decisions/);
});
