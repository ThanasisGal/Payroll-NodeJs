'use strict';
const express = require('express');
const { once } = require('node:events');
const path = require('node:path');
async function startArchiveHttp(f, db) {
    const app = express(); app.set('view engine', 'ejs'); app.set('views', path.resolve(__dirname, '../../views'));
    const tokens = require('../../server/middlewares/simpleCsrfToken').createSimpleCsrfToken();
    app.use(express.json()); app.use(require('cookie-parser')()); app.use(tokens.exposeToken);
    app.get('/csrf-token', tokens.tokenEndpoint);
    const requests = [];
    app.use((req, res, next) => {
        req.session = f.req.session; req.sessionID = f.req.sessionID;
        if (req.method === 'POST') {
            requests.push(req.path);
            if (!tokens.validateToken(req)) return res.status(403).json({ success: false, saved: false,
                code: 'CSRF_TOKEN_INVALID', message: 'Η διαγραφή σταμάτησε επειδή έληξε η επιβεβαίωση σύνδεσης. Δεν αποθηκεύτηκε αλλαγή.\n1. Ανοίξτε ξανά την καρτέλα.\n2. Επαναλάβετε τη διαγραφή.\nΚωδικός αναφοράς: CSRF_TOKEN_INVALID.' });
        }
        next();
    });
    const state = async () => require('../../server/services/ergazomenoi/employeeHistoryMaintenanceApprovalService')
        .loadMaintenanceApprovalInput(await f.input(), db.auditModel);
    const archive = require('../../server/services/ergazomenoi/employeeHistoryArchiveService').createEmployeeHistoryArchiveService(db);
    const render = async (req, res, next) => {
        try {
            await require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService').respondEmployeeHistoryProposal(req, res,
                await state(), f.catalogs, { loadSources: async () => ({ deductions: [], categories: [], types: [] }),
                    archiveAccess: archive.editorAccess });
        } catch (error) { next(error); }
    };
    app.use('/static', express.static(path.resolve(__dirname, '../../public')));
    app.get('/parent', async (req, res) => {
        const rows = require('../../server/services/ergazomenoi/employeeHistoryArchiveStateService').visibleRows(await state());
        res.type('html').send(`<input id="istorikoEmployeeId" value="${f.employee._id}"><input id="syntheticUnsaved" value="unsaved">
            <table id="istorikoTable" data-preserve-sequence="true"><tbody>${rows.map(row => `<tr class="istoriko-row" data-id="${row._id}" data-persisted="true" data-record='${JSON.stringify(row)}' data-original='${JSON.stringify(row)}'>
                <td class="istoriko-aa-col">${row.aa_eggrafhs}</td></tr>`).join('')}</tbody></table>
            <script src="/static/js/ergazomenoi/genika/istorikoTable.js"></script>`);
    });
    require('../../server/routes/employeeHistorySettlementRoutes').registerEmployeeHistorySettlementRoutes(app, {
        checkAuth: (req, res, next) => next(), requireUserPrivilegeAction: () => (req, res, next) => next(),
        controller: { exportXlsx: render, resolve: render, apply: (req, res) => res.sendStatus(403) },
        archiveController: require('../../server/controllers/ergazomenoi/employeeHistoryArchiveController').createEmployeeHistoryArchiveController({ service: archive })
    });
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, error: error.message }));
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    return { origin: `http://127.0.0.1:${server.address().port}`, requests, state,
        close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
module.exports = { startArchiveHttp };
