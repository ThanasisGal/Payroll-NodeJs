'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Types } = require('mongoose');
const User = require('../../models/userModel');
const { UserPrivilegesModel: Privileges } = require('../../models/privileges');
const { requireUserPrivilegeAction } = require('../../middlewares/requireUserPrivilegeForm');
const { createEmployeeHistoryReconstructionPreviewController: create } = require('./employeeHistoryReconstructionPreviewController');
const { planEmployeeHistoryAutomaticReconstruction: plan } = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const F = require('../../services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const employeeId = '507f1f77bcf86cd799439011', companyId = '507f1f77bcf86cd799439022';
const query = value => ({ select() { return this; }, mongooseOptions() { return this; }, lean: async () => value });
function setup(options = {}) {
    const input = options.input || F.caseA();
    input.scope = { team: 'THA', company_kod: companyId, kodikos: '0002' };
    Object.assign(input.currentEmployee, input.scope, { _id: new Types.ObjectId(employeeId) });
    input.completeHistoryRows.forEach(row => Object.assign(row, input.scope));
    const reads = [], plans = [];
    const req = { params: { id: employeeId }, session: { userId: 'authenticated-user', userTeam: 'THA', companyInUse: companyId },
        authenticatedUserTeam: 'THA', query: { team: 'forged-team', company_kod: 'forged-company', privileges: 'A' } };
    const res = { code: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; },
        status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
        send(body) { this.body = body; return this; } };
    const guard = model => new Proxy(model, { get(target, property) {
        if (property in target) return target[property];
        throw new Error(`Forbidden model operation: ${String(property)}`);
    } });
    const controller = create({
        employeeModel: guard({ findOne(filter) { reads.push(['employee', filter]); return query(options.employee === null ? null : input.currentEmployee); } }),
        companyModel: guard({ findOne(filter) { reads.push(['company', filter]); return query(options.company === null ? null : { _id: companyId }); } }),
        historyModel: guard({ db: {}, find(filter) { reads.push(['history', filter]); const q = query(input.completeHistoryRows);
            q.mongooseOptions = value => { reads.push(['options', value]); return q; }; return q; } }),
        loadCatalogs: async () => { reads.push(['catalogs']); return options.catalogs || {}; },
        referenceChecker: options.referenceChecker || (async ({ historyIds }) => { reads.push(['references', historyIds]); return []; }),
        ...(options.settlementProject ? { settlementProject: options.settlementProject } : {}),
        resolveBusinessDecision: options.resolveBusinessDecision === true,
        planner(args) { plans.push(args); if (options.throw) throw new Error('SECRET_PII_STACK'); return plan(args); }
    });
    return { input, reads, plans, req, res, controller };
}

test('scoped endpoint loads the complete physical History including redundant referenced artifacts with zero writes', async () => {
    const context = setup(), { input, controller, req, res, reads, plans } = context;
    input.completeHistoryRows.push({ ...F.row('0003'), ...input.scope,
        employment_history_canonical_status: 'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id: new Types.ObjectId(employeeId) });
    const before = structuredClone(input);
    await controller(req, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].completeHistoryRows.length, 3);
    assert.equal(plans[0].completeHistoryRows, input.completeHistoryRows);
    assert.ok(reads.some(([type, value]) => type === 'options' && value.includeRedundantHistoryArtifacts === true));
    assert.deepEqual(reads.find(([type]) => type === 'employee')[1], { _id: employeeId, team: 'THA', company_kod: companyId });
    assert.deepEqual(reads.find(([type]) => type === 'history')[1], input.scope);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.body.preview.originalRows.length, 3);
    assert.match(res.body.preview.originalRows.find(row => row.label === '0003').note, /δεν δημιουργεί νέα εργασιακή περίοδο/);
    assert.deepEqual(structuredClone(input), before);
    assert.doesNotMatch(JSON.stringify(res.body), /\b[a-f\d]{24}\b|fingerprint|sourceHistoryId|canonical|_id|fence|diagnostics/);
});

for (const [name, mutate, options, status] of [
    ['unauthenticated', req => { delete req.session.userId; }, {}, 401],
    ['untrusted team', req => { delete req.authenticatedUserTeam; }, {}, 403],
    ['wrong team', req => { req.authenticatedUserTeam = 'BLG'; }, {}, 404],
    ['missing company', req => { delete req.session.companyInUse; }, {}, 404],
    ['wrong company', () => {}, { company: null }, 404],
    ['wrong employee scope', () => {}, { employee: null }, 404],
    ['malformed employee identity', req => { req.params.id = { $ne: null }; }, {}, 404],
    ['query-shaped company', req => { req.session.companyInUse = { $ne: null }; }, {}, 404]
]) test(`${name} is denied before the planner and performs zero writes`, async () => {
    const { controller, req, res, plans } = setup(options); mutate(req);
    await controller(req, res);
    assert.equal(res.code, status);
    assert.equal(plans.length, 0);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Δεν έχει αποθηκευτεί.*\n1\..*\n2\..*Κωδικός αναφοράς/s);
});

test('authorized preview loads catalog descriptions read-only; denied requests never load catalogs', async () => {
    const context = setup({ catalogs: { KPK_EFKA: [{ code: '0111', label: 'Περιγραφή δοκιμής' }] } });
    context.input.completeHistoryRows[0].krathsh_01 = '0111';
    await context.controller(context.req, context.res);
    assert.equal(context.reads.filter(([kind]) => kind === 'catalogs').length, 1);
    assert.match(JSON.stringify(context.res.body.preview), /0111 - Περιγραφή δοκιμής/);
    const denied = setup(); delete denied.req.session.userId;
    await denied.controller(denied.req, denied.res);
    assert.equal(denied.reads.length, 0);
});

test('server failures expose a normal actionable Greek message without exception or data dumping', async () => {
    const { controller, req, res } = setup({ throw: true });
    await controller(req, res);
    assert.equal(res.code, 500);
    assert.match(res.body.message, /Ο έλεγχος του Ιστορικού δεν ολοκληρώθηκε/);
    assert.doesNotMatch(JSON.stringify(res.body), /SECRET|stack|Error/);
});

for (const [name, user, privilege, status] of [
    ['active user with read', { situation: 'A', team: 'THA' }, { privileges: { read: true } }, 200],
    ['active user with form admin', { situation: 'A', team: 'THA' }, { privileges: { admin: true } }, 200],
    ['inactive user', { situation: 'I', team: 'THA' }, { privileges: { read: true } }, 403],
    ['user missing read', { situation: 'A', team: 'THA' }, { privileges: { update: true } }, 403],
    ['missing user', null, { privileges: { read: true } }, 403]
]) test(`existing Employee read authorization: ${name}`, async () => {
    const { controller, req, res, plans } = setup(); delete req.authenticatedUserTeam;
    const userMock = mock.method(User, 'findById', () => query(user));
    const privilegeMock = mock.method(Privileges, 'findOne', filter => {
        assert.equal(filter.form, 'Ergazomenoi'); return query(privilege);
    });
    try {
        await requireUserPrivilegeAction('Ergazomenoi', 'read')(req, res, () => controller(req, res));
        assert.equal(res.code, status);
        assert.equal(plans.length, status === 200 ? 1 : 0);
    } finally { userMock.mock.restore(); privilegeMock.mock.restore(); }
});

test('GET route retains authentication and existing Employee read permission, with no write infrastructure', () => {
    const routes = readFileSync(__dirname + '/../../routes/usersRoute.js', 'utf8');
    assert.match(routes, /router\.get\(\s*'\/api\/ergazomenoi\/:id\/history-reconstruction-preview',\s*checkAuth,\s*requireUserPrivilegeAction\('Ergazomenoi', 'read'\),\s*employeeHistoryReconstructionPreview/);
    const source = readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
    assert.doesNotMatch(source, /\.(save|updateOne|updateMany|findOneAndUpdate|create|insertMany|bulkWrite|startSession|withTransaction|deleteOne|deleteMany)\s*\(/);
    assert.doesNotMatch(source, /console\.|logger\.|repairAudit|erganh/i);
});


test('preview markup and script use explicit approval without inline handlers or client physical plans', () => {
    const root = __dirname + '/../../..';
    const client = readFileSync(root + '/public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js', 'utf8');
    const partial = readFileSync(root + '/views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs', 'utf8');
    const modalStart = partial.indexOf('<div class="modal fade employee-history-preview"');
    assert.ok(modalStart >= 0);
    const modal = partial.slice(modalStart);
    assert.doesNotMatch(modal, /on(click|submit|change)=|style=|type="submit"|Αποθήκευση/);
    assert.doesNotMatch(client, /console\.|logger\.|sourceHistoryId|fingerprint|proposedRows|rowDiffs/);
    assert.match(client, /JSON\.stringify\(\{ previewToken, approvalAccepted: true \}\)/);
    assert.match(modal, /type="checkbox"/);
    assert.match(modal, /id="employeeHistoryReconstructionApplyBtn" disabled hidden/);
    assert.equal((client.match(/await fetch\(/g) || []).length, 2);
    const view = readFileSync(root + '/views/ergazomenoi/ergazomenoi/edit.ejs', 'utf8');
    assert.ok(view.indexOf("script('ergazomenoi/genika/employeeHistoryFieldLabels')") < view.indexOf("script('ergazomenoi/genika/istorikoTable')"));
    assert.ok(partial.includes('data-action="review"'));
});


test('settlement presentation reuses scoped GET, checks references read-only and emits no approval token', async () => {
    const c = setup(); c.req.query.presentation = 'settlement';
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 200);
    assert.equal(c.res.body.settlementPreview.previewOnly, true);
    assert.equal(c.reads.filter(([kind]) => kind === 'references').length, c.input.completeHistoryRows.length);
    assert.equal(c.plans.length, 0);
    assert.equal(c.res.body.previewToken, undefined);
    assert.equal(c.res.body.preview, undefined);
    assert.equal(c.res.body.executionMode, 'PREVIEW_ONLY');
    assert.equal(c.res.body.decisionEnabled, true);
    assert.equal(c.res.headers['Cache-Control'], 'no-store');
});
test('settlement reference lookup failure emits no partial proposal or technical details', async () => {
    const c = setup({ referenceChecker: async () => { throw Error('SECRET_REFERENCE'); } });
    c.req.query.presentation = 'settlement';
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 500);
    assert.equal(c.res.body.settlementPreview, undefined);
    assert.doesNotMatch(JSON.stringify(c.res.body), /SECRET_REFERENCE/);
});
test('unauthorized settlement presentation never checks references or plans', async () => {
    const c = setup(); c.req.query.presentation = 'settlement'; delete c.req.session.userId;
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 401);
    assert.equal(c.reads.length, 0);
});

test('resolve resets to a fresh read-only proposal using scoped reads and no execution token', async () => {
    const c = setup({ resolveBusinessDecision: true });
    c.req.body = { businessDecision: null };
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 200);
    assert.equal(c.res.body.executionMode, 'PREVIEW_ONLY');
    assert.equal(c.res.body.decisionEnabled, true);
    assert.equal(c.res.body.approvalFingerprint, undefined);
    assert.equal(c.reads.filter(([type]) => type === 'references').length, c.input.completeHistoryRows.length);
});
for (const body of [{}, { businessDecision: null, approval: {} }, [], null])
test(`resolve rejects malformed envelope ${JSON.stringify(body)} before any reads`, async () => {
    const c = setup({ resolveBusinessDecision: true }); c.req.body = body;
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 400);
    assert.equal(c.reads.length, 0);
});
test('resolve refuses arbitrary facts and choices instead of treating them as write instructions', async () => {
    for (const businessDecision of [{ facts: { departureDate: '2026-01-01' } }, { choiceId: 'FORGED' },
        { choiceId: 'KEEP_TWO_DAY_PROFILE', patch: {} }]) {
        const c = setup({ resolveBusinessDecision: true }); c.req.body = { businessDecision };
        await c.controller(c.req, c.res);
        assert.equal(c.res.code, 409);
        assert.equal(c.res.body.settlementPreview, undefined);
    }
});

test('normal resolve rebuilds a recorded whole-period choice with zero writes and no executable approval', async () => {
    const c = setup({ resolveBusinessDecision: true,
        input: require('../../../test/fixtures/employeeHistorySettlementDecisionFixture').settlementDecisionFixture(),
        referenceChecker: async () => [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic' }] });
    const before = JSON.stringify(c.input);
    c.req.body = { businessDecision: { choiceId: 'KEEP_FOUR_DAY_PROFILE' } };
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 200);
    assert.equal(c.res.body.settlementPreview.state, 'automatic');
    assert.equal(c.res.body.settlementPreview.choices.length, 1);
    assert.equal(c.res.body.executionMode, 'PREVIEW_ONLY');
    assert.equal(c.res.body.approvalFingerprint, undefined);
    assert.equal(JSON.stringify(c.input), before);
});

test('normal resolve projects the verified July split without changing source History or issuing an approval', async () => {
    const input = require('../../../test/fixtures/employeeHistoryPeriodSplitFixture').periodSplitFixture({ yearly: true });
    const c = setup({ resolveBusinessDecision: true, input,
        referenceChecker: async ({ historyIds }) => input.protectedReferenceSummary[String(historyIds[0])] });
    const before = JSON.stringify(input);
    c.req.body = { businessDecision: { choiceId: 'SPLIT_AT_2026_07_01' } };
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 200);
    const preview = c.res.body.settlementPreview;
    assert.equal(preview.state, 'split');
    assert.equal(preview.previewOnly, true);
    assert.equal(preview.executionEnabled, false);
    assert.deepEqual(preview.questions, []);
    assert.ok(preview.actions.includes('01/01/2026–30/06/2026: 2 ημέρες / 14 ώρες την εβδομάδα.'));
    assert.ok(preview.actions.includes('01/07/2026–31/12/2026: 4 ημέρες / 30 ώρες την εβδομάδα.'));
    assert.equal(c.res.body.executionMode, 'PREVIEW_ONLY');
    assert.equal(c.res.body.approvalFingerprint, undefined);
    assert.equal(c.res.body.previewToken, undefined);
    assert.doesNotMatch(JSON.stringify(preview), /proposedRows|proposalFingerprint|historyId|physicalPlan/);
    assert.equal(JSON.stringify(input), before);

    // A new read resets the choice; the preview never reuses an earlier approval.
    c.req.body = { businessDecision: null };
    await c.controller(c.req, c.res);
    assert.equal(c.res.body.settlementPreview.state, 'decision');
    assert.equal(c.res.body.businessDecision, undefined);
    assert.equal(c.res.body.approvalFingerprint, undefined);
    assert.equal(JSON.stringify(input), before);
});

test('normal split resolution fails safely when protected-reference evidence is unavailable', async () => {
    const c = setup({ resolveBusinessDecision: true,
        input: require('../../../test/fixtures/employeeHistoryPeriodSplitFixture').periodSplitFixture({ yearly: true }),
        referenceChecker: async () => [{ collection: 'Unknown', documentId: 'synthetic-unknown' }] });
    const before = JSON.stringify(c.input);
    c.req.body = { businessDecision: { choiceId: 'SPLIT_AT_2026_07_01' } };
    await c.controller(c.req, c.res);
    assert.ok(c.res.code !== 200 || c.res.body.settlementPreview.state === 'unknown');
    assert.equal(c.res.body.approvalFingerprint, undefined);
    assert.equal(JSON.stringify(c.input), before);
});

for (const question of [
    { id: 'departureDate', type: 'DATE' },
    { id: 'businessChoice', options: [{ id: 'split', inputs: [{ id: 'from', type: 'DATE' }] }] }
]) test(`normal form keeps unsupported ${question.id} decisions with the administrator`, async () => {
    const c = setup({ settlementProject: () => ({ state: 'decision', previewOnly: true,
        questions: [question], assumptions: [], actions: [] }) });
    c.req.query.presentation = 'settlement';
    await c.controller(c.req, c.res);
    assert.equal(c.res.code, 200);
    assert.deepEqual(c.res.body.settlementPreview, { state: 'unknown', previewOnly: true,
        questions: [], assumptions: [], actions: [] });
    assert.equal(c.res.body.executionMode, 'PREVIEW_ONLY');
});
