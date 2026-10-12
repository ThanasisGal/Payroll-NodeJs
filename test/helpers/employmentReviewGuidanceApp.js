'use strict';
// Isolated HTTP adapter: production EJS/JS, authorization, Mongoose models and
// workflow services. Never import app.js, dotenv, jobs or external API clients.
const express = require('express');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { fixture, browserApp } = require('./employmentReviewEmployeesApp');
const { requireUserPrivilegeAction } = require('../../server/middlewares/requireUserPrivilegeForm');
const { authorizeSessionCompany } = require('../../server/middlewares/programmataAccessScope');
const { requireCriticalEmploymentDecisionRole } = require('../../server/services/ergazomenoi/apasxoliseisCriticalActionAuthorizationService');
const { ProdhlomenaOrariaModel: D } = require('../../server/models/ergazomenoi');
const State = require('../../server/models/apasxoliseisWeeklyHrWorkflowState');
const Audit = require('../../server/models/apasxoliseisWeeklyHrWorkflowAudit');
const Decision = require('../../server/models/apasxoliseisWeeklyRepoTransferDecision');
const { resolveWeeklyRepoTransferDecisionFromPreparedWeek } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferPreparedStage2ResolverService');
const { createWeeklyRepoTransferDecision } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionService');
const { buildWeeklyHrWorkflowProjection } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrWorkflowProjectionService');
const { buildWeeklyHrLifecycleProjection, stage3FingerprintResolvedDates } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const { completeWeeklyHrWorkflowStage1 } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage1CompletionService');
const { completeWeeklyHrWorkflowStage1Bulk } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage1BulkCompletionService');
const { resolveWeeklyHrStage3Day } = require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage3ResolutionService');
const { resolveDailyActualWorkFacts } = require('../../server/services/ergazomenoi/apasxoliseisDailyActualWorkFactsService');
const { countOrphanHitsByEmployee } = require('../../server/services/ergazomenoi/apasxoliseisOrphanQualityCheckService');
const { reviewErrorResponse } = require('../../server/services/ergazomenoi/apasxoliseisReviewErrorPresentationService');
const { getMondaySundayWeekRange } = require('../../server/utils/date/mondaySundayWeek');
const { appendStage4BlockedDeviationRows } = require('../../server/services/ergazomenoi/apasxoliseisStage4BlockedDeviationPresentationService');
const guidance = require('../../public/js/ergazomenoi/programmata/employmentReviewGuidance');

async function createGuidanceFixture(uri, vendorDir) {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:271(?:39|49)\/payroll_period_employees_test_guidance_[a-z0-9_]+\?replicaSet=payrollDraftTest$/);
    const data = await fixture(uri);
    Object.assign(data.session, { userName: 'ΣΥΝΘΕΤΙΚΟΣ ΧΡΗΣΤΗΣ', yearInUse: '2026', companyKodikos: '0004', userStatus: 'A' });
    const base = { team: 'TEST', company_kod: String(data.company), ypokatasthma: '0000' };
    const terms = { typos_apasxolhshs: '0', typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 5,
        pososto_prosayxhshs_6hs_hmeras: 40, pragmatikoOromisthio: 10 };
    await data.E.collection.updateMany({ ...base }, { $set: terms });
    await data.E.collection.insertOne({ ...base, ...terms, kodikos: '0011', eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΤΕΛΙΚΟΣ ΕΛΕΓΧΟΣ',
        hmeromhnia_proslhpshs: new Date('2026-01-01'), energos: true, pososto_prosayxhshs_6hs_hmeras: null });
    const employees = await data.E.find({ ...base, kodikos: mongoose.trusted({ $in: ['0001','0009','0011'] }) }).lean();
    const employeeById = new Map(employees.map(employee => [String(employee._id), employee]));
    const records = [];
    for (const employee of employees) for (let day = 0; day < 35; day++) {
        const date = new Date(Date.UTC(2026, 7, 31 + day));
        const key = date.toISOString().slice(0, 10);
        const rest = [0, 6].includes(date.getUTCDay());
        const possible = employee.kodikos === '0001' && ['2026-09-15','2026-09-22'].includes(key) ||
            employee.kodikos === '0009' && key === '2026-09-15';
        const row = { _id: new mongoose.Types.ObjectId(), ...base, employee_id: employee._id,
            kodikos: employee.kodikos, employeeName: `${employee.eponymo} ${employee.onoma}`,
            hmeromhnia: date, kathgoria_ergasias: rest ? 'ΑΝ' : 'ΕΡΓ', repo: rest,
            apo_ora_01: rest ? '' : '09:00', eos_ora_01: rest ? '' : '17:00', ores_ergasias: rest ? 0 : 8,
            cards_apo_ora_01: rest || possible ? '' : '09:00', cards_eos_ora_01: rest || possible ? '' : '17:00',
            cards_ores_ergasias: rest || possible ? 0 : 8,
            ores_ergasias_apologistika: rest || possible ? 0 : 8,
            kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : possible ? '' : 'ΕΡΓ',
            repo_apologistika: rest, kathgoria_adeias_apologistika: possible ? 'POSSIBLE_LEAVE' : '',
            adeia_apologistika: false, astheneia_apologistika: false, apousia_apologistika: false,
            apologistiko_biblio: false, is_locked: false, updatedAt: new Date('2026-10-01T00:00:00Z') };
        if (employee.kodikos === '0001' && day < 7) {
            Object.assign(row, { kathgoria_ergasias: day === 2 ? 'ΑΝ' : 'ΕΡΓ', repo: day === 2,
                kathgoria_ergasias_apologistika: day === 0 ? 'ΕΡΓ' : day === 2 ? 'ΑΝ' : '', repo_apologistika: false,
                cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
                ores_ergasias_apologistika: 0, ores_ergasias: day === 1 ? -1 : day === 2 ? 0 : 8 });
            if (day === 3) Object.assign(row, { cards_apo_ora_01: '09:00', cards_eos_ora_01: '09:00' });
        }
        if (employee.kodikos === '0009' && key === '2026-09-16')
            Object.assign(row, { kathgoria_ergasias: 'ΑΝ', repo: true, kathgoria_ergasias_apologistika: '', repo_apologistika: false, ores_ergasias: 0 });
        if (employee.kodikos === '0009' && key === '2026-09-19' || employee.kodikos === '0011' && key === '2026-09-19')
            Object.assign(row, { kathgoria_ergasias: 'ΕΡΓ', repo: false, kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false,
                cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_ores_ergasias: 8,
                ores_ergasias: 8, ores_ergasias_apologistika: 8 });
        records.push(row);
    }
    await D.collection.insertMany(records);
    await State.createIndexes();
    await Audit.createIndexes();
    await Decision.createIndexes();
    const actor = { user_id: String(data.actor), user_name: 'ΣΥΝΘΕΤΙΚΟΣ ΧΡΗΣΤΗΣ', role: 'HR' };
    const starts = ['2026-08-31','2026-09-07','2026-09-14','2026-09-21','2026-09-28'];
    function scopeFor(input = {}) {
        if (typeof input.employee_id !== 'string' || !employeeById.has(input.employee_id) ||
            input.ypokatasthma !== '0000' || !starts.includes(input.week_start) ||
            guidance.dateKey(input.week_end) !== getMondaySundayWeekRange(input.week_start)?.weekEndKey)
            throw Object.assign(new Error('Invalid isolated scope'), { code: 'INVALID_WEEK_SCOPE', statusCode: 400 });
        const employee = employeeById.get(input.employee_id);
        return { ...base, employee_id: employee._id, employee_kodikos: employee.kodikos,
            week_start: new Date(input.week_start), week_end: new Date(input.week_end) };
    }
    async function context(input, session) {
        const scope = scopeFor(input);
        const filter = { ...base, kodikos: scope.employee_kodikos,
            hmeromhnia: mongoose.trusted({ $gte: scope.week_start, $lte: scope.week_end }) };
        const rows = await D.find(filter).session(session || null).sort({ hmeromhnia: 1 }).lean();
        const state = await State.findOne(scope).session(session || null).lean();
        const employee = employeeById.get(String(scope.employee_id));
        const profiles = Object.fromEntries(rows.map(row => [guidance.dateKey(row.hmeromhnia), employee]));
        const prepared = await preparedWeek({ scope, rows, employee });
        const lifecycle = buildWeeklyHrLifecycleProjection({ weekRows: rows, effectiveProfile: employee, effectiveProfilesByDate: profiles,
            persistedStage1State: state?.stage1, persistedStage2State: state?.stage2,
            persistedStage3State: state?.stage3, persistedStage2DecisionState: prepared.record, scope });
        const workflow = buildWeeklyHrWorkflowProjection({ weekRows: rows, effectiveProfile: employee,
            effectiveProfilesByDate: profiles, persistedStage1State: state?.stage1, indexState: { ready: true } });
        return { scope, rows, state, employee, profiles, lifecycle, workflow, prepared };
    }
    async function preparedWeek({ scope, rows, employee }) {
        const decisions = await Decision.find({ ...base, employee_id: employee._id,
            week_start: scope.week_start, week_end: scope.week_end }).lean();
        return resolveWeeklyRepoTransferDecisionFromPreparedWeek({
            weeklyInput: { weekRows: rows, employmentProfile: employee, holidayByDateKey: new Map(),
                existingAuditCountByRowKey: new Map(), diagnosticContext: { ...scope,
                    week_start: guidance.dateKey(scope.week_start), week_end: guidance.dateKey(scope.week_end) } },
            scope: { ...base, company_kodikos: '0004' },
            canonicalDecisionContext: { employee, history: [], audits: [], companyFlags: {}, companyKodikos: '0004' },
            decisions, executions: [], applyProtection: { authorized: true, runtimeEnabled: true, indexReady: true }
        });
    }
    function publicContext(c) {
        const { scope, rows, state, employee, lifecycle, workflow } = c;
        return { success: true, ...workflow, scope: { ...scope,
            employee_id: String(scope.employee_id), week_start: guidance.dateKey(scope.week_start), week_end: guidance.dateKey(scope.week_end),
            period_start: '2026-09-01', period_end: '2026-09-30' }, rows,
        employee_name: `${employee.eponymo} ${employee.onoma}`, stage1: state?.stage1 || null,
        stage1_status: lifecycle.stages.stage1.persisted_status, lifecycle_projection: lifecycle,
        stage1_daily_presentation: rows.map(row => ({ date: guidance.dateKey(row.hmeromhnia), employment_type: '0', employment_label: 'Πλήρης',
            actual_work_hours: row.ores_ergasias_apologistika, declared_hours: row.ores_ergasias,
            card_hours: row.cards_ores_ergasias, current_apologistiko_classification: row.kathgoria_ergasias_apologistika,
            card_intervals: row.cards_apo_ora_01 ? [{ start: row.cards_apo_ora_01, end: row.cards_eos_ora_01 }] : [] })) };
    }
    async function complete(input, reason, requestId) {
        const initial = await context(input);
        return completeWeeklyHrWorkflowStage1({ scope: initial.scope, weekRows: initial.rows, actor,
            workflow_context: { effectiveProfile: initial.employee, effectiveProfilesByDate: initial.profiles },
            reason_or_notes: reason, request_id: requestId,
            fenceWeeklyInput: async ({ session }) => { assert.ok(session); },
            loadFreshWeekRows: async ({ session }) => (await context(input, session)).rows });
    }
    async function stage3Context(input, session) {
        const c = await context(input, session);
        const row = c.rows.find(row => String(row._id) === input.row_id && guidance.dateKey(row.hmeromhnia) === input.decision_date);
        assert.ok(row);
        const stage1 = c.lifecycle.stages.stage1;
        const stage3 = c.lifecycle.stages.stage3;
        return { scope: c.scope, row, weekRows: c.rows, dailyProfile: c.employee,
            actualFacts: resolveDailyActualWorkFacts(row), workflowState: c.state,
            isResidual: stage3.pending_dates.includes(input.decision_date), remaining_dates: [...stage3.pending_dates],
            stage2: { fingerprint: stage3.stage2_fingerprint, status: stage3.stage2_status,
                resolution: stage3.stage2_resolution, resolved_dates: stage3FingerprintResolvedDates(stage3) },
            upstream: { stage1_attestation_scope: 'WEEKLY', stage1_period_start: '', stage1_period_end: '',
                stage1_context_fingerprint: stage1.current_context_fingerprint, stage1_current_fingerprint: stage1.current_completion_fingerprint,
                stage1_completion_fingerprint: c.state?.stage1?.completion_fingerprint || '',
                stage1_effective_fingerprint: c.state?.stage1?.effective_fingerprint || '', stage1_version: c.state?.stage1?.version || 0,
                stage2_fingerprint: stage3.stage2_fingerprint, stage2_version: c.state?.stage2?.version || 0,
                stage3_version: c.state?.stage3?.version || 0 } };
    }
    const app = browserApp({ ...data, vendorDir });
    app.use(express.json({ limit: '64kb' }));
    const read = requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'read');
    const write = requireCriticalEmploymentDecisionRole;
    app.use('/api/prodhlomena-oraria/review', read, authorizeSessionCompany);
    const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (error) { res.status(error.statusCode || 500).json(reviewErrorResponse(error)); } };
    app.get('/api/prodhlomena-oraria/review/period-control/current', (_req,res) => res.json({ success: true,
        effective_mode: 'NORMAL', stored_status: 'OPEN', calculation: { authoritative_result: false },
        final_submission_summary: { period_start: '2026-09-01', period_end: '2026-09-30', branch: '0000' },
        allowed_actions: {} }));
    app.get('/api/prodhlomena-oraria/review', wrap(async (req,res) => {
        if (req.query.ypokatasthma !== '0000' || typeof req.query.kodikos !== 'string' || !/^\d{4}$/.test(req.query.kodikos))
            return res.status(400).json({ success: false });
        const employee = employees.find(e => e.kodikos === req.query.kodikos);
        if (!employee) return res.status(404).json({ success: false });
        const contexts = [];
        for (const start of starts) contexts.push(await context({ employee_id: String(employee._id), ypokatasthma: '0000',
            week_start: start, week_end: getMondaySundayWeekRange(start).weekEndKey }));
        const payloads = contexts.map(publicContext);
        const reviewRows = payloads.flatMap(p => p.rows);
        res.json({ success: true, rows: reviewRows, canonicalLifecycleProjections: payloads,
            deviations: appendStage4BlockedDeviationRows({ canonicalLifecycleProjections: payloads, reviewRows }) });
    }));
    app.get('/api/dropdown/ergazomenoi/kathgoria_adeias', (_req,res) => res.json({ items: [{ value: 'ΑΔΚΑΝ', label: 'Κανονική άδεια' }] }));
    app.get('/api/prodhlomena-oraria/review/orphan-quality-check', wrap(async (_req,res) =>
        res.json({ success: true, ...countOrphanHitsByEmployee(await D.find(base).lean()) })));
    app.get('/api/prodhlomena-oraria/review/weekly-hr-workflow/stage1', wrap(async (req,res) => res.json(publicContext(await context(req.query)))));
    app.post('/api/prodhlomena-oraria/review/weekly-hr-workflow/stage1/bulk-review', wrap(async (req,res) => {
        assert.ok(Array.isArray(req.body.scopes) && req.body.scopes.length <= 100);
        const payloads = []; for (const scope of req.body.scopes) payloads.push(publicContext(await context(scope)));
        res.json({ success: true, payloads });
    }));
    app.post('/api/prodhlomena-oraria/review/weekly-hr-workflow/stage1/bulk-complete', write, wrap(async (req,res) => {
        const result = await completeWeeklyHrWorkflowStage1Bulk({ ...req.body, actor,
            completeOne: ({ scope, reason_or_notes, request_id }) => complete(scope, reason_or_notes, request_id) });
        res.json({ success: true, ...result });
    }));
    app.post('/api/prodhlomena-oraria/review/repo-transfer-decisions', write, wrap(async (req,res) => {
        const row = await D.findOne({ ...base, _id: req.body.expected_source_id }).lean();
        if (!row) return res.status(404).json({ success: false });
        const range = getMondaySundayWeekRange(row.hmeromhnia);
        const input = { employee_id: String(row.employee_id), ypokatasthma: '0000', week_start: range.weekStartKey, week_end: range.weekEndKey };
        const result = await createWeeklyRepoTransferDecision({ session: data.session, payload: req.body,
            reconstruct: async () => {
                const fresh = await context(input);
                assert.equal(fresh.prepared.record?.proposal_id, req.body.proposal_id);
                return fresh.prepared.prepared;
            } });
        res.json({ success: true, ...result });
    }));
    app.post('/api/prodhlomena-oraria/review/weekly-hr-workflow/stage3/resolve-day', write, wrap(async (req,res) => {
        const initialContext = await stage3Context(req.body);
        const result = await resolveWeeklyHrStage3Day({ ...req.body, initialContext, actor,
            loadFreshContext: ({ session }) => stage3Context(req.body, session),
            loadPostWriteContext: ({ session }) => stage3Context(req.body, session),
            transactionRunner: async work => {
                const session = await mongoose.startSession();
                try { let result; await session.withTransaction(async () => { result = await work({ session }); }); return result; }
                finally { await session.endSession(); }
            } });
        res.json({ success: true, ...result });
    }));
    return { ...data, app, D, State, Audit, context, publicContext, complete, employees,
        repairSyntheticFirstWeek: async () => {
            await D.collection.updateOne({ ...base, kodikos: '0001', hmeromhnia: new Date('2026-09-01') }, { $set: { ores_ergasias: 8 } });
            await D.collection.updateOne({ ...base, kodikos: '0001', hmeromhnia: new Date('2026-09-03') }, { $set: { cards_apo_ora_01: '', cards_eos_ora_01: '' } });
        },
        snapshot: async () => JSON.stringify({ rows: await D.find({ ...base }).sort({ _id: 1 }).lean(),
            states: await State.find({ ...base }).sort({ _id: 1 }).lean(), audits: await Audit.find({ ...base }).sort({ _id: 1 }).lean(),
            decisions: await Decision.find({ ...base }).sort({ _id: 1 }).lean() }) };
}
module.exports = { createGuidanceFixture };
