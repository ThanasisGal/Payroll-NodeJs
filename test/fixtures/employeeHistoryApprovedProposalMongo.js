'use strict';
// Own a brand-new loopback mongod and temp dbpath. Never accept a URI, use .env,
// attach to an existing server, or touch the application's default connection.
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const net = require('node:net'), { spawn } = require('node:child_process');
const { once } = require('node:events'), assert = require('node:assert/strict');
const mongoose = require('mongoose');
async function startApprovedProposalMongo(binary) {
    assert.ok(path.isAbsolute(binary)); await fs.access(binary);
    const artifacts = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_ARTIFACT_DIR || os.tmpdir();
    await fs.mkdir(artifacts, { recursive: true });
    const folder = await fs.mkdtemp(path.join(artifacts, 'payroll-approved-proposal-mongo-'));
    const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const port = server.address().port; await new Promise(resolve => server.close(resolve));
    const child = spawn(binary, ['--dbpath', folder, '--port', String(port), '--bind_ip', '127.0.0.1',
        '--replSet', 'payrollApprovedProposalTest', '--setParameter', 'enableTestCommands=1', '--logpath', path.join(folder, 'mongod.log')], { stdio: 'ignore' });
    child.on('error', () => {});
    let connection;
    const close = async () => {
        await connection?.close();
        if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
    };
    try {
        const client = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 10000 });
        await client.connect();
        assert.equal((await client.db('admin').command({ serverStatus: 1 })).pid, child.pid);
        const options = await client.db('admin').command({ getCmdLineOpts: 1 });
        assert.equal(options.parsed.storage.dbPath, folder);
        await client.db('admin').command({ replSetInitiate: { _id: 'payrollApprovedProposalTest', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
        await client.close();
        connection = await mongoose.createConnection(`mongodb://127.0.0.1:${port}/payroll_approved_proposal_test?replicaSet=payrollApprovedProposalTest`, {
            autoIndex: false, autoCreate: false, monitorCommands: true, serverSelectionTimeoutMS: 15000
        }).asPromise();
        assert.equal(connection.host, '127.0.0.1'); assert.equal(connection.port, port);
        assert.equal(connection.name, 'payroll_approved_proposal_test');
        const sources = {
            employeeModel: require('../../server/models/ergazomenoi').ErgazomenoiModel,
            historyModel: require('../../server/models/ergazomenoi').IstorikoProslhpseonAllagonModel,
            auditModel: require('../../server/models/employeeHistoryRepairAudit'), userModel: require('../../server/models/userModel'),
            privilegeModel: require('../../server/models/privileges').UserPrivilegesModel,
            companyModel: require('../../server/models/companies').CompaniesModel,
            periodControlModel: require('../../server/models/apasxoliseisPeriodControl'), frozenModel: require('../../server/models/apasxoliseisPeriodFrozenSnapshot')
        };
        const models = {};
        for (const [key, source] of Object.entries(sources)) {
            models[key] = connection.model(source.modelName, source.schema.clone());
            await models[key].createCollection();
            assert.equal(models[key].db, connection);
        }
        await models.auditModel.createIndexes(); await models.periodControlModel.createIndexes();
        return { connection, ...models, folder, close };
    } catch (error) { await close(); throw error; }
}
async function seedApprovedProposal(db, { insert = false, employeeCode = '0099' } = {}) {
    const { fixture } = require('./employeeProfileTransactionStore');
    const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
    const { catalogs } = require('./employee0002HistoryProposalFixture');
    const initial = fixture();
    const scope = { team: 'THA', company_kod: String(new mongoose.Types.ObjectId()), kodikos: employeeCode };
    const employee = { ...initial.employee, ...scope, _id: new mongoose.Types.ObjectId(), ypokatasthma: '0001', oristikh_enhmerosh: true };
    const history = initial.history.filter((row, index) => !insert || index !== 1).map(row => ({ ...row, ...scope, _id: new mongoose.Types.ObjectId() }));
    const actor = new mongoose.Types.ObjectId();
    await db.employeeModel.collection.insertOne(employee); await db.historyModel.collection.insertMany(history);
    await db.companyModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(scope.company_kod), team: scope.team, kod: '9999' });
    await db.userModel.collection.insertOne({ _id: actor, team: 'THA', privileges: 'A', situation: 'A' });
    await db.privilegeModel.collection.insertOne({ userId: String(actor), form: 'Ergazomenoi', privileges: { update: true } });
    await db.periodControlModel.collection.insertOne({ team: scope.team, company_kod: scope.company_kod, ypokatasthma: '0001',
        period_start: new Date('2026-01-01'), period_end: new Date('2026-12-31'), status: 'OPEN' });
    const req = { sessionID: 'synthetic-approved-' + actor, params: { id: String(employee._id) },
        session: { userId: String(actor), userTeam: scope.team, companyInUse: scope.company_kod } };
    const dependencies = { ...db, approvalSecret: 'synthetic-approved-proposal-secret-32-characters', isEnabled: () => true,
        loadCatalogs: async () => catalogs, loadSchedules: async () => [] };
    const input = async () => {
        const query = db.historyModel.find(scope); query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
        const rows = await query.select('+history_reference_fence').lean(), references = {};
        for (const row of rows) references[String(row._id)] = await require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService')
            .findHistoryIdReferences({ connection: db.connection, historyIds: [String(row._id)] });
        return { scope, currentEmployee: await db.employeeModel.findById(employee._id).select('+employee_profile_mutation_sequence').lean(),
            completeHistoryRows: rows, protectedReferenceSummary: references, companyBusinessCode: '9999', predeclaredScheduleRows: [] };
    };
    const snapshot = async () => A.stringify({ current: await db.employeeModel.collection.findOne({ _id: employee._id }),
        history: await db.historyModel.collection.find(scope).sort({ _id: 1 }).toArray(),
        audits: await db.auditModel.collection.find({ 'employeeScope.employee_id': employee._id }).toArray(),
        controls: await db.periodControlModel.collection.find({ company_kod: scope.company_kod }).toArray() });
    return { req, scope, employee, history, actor, dependencies, catalogs, input, snapshot };
}
async function approvedProposalBody(f, { insert = false, values = { nomimosMisthos: '1456,78' } } = {}) {
    const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
    const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
    const input = await f.input(); let selection = `UPDATE:${f.history[0]._id}`;
    if (insert) {
        const cases = (await X.buildEmployeeHistoryProposalWorkbook(input, f.catalogs)).caseSelection.cases;
        selection = `INSERT:${cases.find(item => item.operation === 'INSERT').id}`;
    }
    const baseline = await X.buildEmployeeHistoryProposalWorkbook(input, f.catalogs, { selection }), model = E.editorModel(baseline, f.catalogs);
    const entries = baseline.editableCells;
    const controls = new Map(model.rows.filter(row => row.control).map(row => [row.control.index, row.control]));
    const raw = { ...values, EVIDENCE: 'Συνθετικό υπογεγραμμένο τεκμήριο Α1', DECLARATION: '1' };
    const changes = entries.flatMap((entry, index) => {
        const key = entry.canonicalField || entry.role;
        if (!insert && !Object.hasOwn(raw, key)) return [];
        const value = Object.hasOwn(raw, key) ? raw[key] : controls.get(index).value;
        return [{ index, value: value === '-1' || value === null || value === undefined ? '' : value }];
    });
    return { selection, completion: { caseId: baseline.caseSelection.selectedCase.id, snapshotFingerprint: baseline.snapshotFingerprint,
        context: E.editorContext(f.req, baseline.snapshotFingerprint, baseline.caseSelection.selectedCase.id), changes } };
}
module.exports = { startApprovedProposalMongo, seedApprovedProposal, approvedProposalBody };

async function startApprovedProposalHttp(f, service) {
    const express = require('express'), app = express(); app.set('view engine', 'ejs');
    app.set('views', path.resolve(__dirname, '../../views')); app.use(express.json());
    app.use((req, res, next) => {
        req.session = f.req.session; req.sessionID = f.req.sessionID; res.locals.csrfToken = 'synthetic-approved-csrf';
        if (req.method === 'POST' && req.get('X-CSRF-Token') !== res.locals.csrfToken) return res.status(403).json({ success: false });
        next();
    });
    app.use('/static', express.static(path.resolve(__dirname, '../../public')));
    const render = async (req, res, next) => { try {
        await require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService').respondEmployeeHistoryProposal(req, res,
            await f.input(), f.catalogs, { loadImportProtection: args => require('../../server/services/ergazomenoi/employeeHistoryProposalImportProtectionService')
                .readImportProtection(args, f.dependencies) });
    } catch (error) { next(error); } };
    require('../../server/routes/employeeHistorySettlementRoutes').registerEmployeeHistorySettlementRoutes(app, {
        checkAuth: (req, res, next) => req.session?.userId ? next() : res.status(401).end(),
        requireUserPrivilegeAction: () => (req, res, next) => next(),
        controller: { exportXlsx: render, resolve: (req, res) => res.status(405).end(), apply: (req, res) => res.status(405).end() },
        approvedProposalController: require('../../server/controllers/ergazomenoi/employeeHistoryApprovedProposalController')
            .createEmployeeHistoryApprovedProposalController({ service })
    });
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    return { origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
module.exports.startApprovedProposalHttp = startApprovedProposalHttp;
