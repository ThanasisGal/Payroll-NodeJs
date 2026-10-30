'use strict';
const express = require('express');
const path = require('node:path');
const { once } = require('node:events');
const ejs = require('ejs');
const { clone } = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { createEmployeeHistoryReconstructionPreviewController } = require('../../server/controllers/ergazomenoi/employeeHistoryReconstructionPreviewController');
const { createEmployeeHistoryAutomaticSettlementController } = require('../../server/controllers/ergazomenoi/employeeHistoryAutomaticSettlementController');
const { registerEmployeeHistorySettlementRoutes } = require('../../server/routes/employeeHistorySettlementRoutes');
const root=path.resolve(__dirname,'../..');
async function startUnifiedPreviewHarness({ data, failReferences=false, fullForm=false }={}){
    const state=clone(data),counts={employeeReads:0,historyReads:0,referenceReads:0,permissionReads:0,applyRequests:0,selections:[]};
    const query=value=>({select(fields){counts.selections.push(fields);return this;},mongooseOptions(){return this;},lean:async()=>clone(value)});
    const guarded=value=>new Proxy(value,{get(target,key){if(key in target)return target[key];throw Error(`Forbidden synthetic model operation: ${String(key)}`);}});
    const models={employeeModel:guarded({findOne(filter){counts.employeeReads++;return query(String(filter._id)===String(state.currentEmployee._id)?state.currentEmployee:null);}}),
        companyModel:guarded({findOne:()=>query({_id:state.scope.company_kod})}),
        historyModel:guarded({db:Object.freeze({synthetic:true}),find(){counts.historyReads++;return query(state.completeHistoryRows);}}),
        referenceChecker:async({historyIds})=>{counts.referenceReads++;if(failReferences)throw Error('SYNTHETIC_PRIVATE_FAILURE');return clone(state.protectedReferenceSummary[String(historyIds[0])]);},
        loadCatalogs:async()=>({})};
    const app=express();app.use(express.json({limit:'64kb'}));
    app.use((req,res,next)=>{req.session={userId:'630000000000000000000001',userTeam:state.scope.team,companyInUse:state.scope.company_kod};req.authenticatedUserTeam=state.scope.team;next();});
    const read=createEmployeeHistoryReconstructionPreviewController(models);
    const realBoundary=createEmployeeHistoryAutomaticSettlementController();
    const controller={resolve:createEmployeeHistoryReconstructionPreviewController({...models,resolveBusinessDecision:true}),
        apply(req,res){counts.applyRequests++;return realBoundary.apply(req,res);}};
    app.get('/api/ergazomenoi/:id/history-reconstruction-preview',read);
    registerEmployeeHistorySettlementRoutes(app,{controller,checkAuth:(req,res,next)=>next(),
        requireUserPrivilegeAction:()=> (req,res,next)=>{counts.permissionReads++;next();}});
    app.use('/assets',express.static(path.join(root,'public')));
    app.use('/assets', (req,res)=>res.status(404).end());
    app.get('/',async(req,res,next)=>{try{
        const locals={ergazomenoiData:state.currentEmployee,istorikoData:state.completeHistoryRows,
            employeeHistoryAccessMode:'ADMIN_FULL',employeeHistoryStateToken:'synthetic-unified',problematicHistoryIds:[],settlementSyntheticHarness:false};
        let form;
        if(fullForm){const data={...require('./responsiveForms').dataFor('views/ergazomenoi/ergazomenoi/edit.ejs'),...locals};
            form=await ejs.renderFile(path.join(root,'views/ergazomenoi/ergazomenoi/edit.ejs'),data);
        }else form=await ejs.renderFile(path.join(root,'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'),locals);
        res.type('html').send(`<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/assets/css/bootstrap.min.css"><link rel="stylesheet" href="/assets/css/main.css">
        <style>:root{--leftW:0px}body.sidebar-open{--leftW:280px} #syntheticSidebar{position:fixed;left:0;top:0;width:280px;height:100vh;background:#edf0f3;display:none}body.sidebar-open #syntheticSidebar{display:block}main{min-width:0;margin-left:var(--leftW)}</style></head><body data-mode="edit" data-context="ergazomenoi">
        <aside id="syntheticSidebar">Συνθετικό πλευρικό μενού</aside><main class="payroll-form-layout">${form.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')}<button id="independentAction" type="button">Ανεξάρτητη λειτουργία</button></main>
        <script src="/assets/js/bootstrap.bundle.min.js"></script><script src="/assets/js/common/sectionsVisible.js"></script><script src="/assets/js/common/formLayout.js"></script><script src="/assets/js/ergazomenoi/genika/employeeHistoryGuidedResolution.js"></script>
        <script src="/assets/js/ergazomenoi/genika/employeeHistoryAutomaticSettlementPreview.js"></script><script src="/assets/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js"></script>
        <script>document.addEventListener('DOMContentLoaded',()=>{const shell=document.querySelector('.employee-edit-page');if(shell){shell.dataset.employeeFormState='ready';shell.dataset.employeeFormVisible='true';shell.setAttribute('aria-busy','false');shell.querySelectorAll('[inert]').forEach(node=>node.inert=false);document.querySelector('.menu_Links li[data-tab-caption="Ιστορικό"]').click();document.querySelectorAll('.tab-content,.tab-panel').forEach(node=>{if(node.querySelector('#employeeHistoryReconstructionPreviewBtn'))node.style.display='block';});}document.getElementById('independentAction').addEventListener('click',()=>window.independentContinued=true);});</script></body></html>`);
    }catch(error){next(error);}});
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');
    const origin=`http://127.0.0.1:${server.address().port}`,prefix=`${origin}/api/ergazomenoi/${state.currentEmployee._id}`;
    return {origin,state,counts,preview:()=>fetch(`${prefix}/history-reconstruction-preview?presentation=settlement`),
        resolve:businessDecision=>fetch(`${prefix}/history-automatic-settlement-resolve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessDecision})}),
        apply:body=>fetch(`${prefix}/history-automatic-settlement-apply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
        close:()=>new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();})};
}
module.exports={startUnifiedPreviewHarness};
