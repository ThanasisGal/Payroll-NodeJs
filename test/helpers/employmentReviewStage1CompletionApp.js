'use strict';
// Real production controllers and services; only the authenticated HTTP session
// and synthetic data are supplied here. No app.js, jobs, dotenv or ERGANI calls.
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { fixture, browserApp } = require('./employmentReviewEmployeesApp');
const { requireUserPrivilegeAction } = require('../../server/middlewares/requireUserPrivilegeForm');
const { authorizeSessionCompany } = require('../../server/middlewares/programmataAccessScope');
const { requireCriticalEmploymentDecisionRole } = require('../../server/services/ergazomenoi/apasxoliseisCriticalActionAuthorizationService');
const { ProdhlomenaOrariaModel: D, ProdhlomenaOrariaAuditModel: DailyAudit } = require('../../server/models/ergazomenoi');
const { PeriodsModel, KathgoriesAdeiasModel } = require('../../server/models/stathera_arxeia');
const State = require('../../server/models/apasxoliseisWeeklyHrWorkflowState');
const Audit = require('../../server/models/apasxoliseisWeeklyHrWorkflowAudit');
const Period = require('../../server/models/apasxoliseisPeriodControl');
const PeriodAudit = require('../../server/models/apasxoliseisPeriodControlAudit');
const controller = require('../../server/controllers/ergazomenoi/erganhController');

async function createStage1CompletionFixture(uri, vendorDir) {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:271(?:39|49)\/payroll_period_employees_test_guidance_[a-z0-9_]+\?replicaSet=payrollDraftTest$/);
    const data = await fixture(uri);
    Object.assign(data.session, { userName: 'ΣΥΝΘΕΤΙΚΟΣ ΧΡΗΣΤΗΣ', yearInUse: '2026',
        periodInUse: '09', companyKodikos: '0004', userStatus: 'A', appDate: '2026-09-30' });
    await PeriodsModel.collection.insertOne({ xrhsh: '2026', kodikos: '09',
        apo: new Date('2026-09-01'), eos: new Date('2026-09-30') });
    await KathgoriesAdeiasModel.collection.insertOne({ kodikos: 'ΑΔΚΑΝ', perigrafh: 'Κανονική άδεια' });
    const base = { team: 'TEST', company_kod: String(data.company), ypokatasthma: '0000' };
    const employee = { _id: new mongoose.Types.ObjectId(), ...base, kodikos: '0039',
        eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ 0039', energos: true,
        oristikh_enhmerosh: true, hmeromhnia_proslhpshs: new Date('2026-01-01'),
        // Rotational two-day terms and the target week's work/non-work pattern
        // mirror the read-only diagnosis, without copying identities or records.
        kathestos_apasxolhshs: '2', typos_apasxolhshs: '2', typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 2,
        ores_ergasias_ebdomadas: 16, pososto_prosayxhshs_6hs_hmeras: 40,
        pragmatikoOromisthio: 10, hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01') };
    await data.E.collection.insertOne(employee);
    const rows = Array.from({ length: 35 }, (_, day) => {
        const date = new Date(Date.UTC(2026, 7, 31 + day));
        const key = date.toISOString().slice(0, 10);
        const rest = [0, 6].includes(date.getUTCDay());
        const possible = ['2026-09-12', '2026-09-13'].includes(key);
        const targetWeek = key >= '2026-09-07' && key <= '2026-09-13';
        const nonWork = targetWeek ? !possible : rest;
        return { _id: new mongoose.Types.ObjectId(), ...base, employee_id: employee._id,
            kodikos: employee.kodikos, hmeromhnia: date,
            kathgoria_ergasias: nonWork ? 'ΜΕ' : 'ΕΡΓ', repo: false,
            apo_ora_01: nonWork ? '' : '09:00', eos_ora_01: nonWork ? '' : possible ? '17:00' : '13:00',
            ores_ergasias: nonWork ? 0 : possible ? 8 : 4,
            cards_apo_ora_01: nonWork || possible ? '' : '09:00', cards_eos_ora_01: nonWork || possible ? '' : '13:00',
            cards_ores_ergasias: nonWork || possible ? 0 : 4,
            ores_ergasias_apologistika: nonWork ? 0 : possible ? 8 : 4,
            kathgoria_ergasias_apologistika: possible ? '' : nonWork ? 'ΜΕ' : 'ΕΡΓ',
            repo_apologistika: false, adeia_apologistika: false, astheneia_apologistika: false,
            apousia_apologistika: false, kathgoria_adeias_apologistika: possible ? 'POSSIBLE_LEAVE' : '',
            apologistiko_biblio: !possible, is_locked: false,
            updatedAt: new Date('2026-09-30T00:00:00Z') };
    });
    await D.collection.insertMany(rows);
    for (const model of [State, Audit, Period, PeriodAudit]) await model.createIndexes();
    const app = browserApp({ ...data, vendorDir });
    app.use(express.json({ limit: '64kb' }));
    app.use('/api/prodhlomena-oraria/review',
        requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'read'), authorizeSessionCompany);
    const prefix = '/api/prodhlomena-oraria/review';
    app.get(prefix, controller.getProdhlomenaOrariaForReview);
    app.get(prefix + '/period-control/current', controller.getEmploymentReviewPeriodControl);
    app.get(prefix + '/orphan-quality-check', controller.getProdhlomenaOrariaOrphanQualityCheck);
    app.get(prefix + '/weekly-hr-workflow/stage2/bulk-preview', controller.previewWeeklyHrWorkflowStage2Bulk);
    app.get(prefix + '/weekly-hr-workflow/stage1', controller.getWeeklyHrWorkflowStage1);
    app.post(prefix + '/weekly-hr-workflow/stage1/bulk-review', controller.getWeeklyHrWorkflowStage1Bulk);
    for (const [route, handler] of [
        ['stage1/complete', controller.completeWeeklyHrWorkflowStage1],
        ['stage1/bulk-complete', controller.completeWeeklyHrWorkflowStage1Bulk],
        ['stage1/bulk-classify-days', controller.saveWeeklyHrStage1DailyClassificationsBulk],
        ['stage2/complete', controller.completeWeeklyHrWorkflowStage2]
    ]) app.post(prefix + '/weekly-hr-workflow/' + route, requireCriticalEmploymentDecisionRole, handler);
    // Ancillary read uses the real category records, with no external requests.
    app.get('/api/dropdown/ergazomenoi/kathgoria_adeias', async (_req, res) => res.json({
        items: (await KathgoriesAdeiasModel.find().lean()).map(row => ({ value: row.kodikos, label: row.perigrafh })) }));
    const scope = { ypokatasthma: '0000', employee_id: String(employee._id),
        week_start: '2026-09-07', week_end: '2026-09-13' };
    return { ...data, app, employee, rows, scope, base, D, DailyAudit, State, Audit, Period,
        snapshot: async () => JSON.stringify({ rows: await D.find(base).sort({ hmeromhnia: 1 }).lean(),
            states: await State.find(base).lean(), audits: await Audit.find(base).lean(),
            dailyAudits: await DailyAudit.find(base).lean() }) };
}
module.exports = { createStage1CompletionFixture };
