'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../../../..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const save = read('public/js/ergazomenoi/genika/putFieldValues.js');
const view = read('views/ergazomenoi/ergazomenoi/edit.ejs');
const route = read('server/routes/employeeHistorySettlementRoutes.js');
const controller = read('server/controllers/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceController.js');
const helper = read('public/js/ergazomenoi/genika/employeeApprovedHistoryAtomicSaveUi.js');

test('real Save intercept is earlier than the legacy POST / documents / ERGANI',()=>{
    const entry=save.indexOf('const atomicHistorySave = await window.employeeApprovedHistoryAtomicSaveUi.tryHandle(');
    const legacy=save.indexOf('const retryEmployeeSave = retryPayload => fetch(');
    const contract=save.indexOf('const createContract = result.value?.create_contract === true;');
    assert.ok(entry>0 && legacy>entry && contract>entry,'atomic Save must intercept once before existing flow');
    assert.equal(save.split('const atomicHistorySave = await window.employeeApprovedHistoryAtomicSaveUi.tryHandle(').length-1,1);
    assert.match(save,/if \(atomicHistorySave\?\.handled\) return;/);
});
test('no duplicate Save click handler is introduced',()=>{
    assert.equal(save.split("button.addEventListener('click', handleFormSubmitOnce)").length-1,1);
    assert.doesNotMatch(helper,/addEventListener\s*\(\s*['"]click['"]/);
    assert.doesNotMatch(helper,/\/api\/ergazomenoi\/update\//);
});
test('new script and persisted baseline are rendered before the existing Save script',()=>{
    const before=view.indexOf("<script src=\"<%= script('ergazomenoi/genika/employeeApprovedHistoryAtomicSaveUi') %>\"></script>");
    const after=view.indexOf("<script src=\"<%= script('ergazomenoi/genika/putFieldValues') %>\"></script>");
    assert.ok(before>=0 && after>before);
    for (const key of ['data-atomic-days','data-atomic-week','data-atomic-hours','data-atomic-daily'])
        assert.ok(view.includes(key),key);
});
test('context route is registered once, server-owned and POST-only',()=>{
    assert.equal(route.split("router.post('/api/ergazomenoi/:id/history-approved-maintenance-context'").length-1,1);
    assert.doesNotMatch(route,/router\.get\('\/api\/ergazomenoi\/:id\/history-approved-maintenance-context'/);
    assert.match(controller,/operation === 'context'/);
    assert.match(controller,/exactly\(body,\[\]\)/);
    assert.ok(controller.indexOf('if (!service.isEnabled())') < controller.indexOf('const body = req.body'));
});
