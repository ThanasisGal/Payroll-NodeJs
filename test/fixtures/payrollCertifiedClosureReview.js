'use strict';
const mongoose = require('mongoose'), assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { browserApp } = require('../helpers/employmentReviewEmployeesApp');
const controller = require('../../server/controllers/ergazomenoi/erganhController');
const { buildCompleteProfileSnapshot } = require('../../server/utils/ergazomenoi/employmentProfileHistory');
const { completeSyntheticEmploymentTerms } = require('./employeeCompleteProfileFixture');

async function startClosureReview(db, vendorDir) {
    // Attach the production models ONLY to the mongod whose process/dbpath was
    // independently checked by startApprovedProposalMongo. No accepted URI.
    assert.equal(db.connection.host, '127.0.0.1');
    assert.equal(db.connection.name, 'payroll_approved_proposal_test');
    assert.equal(mongoose.connection.readyState, 0);
    await mongoose.connect(`mongodb://127.0.0.1:${db.connection.port}/payroll_approved_proposal_review_test?replicaSet=payrollApprovedProposalTest`,
        { autoIndex: false, autoCreate: false, monitorCommands: true });
    mongoose.set('sanitizeFilter', true);
    const models = require('../../server/models/ergazomenoi');
    const E = models.ErgazomenoiModel, H = models.IstorikoProslhpseonAllagonModel, D = models.ProdhlomenaOrariaModel;
    const { CompaniesModel: Company, YpokatasthmataModel: Branch } = require('../../server/models/companies');
    const User = require('../../server/models/userModel'), Privilege = require('../../server/models/privileges').UserPrivilegesModel;
    const Period = require('../../server/models/apasxoliseisPeriodControl');
    const { PeriodsModel } = require('../../server/models/stathera_arxeia');
    const company = new mongoose.Types.ObjectId(), actor = new mongoose.Types.ObjectId();
    const base = { team: 'THA', company_kod: String(company), ypokatasthma: '0000' };
    const session = { userId: String(actor), userTeam: 'THA', userRole: 'HR', userStatus: 'A',
        userName: 'ΣΥΝΘΕΤΙΚΟΣ ΕΛΕΓΧΟΣ', companyInUse: String(company), companyKodikos: '0003',
        periodInUse: '10', yearInUse: '2026', appDate: '2026-11-17' };
    await Company.collection.insertOne({ _id: company, team: 'THA', kod: '0003' });
    await Branch.collection.insertOne({ team: 'THA', companykod_object: String(company), kodikos: '0000' });
    await User.collection.insertOne({ _id: actor, team: 'THA', privileges: 'HR', situation: 'A' });
    await Privilege.collection.insertOne({ userId: String(actor), form: 'ElegxosApasxolhseonPeriodoy', privileges: { read: true, update: true } });
    await PeriodsModel.collection.insertOne({ xrhsh: '2026', kodikos: '10', apo: new Date('2026-10-01'), eos: new Date('2026-10-31') });
    const profile = buildCompleteProfileSnapshot({ current: completeSyntheticEmploymentTerms(), effectiveFrom: '2026-01-01' });
    const employees = [];
    for (const code of ['0001', '0002', '0003', '0004']) {
        const employee = { ...profile, ...base, _id: new mongoose.Types.ObjectId(), kodikos: code,
            oristikh_enhmerosh: true, energos: code !== '0001', eponymo: `ΣΥΝΘΕΤΙΚΟΣ ${code}`, onoma: 'ΔΟΚΙΜΗ',
            hmeromhnia_proslhpshs: new Date('2026-01-01'), hmeromhnia_apoxorhshs: code === '0001' ? new Date('2026-09-30') : null };
        await E.collection.insertOne(employee);
        await H.collection.insertOne({ ...employee, _id: new mongoose.Types.ObjectId(), afora_proslhpsh: true,
            hmeromhnia_isxyos_oron_ergasias_eos: code === '0001' ? new Date('2026-09-30') : null });
        employees.push(employee);
        const rows = Array.from({ length: code === '0001' ? 31 : 35 }, (_, index) => {
            const day = code === '0001' ? new Date(Date.UTC(2026, 9, index + 1)) : new Date(Date.UTC(2026, 8, 28 + index));
            const worked = code !== '0001' && ![0, 6].includes(day.getUTCDay());
            return { _id: new mongoose.Types.ObjectId(), ...base, kodikos: code, hmeromhnia: day,
                is_locked: false, kathgoria_ergasias: worked ? 'ΕΡΓ' : 'ΜΕ', repo: false,
                ...(code !== '0001' ? { apo_ora_01: worked ? '08:00' : '', eos_ora_01: worked ? '16:00' : '',
                    cards_apo_ora_01: worked ? '08:00' : '', cards_eos_ora_01: worked ? '16:00' : '',
                    ores_ergasias: worked ? 8 : 0, cards_ores_ergasias: worked ? 8 : 0,
                    kathgoria_ergasias_apologistika: worked ? 'ΕΡΓ' : 'ΜΕ',
                    ores_ergasias_apologistika: worked ? 8 : 0, apologistiko_biblio: true } : {}),
                ergani_pipeline: { cards_pending: false, calculation_pending: day.getUTCMonth() === 9 } };
        });
        await D.collection.insertMany(rows);
    }
    const scope = { ...base, period_start: new Date('2026-10-01'), period_end: new Date('2026-10-31') };
    await Period.createIndexes();
    await Period.collection.insertOne({ ...scope, status: 'OPEN', deadline: new Date('2026-11-30'), version: 1,
        write_fence_version: 0, successful_calculation_version: 0, active_calculation_id: '' });
    const app = browserApp({ session, vendorDir, periodRec: { apo: '2026-10-01', eos: '2026-10-31' } });
    app.use(express.json());
    app.use((req, res, next) => { req.sessionID = 'isolated-closure-review'; next(); });
    const prefix = '/api/prodhlomena-oraria/review';
    app.use(prefix, require('../../server/middlewares/requireUserPrivilegeForm').requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'read'),
        require('../../server/middlewares/programmataAccessScope').authorizeSessionCompany);
    const routes = {
        '': 'getProdhlomenaOrariaForReview', '/period-control/current': 'getEmploymentReviewPeriodControl',
        '/orphan-quality-check': 'getProdhlomenaOrariaOrphanQualityCheck',
        '/weekly-hr-workflow/stage1': 'getWeeklyHrWorkflowStage1',
        '/weekly-hr-workflow/stage2/bulk-preview': 'previewWeeklyHrWorkflowStage2Bulk',
        '/scenarios': 'getProdhlomenaOrariaScenarioClassifications', '/policies/preview': 'getProdhlomenaOrariaPolicyPreview',
        '/policies/approvals': 'getProdhlomenaOrariaPolicyPreviewApprovals', '/policies/apply-dry-run': 'getProdhlomenaOrariaPolicyPreviewApplyDryRun',
        '/repo-transfer-decisions/current': 'getWeeklyRepoTransferDecisionBatch',
        '/export-excel': 'exportProdhlomenaOrariaReviewExcel', '/export-pdf': 'exportProdhlomenaOrariaReviewPdf'
    };
    for (const [route, name] of Object.entries(routes)) app.get(prefix + route, controller[name]);
    app.post(prefix + '/weekly-hr-workflow/stage1/bulk-review', controller.getWeeklyHrWorkflowStage1Bulk);
    app.post(prefix + '/calculate', (req, res, next) => {
        req.programmataAccessScope = { effectiveTeam: base.team, companyId: base.company_kod,
            ypokatasthma: base.ypokatasthma, dateRange: { startDate: scope.period_start, endDate: scope.period_end } }; next();
    }, controller.calcApasxolhseisPeriodoy);
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    return { E, H, D, Period, base, scope, session, employees, prefix, origin: `http://127.0.0.1:${server.address().port}`,
        close: async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); await mongoose.disconnect(); } };
}
module.exports = { startClosureReview };
