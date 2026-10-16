'use strict';
// Real selection handler, authorization, models, EJS and browser modules. The
// adapter does not import app.js, start jobs, read .env or enable external APIs.
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const ejs = require('ejs');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createHandler } = require('../../server/controllers/ergazomenoi/employmentReviewEmployeesController');
const { requireUserPrivilegeAction } = require('../../server/middlewares/requireUserPrivilegeForm');
const { authorizeSessionCompany } = require('../../server/middlewares/programmataAccessScope');
const { createDropdownApi } = require('../../server/utils/createDropdownApi');
const dropdown = require('../../server/dropdowns/ergazomenoi/ergazomenoi');
const { ErgazomenoiModel: E, IstorikoProslhpseonAllagonModel: H } = require('../../server/models/ergazomenoi');
const { CompaniesModel: C, YpokatasthmataModel: B } = require('../../server/models/companies');
const U = require('../../server/models/userModel');
const { UserPrivilegesModel: V } = require('../../server/models/privileges');
const root = path.resolve(__dirname, '../..');

async function fixture(uri) {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:271(?:39|49)\/payroll_period_employees_test_[a-z0-9_]+(?:\?replicaSet=payrollDraftTest)?$/);
    mongoose.set('sanitizeFilter', true);
    await mongoose.connect(uri, { autoIndex: false });
    const company = new mongoose.Types.ObjectId();
    const otherCompany = new mongoose.Types.ObjectId();
    const actor = new mongoose.Types.ObjectId();
    await C.collection.insertMany([{ _id: company, team: 'TEST', kod: '0004' }, { _id: otherCompany, team: 'OTHER', kod: '0005' }]);
    await U.collection.insertOne({ _id: actor, team: 'TEST', situation: 'A', privileges: 'HR' });
    await V.collection.insertOne({ userId: String(actor), form: 'ElegxosApasxolhseonPeriodoy', privileges: { read: true } });
    await B.collection.insertMany(['0000', '0001'].map(kodikos => ({ team: 'TEST', companykod_object: String(company), kodikos })));
    const base = { team: 'TEST', company_kod: String(company), ypokatasthma: '0000',
        eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ', energos: false, archived: false,
        hmeromhnia_proslhpshs: new Date('2026-01-01'), hmeromhnia_apoxorhshs: new Date('2026-10-04') };
    await E.collection.insertMany([
        { ...base, kodikos: '0001' }, // Missing finalization marker is deliberately legacy.
        { ...base, kodikos: '0002', oristikh_enhmerosh: false },
        { ...base, kodikos: '0003', company_kod: String(otherCompany) },
        { ...base, kodikos: '0004', team: 'OTHER' },
        { ...base, kodikos: '0005', hmeromhnia_apoxorhshs: new Date('2026-08-31') },
        { ...base, kodikos: '0006', hmeromhnia_proslhpshs: new Date('2026-10-10'), hmeromhnia_apoxorhshs: null, energos: true },
        { ...base, kodikos: '0007', ypokatasthma: '0001' },
        { ...base, kodikos: '0008', ypokatasthma: '0' },
        { ...base, kodikos: '0009', energos: true, hmeromhnia_apoxorhshs: null },
        { ...base, kodikos: '0010', hmeromhnia_apoxorhshs: new Date('2026-08-31') },
        { ...base, kodikos: '0010', hmeromhnia_proslhpshs: new Date('2026-10-10'), hmeromhnia_apoxorhshs: null }
    ]);
    await H.collection.insertMany([
        { team: 'TEST', company_kod: String(company), kodikos: '0006', hmeromhnia_proslhpshs: new Date('2026-01-01'), hmeromhnia_apoxorhshs: new Date('2026-08-31') },
        { team: 'TEST', company_kod: String(company), kodikos: '0006', hmeromhnia_proslhpshs: new Date('2026-10-10') },
        // A foreign company's history must not create employment in a gap.
        { team: 'OTHER', company_kod: String(otherCompany), kodikos: '0006', hmeromhnia_proslhpshs: new Date('2026-09-01') }
    ]);
    const session = { userId: String(actor), userTeam: 'TEST', userRole: 'HR', companyInUse: String(company) };
    return { company, otherCompany, actor, session, E, H, C, B, U, V };
}

function browserApp({ session, vendorDir, beforeSelection = (_req, _res, next) => next() }) {
    const app = express();
    app.use('/static', express.static(path.join(root, 'public')));
    app.use('/vendor', express.static(path.join(root, 'node_modules')));
    if (vendorDir) app.use('/tom-vendor', express.static(vendorDir));
    app.use((req, _res, next) => { req.session = session; next(); });
    const auth = requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'read');
    app.get('/api/prodhlomena-oraria/review/employees', auth, authorizeSessionCompany, beforeSelection, createHandler());
    app.get(['/legacy-employees', '/api/dropdown/kinhseis/apasxolhseis/ergazomenoi'], (req, res) => {
        req.query = { ...req.query, company: session.companyInUse, team: session.userTeam };
        return createDropdownApi(dropdown.model, dropdown.options)(req, res);
    });
    app.get('/api/dropdown/erganh/ypokatasthmata', auth, authorizeSessionCompany, async (req, res) => {
        const rows = await B.find({ team: req.programmataAccessScope.effectiveTeam,
            companykod_object: req.programmataAccessScope.companyId }).lean();
        res.json({ items: rows.map(row => ({ value: row.kodikos, label: row.kodikos + ' - ΣΥΝΘΕΤΙΚΟ ΠΑΡΑΡΤΗΜΑ' })), hasMore: false });
    });
    app.get('/review', auth, authorizeSessionCompany, (_req, res) => {
        const body = ejs.render(fs.readFileSync(path.join(root, 'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8'), {
            userRole: 'HR', companyId: session.companyInUse, csrfToken: 'isolated',
            periodRec: { apo: '2026-09-01', eos: '2026-09-30' },
            script: name => '/static/js/' + name.replace(/\.js$/, '') + '.js'
        });
        res.send(`<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <link rel="stylesheet" href="/static/css/bootstrap.min.css"><link rel="stylesheet" href="/tom-vendor/tom-select.css"><link rel="stylesheet" href="/static/css/main.css">
            <script src="/vendor/jquery/dist/jquery.js"></script><script src="/tom-vendor/tom-select.complete.js"></script>
            <script src="/static/js/bootstrap.bundle.min.js"></script><script src="/vendor/sweetalert2/dist/sweetalert2.all.js"></script>
            </head><body>${body}</body></html>`);
    });
    return app;
}
module.exports = { fixture, browserApp };
