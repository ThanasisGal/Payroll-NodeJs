'use strict';
// Read-only preview benchmark. The fixture starts and verifies its own loopback
// mongod/PID/dbpath; no URI, .env, app.js or existing connection is accepted.
// Usage: PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD=/absolute/mongod node this-file
//        /absolute/source-root /tmp/report.json [empty|protected|dense]
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
if (process.argv.includes('--help')) {
    console.log('PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD=/absolute/mongod node ' + __filename +
        ' /absolute/source-root /tmp/report.json [empty|protected|dense]');
    process.exit(0);
}
const root = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const output = process.argv[3], scenario = process.argv[4] || 'empty';
assert.ok(output && path.isAbsolute(output), 'An absolute JSON report path is required');
assert.ok(['empty', 'protected', 'dense'].includes(scenario), 'Unknown synthetic scenario');
const appRequire = Module.createRequire(path.join(root, 'package.json'));
const commands = [], pendingCommands = new Map();
const loggerPath = path.join(root, 'server/utils/logger.js');
require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true,
    exports: { info() {}, warn() {}, error() {}, debug() {} } };
const analysis = {};
if (process.env.PAYROLL_HISTORY_READ_PROFILE === 'true') {
    for (const [file, name] of [
        ['employeeHistoryProposalReadService', 'proposalHistoryState'],
        ['employeeApprovedHistoryMaintenanceBaselineService', 'assessApprovedMaintenanceBaseline'],
        ['employeeApprovedHistoryChangeIntentService', 'planApprovedHistoryChangeIntent'],
        ['employeeApprovedHistoryAtomicProposalService', 'prepareApprovedHistoryAtomicProposal']
    ]) {
        const owner = appRequire('./server/services/ergazomenoi/' + file), original = owner[name];
        owner[name] = (...args) => {
            const start = performance.now();
            try { return original(...args); }
            finally { const item = analysis[name] ||= { calls: 0, durationMs: 0 };
                item.calls++; item.durationMs += performance.now() - start; }
        };
    }
}
const harnessFile = path.join(root, 'test/integration/employeeApprovedHistoryFullFormMongo.test.js');
let source = fs.readFileSync(harnessFile, 'utf8');
source = source.slice(0, source.indexOf("test('Πλήρης φόρμα"));
source = source.replace('correctionCatalogLoader: async () => F.catalogs,', 'correctionCatalogLoader: db.readCatalogs,');
const harness = new Module(harnessFile, module);
harness.filename = harnessFile; harness.paths = Module._nodeModulePaths(path.dirname(harnessFile));
harness._compile(source + '\nmodule.exports = { seed, controller };', harnessFile);
const { seed, controller } = harness.exports;
const mongoose = appRequire('mongoose');
const F = appRequire('./test/fixtures/employee0002HistoryProposalFixture');
const makeFixture = F.employee0002HistoryProposalFixture;
F.employee0002HistoryProposalFixture = options => {
    const input = makeFixture(options), row = input.completeHistoryRows[2];
    const fourth = { ...row, _id: '650000000000000000000044', aa_eggrafhs: '0004',
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-08-01'),
        hmeromhnia_allaghs_symbashs: new Date('2026-08-01') };
    row.hmeromhnia_isxyos_oron_ergasias_eos = new Date('2026-07-31');
    input.completeHistoryRows.push(fourth);
    input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-08-01');
    input.currentEmployee.hmeromhnia_allaghs_symbashs = new Date('2026-08-01');
    return input;
};
async function main() {
    const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
    assert.ok(binary && path.isAbsolute(binary), 'An explicit local test mongod binary is required');
    const db = await appRequire('./test/fixtures/employeeHistoryApprovedProposalMongo').startApprovedProposalMongo(binary);
    let h;
    try {
        const base = appRequire('./server/models/ergazomenoi');
        for (const [key, model] of Object.entries({ scheduleModel: base.ProdhlomenaOrariaModel,
            branchModel: appRequire('./server/models/companies').YpokatasthmataModel })) {
            db[key] = db.connection.model(model.modelName, model.schema.clone()); await db[key].createCollection();
        }
        const stathera = appRequire('./server/models/stathera_arxeia'), symbaseis = appRequire('./server/models/symbaseis');
        const models = { kpkModel: stathera.KpkEfkaModel, specialCategoryModel: stathera.EidikesKathgoriesModel,
            contractTypeModel: symbaseis.SymbaseisModel, contractCategoryModel: symbaseis.KathgoriesSymbaseonModel,
            contractSpecialtyModel: symbaseis.EidikothtesAnaKathgoriaSymbaseonModel, contractItemModel: symbaseis.StoixeiaSymbaseonModel };
        const names = ['KPK_EFKA','SPECIAL_EMPLOYEE_CATEGORY','CONTRACT_TYPE','CONTRACT_CATEGORY','CONTRACT_SPECIALTY','CONTRACT_ITEM'];
        const parents = appRequire('./server/services/ergazomenoi/employeeContractDescriptionService').PARENT_FIELDS;
        let i = 0;
        for (const [key, model] of Object.entries(models)) {
            models[key] = db.connection.model(model.modelName, model.schema.clone()); await models[key].createCollection();
            const name = names[i++];
            await models[key].collection.insertMany(F.catalogs[name].map(item => ({ kodikos: item.code,
                perigrafh: item.label, ...(parents[name] ? { [parents[name]]: item[parents[name]] } : {}) })));
        }
        db.readCatalogs = options => appRequire('./server/services/ergazomenoi/employeeHistoryCorrectionCatalogService')
            .loadEmployeeHistoryCorrectionCatalogs({ ...options, ...models });
        const f = await seed(db);
        if (scenario !== 'protected') {
            // Remove only seeded documents in the owned temporary database.
            await db.frozenModel.collection.deleteMany({}); await db.periodControlModel.collection.deleteMany({});
        }
        if (scenario === 'dense') {
            const rows = (await f.input()).completeHistoryRows;
            for (const [collection, fields] of appRequire('./server/services/ergazomenoi/employeeHistoryReferenceAuditService').REFERENCE_QUERIES) {
                const documents = rows.map(row => {
                    const document = { _id: new mongoose.Types.ObjectId() };
                    let cursor = document;
                    const parts = fields[0].split('.');
                    for (const part of parts.slice(0, -1)) cursor = cursor[part] = {};
                    cursor[parts.at(-1)] = String(row._id);
                    return document;
                });
                await db.connection.collection(collection).insertMany(documents);
            }
        }
        h = await controller(db, f);
        const request = await h.payload('NEW_CHANGE', { hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH',
            ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 6.67 });
        const measuredRequest = h.requests;
        // Measure the captured production writer request without HTTP overhead or
        // development-only diagnostics. Driver events provide physical query counts/times.
        const initial = await h.submit(request); assert.equal(initial.body.success, true, JSON.stringify(initial));
        const args = measuredRequest[0];
        const writer = appRequire('./server/services/ergazomenoi/employeeEmploymentProfileWriter');
        const invoke = () => writer.writeEmployeeMaintenance({ ...db, ...args, correctionCatalogLoader: db.readCatalogs,
                    approvedHistoryServiceFactory: options => appRequire('./server/services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService')
                        .createApprovedHistoryAtomicMaintenanceService({ ...db, ...options, enabled: () => true,
                            secret: 'synthetic-full-form-atomic-secret-32' }) });
        const before = await appRequire('./test/fixtures/employeeHistoryLegacyStructure').rawState(f);
        const client = db.connection.getClient();
        client.on('commandStarted', event => {
            const command = { name: event.commandName,
                collection: typeof event.command[event.commandName] === 'string' ? event.command[event.commandName] : undefined };
            commands.push(command); pendingCommands.set(event.requestId, command);
        });
        const completed = event => {
            const command = pendingCommands.get(event.requestId);
            if (command) { command.durationMs = event.duration; pendingCommands.delete(event.requestId); }
        };
        client.on('commandSucceeded', completed); client.on('commandFailed', completed);
        const results = [];
        for (let sample = 0; sample < 4; sample++) {
            commands.length = 0; pendingCommands.clear(); const start = performance.now();
            for (const key of Object.keys(analysis)) delete analysis[key];
            const value = await invoke(); assert.equal(value.success, true); assert.equal(value.preflight, true);
            assert.ok(!commands.some(command => ['insert', 'update', 'delete', 'findAndModify'].includes(command.name)));
            results.push({ wallMs: performance.now() - start,
                commands: [...commands], analysis: structuredClone(analysis), status: value.status, decision: value.decision });
        }
        assert.deepEqual(await appRequire('./test/fixtures/employeeHistoryLegacyStructure').rawState(f), before);
        assert.equal(mongoose.connection.readyState, 0);
        const measured = results.slice(1); // Initial HTTP plus first direct call warm up the same path.
        const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const referenceCollections = new Set(appRequire('./server/services/ergazomenoi/employeeHistoryReferenceAuditService')
            .REFERENCE_QUERIES.map(([collection]) => collection));
        const referenceReads = value => value.commands.filter(command =>
            command.name === 'find' && referenceCollections.has(command.collection));
        const summary = { scenario, samples: measured.length, wallMs: median(measured.map(value => value.wallMs)),
            analysis: measured.map(value => value.analysis),
            commandCount: measured.map(value => value.commands.length),
            referenceQueryCount: measured.map(value => referenceReads(value).length),
            referenceCommandMs: median(measured.map(value => referenceReads(value)
                .reduce((total, command) => total + command.durationMs, 0))) };
        fs.writeFileSync(output, JSON.stringify({ root, scenario, ownedMongo: db.folder, node: process.version,
            summary, samples: results }, null, 2));
        console.log(JSON.stringify({ output, ...summary }, null, 2));
    } finally { F.employee0002HistoryProposalFixture = makeFixture; await h?.close(); await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
