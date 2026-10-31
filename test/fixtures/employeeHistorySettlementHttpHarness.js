'use strict';
const express = require('express');
const path = require('node:path');
const { once } = require('node:events');
const { createSyntheticSettlementStore } = require('./employeeHistorySettlementSyntheticStore');
const { createEmployeeHistoryAutomaticSettlementController: create } = require('../../server/controllers/ergazomenoi/employeeHistoryAutomaticSettlementController');
const { registerEmployeeHistorySettlementRoutes } = require('../../server/routes/employeeHistorySettlementRoutes');
const checkAuth = require('../../server/middlewares/checkValidUser');
const ACTOR = { _id: '700000000000000000000001', privileges: 'A', team: 'THA', situation: 'A' };

async function startSettlementHarness(options = {}) {
    const actor = options.actor === undefined ? { ...ACTOR } : options.actor;
    const permission = options.permission || { update: true };
    const db = createSyntheticSettlementStore({ ...options, actor, permission, ...(options.realHttp ? { executionMode: 'CONTROLLED_DEV' } : {}) });
    const initial = db.approvalInput(ACTOR._id);
    const realHttp = options.realHttp ? require('../../server/controllers/ergazomenoi/employeeHistorySettlementHttpController')
        .createEmployeeHistorySettlementHttpController({ contextProvider: () => db.handle,
            readSessionProvider: () => { const state = db.state(); return { draft: state, syntheticActor: { ...actor },
                syntheticPermission: { ...permission }, syntheticReferences: state.references }; } }) : null;
    const controller = realHttp ? { preview: realHttp.preview, resolve: realHttp.preview, apply: realHttp.apply } : options.coordinated ? require('../../server/controllers/ergazomenoi/employeeHistoryAutomaticSettlementSyntheticController')
        .createEmployeeHistoryAutomaticSettlementSyntheticController({ syntheticStore: db.handle, coordinated: true })
        : create({ syntheticStore: db.handle });
    const app = express();
    app.use(express.json({ limit: '16kb' }));
    const requests = [];
    const session = { userId: ACTOR._id, userTeam: initial.scope.team, companyInUse: initial.scope.company_kod };
    // Test-owned identity, never read from headers, request bodies or query strings.
    app.use((req, res, next) => { req.session = session; next(); });
    app.get('/api/ergazomenoi/:id/history-reconstruction-preview', controller.preview);
    app.use('/api/ergazomenoi/:id/history-automatic-settlement-apply', (req, res, next) => {
        requests.push(structuredClone(req.body));
        next();
    });
    registerEmployeeHistorySettlementRoutes(app, { controller, checkAuth,
        // Real rights are checked by the existing synthetic controller and writer
        // against the fixture's user repository on every call and transaction.
        requireUserPrivilegeAction: () => (req, res, next) => next() });
    const root = path.resolve(__dirname, '../..');
    app.use('/assets', express.static(path.join(root, 'public')));
    app.set('view engine', 'ejs');
    const locals = () => ({
        settlementSyntheticHarness: !options.realHttp,
        ergazomenoiData: db.state().employees[0], istorikoData: db.state().history,
        employeeHistoryAccessMode: 'ADMIN_FULL', employeeHistoryStateToken: 'synthetic', problematicHistoryIds: [] });
    app.get('/', async (req, res, next) => {
        if (!options.fullForm) return res.render(path.join(__dirname, 'employeeHistorySettlementHarness.ejs'), locals());
        try {
            const ejs = require('ejs');
            const data = { ...require('./responsiveForms').dataFor('views/ergazomenoi/ergazomenoi/edit.ejs'), ...locals() };
            const form = await ejs.renderFile(path.join(root, 'views/ergazomenoi/ergazomenoi/edit.ejs'), data);
            const sidebar = await ejs.renderFile(path.join(root, 'views/partials/sidebar.ejs'), data);
            res.type('html').send(`<!doctype html><html lang="el"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="/assets/css/bootstrap.min.css"><link rel="stylesheet" href="/assets/css/main.css">
                <style>:root { --leftW: 0px; } #sidebarMenu { display:none; }
                body.sidebar-open { --leftW:280px; } body.sidebar-open #sidebarMenu {
                    display:block; position:fixed; left:0; top:0; width:280px; height:100vh; overflow:auto; }</style></head>
                <body data-mode="edit" data-context="ergazomenoi">${sidebar}<main class="payroll-form-layout">
                ${form.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')}
                <button type="button" id="independentAction">Ανεξάρτητη λειτουργία</button></main>
                <script src="/assets/js/bootstrap.bundle.min.js"></script>
                <script src="/assets/js/common/sectionsVisible.js"></script>
                <script src="/assets/js/common/formLayout.js"></script>
                <script src="/assets/js/ergazomenoi/genika/employeeHistoryAutomaticSettlementPreview.js"></script>
                <script src="/assets/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js"></script>
                <script>document.addEventListener('DOMContentLoaded', () => {
                    const shell = document.querySelector('.employee-edit-page');
                    shell.dataset.employeeFormState = 'ready'; shell.dataset.employeeFormVisible = 'true';
                    shell.setAttribute('aria-busy', 'false'); shell.querySelectorAll('[inert]').forEach(node => node.inert = false);
                    document.querySelector('.menu_Links li[data-tab-caption="Ιστορικό"]').click();
                    document.getElementById('independentAction').addEventListener('click', () => window.independentContinued = true);
                });</script></body></html>`);
        } catch (error) { next(error); }
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const prefix = `${origin}/api/ergazomenoi/${initial.employeeId}`;
    return { db, actor, permission, session, origin, initial, requests,
        preview: () => fetch(`${prefix}/history-reconstruction-preview?presentation=settlement`),
        resolve: businessDecision => fetch(`${prefix}/history-automatic-settlement-resolve`, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessDecision }) }),
        apply: body => fetch(`${prefix}/history-automatic-settlement-apply`, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}
module.exports = { startSettlementHarness, ACTOR };
