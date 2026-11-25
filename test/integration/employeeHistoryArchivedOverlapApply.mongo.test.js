'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { once } = require('node:events');
const path = require('node:path');
const { chromium } = require('playwright');
const mongoose = require('mongoose');
const { startApprovedProposalMongo, seedApprovedProposal } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const State = require('../../server/services/ergazomenoi/employeeHistoryArchiveStateService');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;

async function httpHarness(db, f) {
    const express = require('express'), app = express();
    app.set('view engine', 'ejs'); app.set('views', path.resolve(__dirname, '../../views'));
    app.use(express.json()); app.use(require('cookie-parser')());
    const csrf = require('../../server/middlewares/simpleCsrfToken').createSimpleCsrfToken();
    app.use(csrf.exposeToken); app.get('/csrf-token', csrf.tokenEndpoint);
    app.use((req, res, next) => {
        req.session = f.req.session; req.sessionID = f.req.sessionID;
        if (req.method === 'POST' && !csrf.validateToken(req)) return res.sendStatus(403);
        next();
    });
    app.use('/static', express.static(path.resolve(__dirname, '../../public')));
    const state = async () => require('../../server/services/ergazomenoi/employeeHistoryMaintenanceApprovalService')
        .loadMaintenanceApprovalInput(await f.input(), db.auditModel);
    const archive = require('../../server/services/ergazomenoi/employeeHistoryArchiveService').createEmployeeHistoryArchiveService(db);
    const approved = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService')
        .createEmployeeHistoryApprovedProposalService(f.dependencies);
    const logs = [];
    const render = async (req, res, next) => {
        try { await E.respondEmployeeHistoryProposal(req, res, await state(), f.catalogs, {
            loadSources: async () => ({ deductions: [], categories: [], types: [] }), archiveAccess: archive.editorAccess,
            loadImportProtection: input => require('../../server/services/ergazomenoi/employeeHistoryProposalImportProtectionService')
                .readImportProtection(input, f.dependencies) }); }
        catch (error) { next(error); }
    };
    require('../../server/routes/employeeHistorySettlementRoutes').registerEmployeeHistorySettlementRoutes(app, {
        checkAuth: (req, res, next) => next(), requireUserPrivilegeAction: () => (req, res, next) => next(),
        controller: { exportXlsx: render, resolve: render, apply: (req, res) => res.sendStatus(403) },
        archiveController: require('../../server/controllers/ergazomenoi/employeeHistoryArchiveController')
            .createEmployeeHistoryArchiveController({ service: archive }),
        approvedProposalController: require('../../server/controllers/ergazomenoi/employeeHistoryApprovedProposalController')
            .createEmployeeHistoryApprovedProposalController({ service: approved, logger: { error(event, detail) { logs.push({ event, ...detail }); } } })
    });
    app.use((error, req, res, next) => res.status(500).json({ success: false, code: error.code || error.name }));
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    return { origin: `http://127.0.0.1:${server.address().port}`, state, logs,
        close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

test('Δύο επικαλύψεις → αρχειοθέτηση 0002 → XLSX τεσσάρων πεδίων → πραγματικό Editor Apply/Reconcile',
    { skip: !binary, timeout: 120000 }, async t => {
    assert.equal(mongoose.connection.readyState, 0);
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    const f = await seedApprovedProposal(db, { employeeCode: '0031' });
    // Only synthetic sources. Two genuine recorded periods overlap; the first
    // remains physically open and has no recorded arrangement Boolean.
    await db.historyModel.collection.deleteOne({ _id: f.history[2]._id });
    f.history = f.history.slice(0, 2);
    await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, {
        $set: { hmeromhnia_isxyos_oron_ergasias_eos: null, pososto_prosayxhshs_6hs_hmeras: 0,
            dialleima_se_lepta: 0, synexes_diakekomeno: false },
        $unset: { afora_egkekrimenh_rythmish_ergasias: 1 } });
    await db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $set: {
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-02-01'),
        hmeromhnia_allaghs_symbashs: new Date('2026-02-01') } });
    await db.companyModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(f.scope.company_kod) }, { $set: { kod: '0004' } });
    const originalInput = f.input;
    f.input = async () => ({ ...await originalInput(), companyBusinessCode: '0004' });
    const h = await httpHarness(db, f); t.after(h.close);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }); t.after(() => browser.close());
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.name));
    await context.route('**/*', async route => {
        const url = route.request().url();
        if (url === 'https://cdn.webpayrollsolutions.com/assets/own/vendor/sweetalert2-11.26.25.min.js')
            return route.fulfill({ contentType: 'application/javascript', body: await fs.readFile(require.resolve('sweetalert2/dist/sweetalert2.all.min.js')) });
        if (new URL(url).origin === h.origin) return route.continue();
        return route.abort();
    });
    const prefix = `${h.origin}/api/ergazomenoi/${f.employee._id}`;
    await page.goto(`${prefix}/history-proposal-editor?selection=UPDATE:${f.history[1]._id}`);
    await page.locator('#archiveHistoryRow').click();
    const archiveResponse = page.waitForResponse(response => response.url().endsWith('/history-proposal-archive'));
    await page.getByRole('button', { name: 'Ναι', exact: true }).click();
    assert.equal((await (await archiveResponse).json()).saved, true);
    await page.getByRole('button', { name: 'Κλείσιμο', exact: true }).click();
    await page.waitForURL(`${prefix}/history-proposal-editor`);
    const archived = await f.snapshot();
    const input = await h.state(), selection = `UPDATE:${f.history[0]._id}`;
    const baseline = await X.buildEmployeeHistoryProposalWorkbook(input, f.catalogs, { selection });
    for (const entry of baseline.editableCells) baseline.workbook.getWorksheet(entry.sheet).getCell(entry.cell).value = null;
    const requested = { pososto_prosayxhshs_6hs_hmeras: 40, afora_egkekrimenh_rythmish_ergasias: false,
        dialleima_se_lepta: 30, synexes_diakekomeno: true, DECLARATION: 'Ναι' };
    for (const [field, value] of Object.entries(requested)) {
        const entry = baseline.editableCells.find(entry => (entry.canonicalField || entry.role) === field);
        assert.ok(entry, field);
        const choices = E.editorChoices(entry, f.catalogs);
        const choice = choices.find(choice => A.equal(choice.id, value) || choice.label === value);
        baseline.workbook.getWorksheet(entry.sheet).getCell(entry.cell).value = choice ? choice.label : value;
    }
    const buffer = await X.serializeEmployeeHistoryProposalWorkbook(baseline.workbook);
    await page.goto(`${prefix}/history-proposal-editor?selection=${selection}`);
    const importedResponse = page.waitForResponse(response => response.url().endsWith('/history-proposal-import-preview'));
    await page.locator('#proposalImportFile').setInputFiles({ name: 'synthetic-history.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
    const imported = await (await importedResponse).json();
    assert.equal(imported.success, true, JSON.stringify(imported));
    await page.waitForFunction(() => document.querySelector('.proposal-page').getAttribute('aria-busy') !== 'true');
    const previewResponse = page.waitForResponse(response => response.url().endsWith('/history-proposal-apply-preview'));
    await page.locator('#previewProposalApply').click();
    const preview = await (await previewResponse).json();
    assert.equal(preview.success, true, JSON.stringify(preview));
    assert.equal(preview.executionEnabled, true);
    assert.equal(preview.physicalWrites.history.mode, 'CORRECTION_EDITION');
    assert.deepEqual(Object.fromEntries(preview.rows.map(row => [row.fieldId, row.after])), {
        pososto_prosayxhshs_6hs_hmeras: 40, afora_egkekrimenh_rythmish_ergasias: false,
        dialleima_se_lepta: 30, synexes_diakekomeno: true });
    assert.equal(await f.snapshot(), archived, 'XLSX and preview write nothing');
    const applyResponse = page.waitForResponse(response => response.url().endsWith('/history-proposal-apply'));
    await page.locator('#approveProposalApply').click();
    const apply = await (await applyResponse).json();
    console.log('Apply diagnostic:', JSON.stringify({ response: { success: apply.success, code: apply.code, outcome: apply.outcome }, logs: h.logs }));
    if (!apply.success) {
        const reconcileResponse = page.waitForResponse(response => response.url().endsWith('/history-proposal-apply-reconcile'));
        await page.locator('#reconcileProposalApply').click();
        const reconcile = await (await reconcileResponse).json();
        console.log('Reconcile diagnostic:', JSON.stringify({ code: reconcile.code, outcome: reconcile.outcome }));
        assert.equal(await f.snapshot(), archived, 'A rejected synthetic attempt is rolled back');
    }
    assert.equal(apply.success, true, JSON.stringify(h.logs));
    assert.equal(apply.saved, true); assert.equal(apply.verification.persisted, true);
    const completed = await f.snapshot(), state = await h.state();
    const audit = await db.auditModel.findById(apply.auditId).lean();
    assert.equal(audit.diagnostics.rowApproval.mode, 'CORRECTION_EDITION');
    assert.equal(audit.diagnostics.rowApproval.status, 'APPROVED_RESOLVED');
    for (const row of input.completeHistoryRows)
        assert.equal(A.equal(state.completeHistoryRows.find(candidate => String(candidate._id) === String(row._id)), row), true);
    assert.equal(State.archivedIds(state).has(String(f.history[1]._id)), true);
    // Use the exact request issued by the real browser, with its signed approval.
    const proof = preview.approval.token;
    const requestBody = (await applyResponse).request().postDataJSON();
    const response = await page.evaluate(async ({ url, proposal, token }) => {
        const csrf = document.querySelector('meta[name="csrf-token"]').content;
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({ proposal, token }) }).then(response => response.json());
    }, { url: `${prefix}/history-proposal-apply-reconcile`, proposal: requestBody.proposal, token: proof });
    assert.equal(response.success, true); assert.equal(response.reconciledReadOnly, true);
    assert.equal(await f.snapshot(), completed); assert.deepEqual(errors, []);
});
