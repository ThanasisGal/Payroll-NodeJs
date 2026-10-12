'use strict';
// Isolated form adapter: real controllers, templates, serializers, authorization
// and Mongo transactions; synthetic sessions only, no app.js jobs or external APIs.
const express = require('express');
const path = require('path');
const ejs = require('ejs');
const root = path.resolve(__dirname,'../..');
const controller = require('../../server/controllers/ergazomenoi/ergazomenoiController');
const { requireUserPrivilegeAction } = require('../../server/middlewares/requireUserPrivilegeForm');
const S = require('../../server/utils/ergazomenoi/employeeSaveState');
const requireFinalizedEmployee = require('../../server/middlewares/requireFinalizedEmployee');
const shared = ['utils/miscProgs','ergazomenoi/genika/employmentProfileUi','ergazomenoi/genika/employeeDraftSave'];
const required = new Set([...shared,'ergazomenoi/genika/getFieldValues','ergazomenoi/genika/putFieldValues',
    'ergazomenoi/genika/date_sync_edit','ergazomenoi/genika/date_sync_add',
    'ergazomenoi/genika/selectRepo','ergazomenoi/genika/getDaysFromDate','ergazomenoi/genika/dailyRestValidation','ergazomenoi/genika/erganiRestSubmissionUi']);
function browserApp({session}) {
    const app=express();app.use(express.json({limit:'12mb'}));
    app.use('/static',express.static(path.join(root,'public')));
    app.use('/vendor',express.static(path.join(root,'node_modules')));
    app.set('views',path.join(root,'views'));app.set('view engine','ejs');
    app.engine('ejs',(file,options,done)=>ejs.renderFile(file,{...options,
        script:name=>'/static/js/'+name+'.js',css:name=>'/static/css/'+name+'.css',
        userRole:'HR',nonce:'isolated-test',csrfToken:'isolated-test',CONFIG:{EGGRAFES:20},NODE_ENV:'development',nodeEnv:'development',isDevelopment:true,isProduction:false
    },(error,html)=>{
        if(error)return done(error);
        html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>{
            const src=/src="([^\"]+)"/.exec(tag)?.[1];
            const name=src?.replace('/static/js/','').replace(/\.js$/,'');
            return required.has(name)?tag:'';
        });
        const extra=shared.filter(name=>!html.includes('/static/js/'+name+'.js')).map(name=>`<script src="/static/js/${name}.js"></script>`).join('');
        done(null,`<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="csrf-token" content="isolated-test"><link rel="stylesheet" href="/static/css/bootstrap.min.css"><link rel="stylesheet" href="/static/css/main.css"><script src="/vendor/jquery/dist/jquery.js"></script><script src="/static/js/bootstrap.bundle.min.js"></script><script src="/vendor/sweetalert2/dist/sweetalert2.all.js"></script><script src="/vendor/mathjs/lib/browser/math.js"></script></head><body>${extra}${html}</body></html>`);
    }));
    app.use((req,res,next)=>{req.session=session;res.locals.companyInUse=session.companyInUse;res.locals.userTeam=session.userTeam;res.locals.userRole='HR';res.locals.nonce='isolated-test';res.locals.csrfToken='isolated-test';next();});
    app.get('/ergazomenoi/ergazomenoi/add',controller.addErgazomenoiForm);
    app.get('/ergazomenoi/ergazomenoi/edit/:id',controller.editErgazomenoiForm);
    app.post('/ergazomenoi/ergazomenoi/add',requireUserPrivilegeAction('Ergazomenoi','create'),controller.postErgazomenoiForm);
    app.post('/api/ergazomenoi/update/:ergazomenoiId',requireUserPrivilegeAction('Ergazomenoi','update'),controller.postErgazomenoiUpdate);
    app.post('/test/operational',requireFinalizedEmployee,(req,res)=>res.json({success:true}));
    const general = require('../../server/controllers/genikaAPIsController');
    app.post('/api/checkArgies',general.checkArgies);
    app.post('/api/dateDifference',general.dateDifference);
    app.post('/api/getProdhlomenaOraria',general.getProdhlomenaOraria);
    app.get('/api/get-end-date',(req,res)=>res.json({endDate:'2026-10-31'}));
    app.use((error,req,res,next)=>{if(S.sendEmployeeSaveStateError(res,error))return;console.error(error);res.status(500).json({success:false,errorMessage:error.message});});
    return app;
}
module.exports={browserApp};
