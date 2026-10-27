'use strict';
// Real HTTP controllers, MongoDB commands, exports and Chromium. No app.js/.env/jobs/ERGANI.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const ExcelJS = require('exceljs');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const controller = require('../../server/controllers/ergazomenoi/erganhController');
const Frozen = require('../../server/models/apasxoliseisPeriodFrozenSnapshot');
const { CompaniesModel, YpokatasthmataModel } = require('../../server/models/companies');
const { PeriodsModel } = require('../../server/models/stathera_arxeia');
const { assertVerifiedHistoryCoverageForDate } = require('../../server/utils/ergazomenoi/employmentHistoryCoverage');
const uri = process.env.PAYROLL_STORED_READ_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('isolated MongoDB and Chromium: frozen v1/v2/v3, tenants, read commands, draft, exports and strict calculation', {
    skip: !uri || !vendor, timeout: 180000
}, async t => {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:27149\/payroll_period_employees_test_guidance_stored_[a-z0-9_]+\?replicaSet=payrollDraftTest$/);
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, monitorCommands: true });
    t.after(() => mongoose.disconnect());
    const data = await createStage1CompletionFixture(uri, vendor);
    const prefix = '/api/prodhlomena-oraria/review';
    data.app.get(prefix + '/export-excel', controller.exportProdhlomenaOrariaReviewExcel);
    data.app.get(prefix + '/export-pdf', controller.exportProdhlomenaOrariaReviewPdf);
    data.app.post(prefix + '/synthetic-calculate', (req, _res, next) => {
        req.programmataAccessScope = { effectiveTeam: data.session.userTeam,
            companyId: data.session.companyInUse, ypokatasthma: req.body.ypokatasthma,
            dateRange: { startDate: new Date(req.body.apo_hmeromhnia), endDate: new Date(req.body.eos_hmeromhnia) } };
        next();
    }, controller.calcApasxolhseisPeriodoy);
    const otherCompany = new mongoose.Types.ObjectId();
    await CompaniesModel.collection.insertOne({ _id: otherCompany, team: 'TEST', kod: '0002' });
    await YpokatasthmataModel.collection.insertMany(['0000', '0001'].map(kodikos => ({
        team: 'TEST', companykod_object: String(otherCompany), kodikos })));
    const cases = [];
    for (const company of [data.company, otherCompany]) for (const branch of ['0000', '0001']) {
        const base = { team: 'TEST', company_kod: String(company), ypokatasthma: branch };
        const employees = Array.from({ length: 5 }, (_, index) => ({ _id: new mongoose.Types.ObjectId(), ...base,
            kodikos: String(9001 + index), eponymo: 'ΣΗΜΕΡΙΝΟ ΟΝΟΜΑ', onoma: 'ΣΥΝΘΕΤΙΚΟ',
            oristikh_enhmerosh: true, energos: true, kathestos_apasxolhshs: '0',
            hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
            hmeromhnia_proslhpshs: new Date(index === 3 ? '2026-10-01' : '2026-01-01'),
            hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01'),
            ...(index === 2 ? { hmeromhnia_apoxorhshs: new Date('2026-09-01') } : {}),
            ...(index === 4 ? { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
                hmnia_enarxhs_daneismoy: new Date('2026-01-01'), afm_daneizomenoy_ergodoth: '000000000' } : {}) }));
        await data.E.collection.insertMany(employees);
        if (branch === '0000') await data.H.collection.insertOne({ ...base, kodikos: employees[1].kodikos,
            hmeromhnia_proslhpshs: new Date('2026-01-01'), afora_allagh_oron_ergasias: true,
            hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01'),
            hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 });
        for (const [version, month] of [[1, '06'], [2, '07'], [3, '08']]) {
            const last = month === '06' ? '30' : '31';
            const start = `2026-${month}-01`, end = `2026-${month}-${last}`, day = `2026-${month}-03`;
            const scope = { ...base, period_start: new Date(start), period_end: new Date(end) };
            const rows = employees.map((employee, index) => ({ _id: new mongoose.Types.ObjectId().toString(), ...base,
                employee_id: String(employee._id), kodikos: employee.kodikos, hmeromhnia: day,
                kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
                apo_ora_01: '08:00', eos_ora_01: '17:00', cards_apo_ora_01: '08:00', cards_eos_ora_01: '17:00',
                apo_ora_01_apologistika: '08:00', eos_ora_01_apologistika: '14:22',
                ores_ergasias: 8, cards_ores_ergasias: 9, ores_ergasias_apologistika: 6.37 + index,
                ores_pragmatikhs_ergasias_apologistika: 6.37 + index, is_locked: true }));
            const snapshot = { snapshot_schema_version: `employment-period-frozen:v${version}`,
                scope: { ...base, period_start: start, period_end: end }, daily_results: rows,
                employees: employees.map((employee, index) => ({ _id: String(employee._id), kodikos: employee.kodikos,
                    eponymo: 'ΠΑΓΩΜΕΝΟ ΟΝΟΜΑ', onoma: 'ΣΥΝΘΕΤΙΚΟ',
                    hmeromhnia_proslhpshs: index === 1 ? day : '2026-01-01',
                    ...(index === 2 ? { hmeromhnia_apoxorhshs: day } : {}),
                    ...(index === 4 ? { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false } : {}) })),
                canonical_decisions: [{ employee_kodikos: '9001', week_start: start, decision_type: 'STORED' }],
                applied_repo_transfers: [{ employee_kodikos: '9001', week_start: start, execution_status: 'APPLIED' }],
                deviations: [], payroll_results: [{ kodikos: '9001', plhroteo: 123.45 }] };
            if (version === 3) snapshot.weekly_calculation_context = { rows, profile_history: [] };
            const id = new mongoose.Types.ObjectId(), fingerprint = String(version).repeat(64);
            await Frozen.collection.insertOne({ _id: id, ...scope, frozen_snapshot: snapshot,
                frozen_snapshot_fingerprint: fingerprint, snapshot_schema_version: snapshot.snapshot_schema_version });
            await data.Period.collection.insertOne({ ...scope, status: 'FINALIZED', deadline: new Date('2026-10-31'),
                frozen_snapshot_id: id, frozen_snapshot_fingerprint: fingerprint, successful_calculation_version: 1 });
            // Current rows deliberately disagree. Frozen reads must never use them.
            await data.D.collection.insertMany(rows.map(row => ({ ...row, _id: new mongoose.Types.ObjectId(),
                hmeromhnia: new Date(day), ores_ergasias_apologistika: 99 })));
            cases.push({ company, branch, month, start, end, snapshot, employees });
        }
    }
    await PeriodsModel.collection.insertMany(['06', '07', '08'].map(month => ({ xrhsh: '2026', kodikos: month,
        apo: new Date(`2026-${month}-01`), eos: new Date(`2026-${month}-${month === '06' ? '30' : '31'}`) })));
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    let tracking = false;
    const commands = [];
    mongoose.connection.getClient().on('commandStarted', event => { if (tracking) commands.push(event); });
    const snapshotDb = async () => {
        const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
        const contents = {};
        for (const { name } of collections.sort((a,b) => a.name.localeCompare(b.name))) {
            if (!name.startsWith('system.')) contents[name] = await mongoose.connection.db.collection(name).find().sort({ _id: 1 }).toArray();
        }
        return JSON.stringify(contents);
    };
    const request = async (path, options) => {
        const response = await fetch(origin + prefix + path, options);
        assert.equal(response.status, 200, await response.clone().text()); return response;
    };
    for (const item of cases) await t.test(`v${item.snapshot.snapshot_schema_version.slice(-1)} company ${item.company} branch ${item.branch}`, async () => {
        Object.assign(data.session, { companyInUse: String(item.company), periodInUse: item.month });
        const params = new URLSearchParams({ apo_hmeromhnia: item.start, eos_hmeromhnia: item.end, ypokatasthma: item.branch });
        const before = await snapshotDb(); commands.length = 0; tracking = true;
        try {
            const result = await (await request('?' + params)).json();
            assert.equal(result.source, 'FROZEN_FINALIZED'); assert.equal(result.rows.length, 5);
            assert.equal(result.rows[0].ores_ergasias_apologistika, 6.37);
            assert.equal(result.rows[0].eponymo, 'ΠΑΓΩΜΕΝΟ ΟΝΟΜΑ');
            assert.ok(!commands.some(event => event.commandName === 'find' &&
                [data.E.collection.name, data.H.collection.name, data.D.collection.name].includes(event.command.find)));
            const scope = result.canonicalLifecycleProjections[0].scope;
            const single = await (await request('/weekly-hr-workflow/stage1?' + new URLSearchParams(scope))).json();
            assert.equal(single.rows[0].ores_ergasias_apologistika, 6.37);
            const bulk = await (await request('/weekly-hr-workflow/stage1/bulk-review', { method: 'POST',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ypokatasthma: item.branch, scopes: [scope] }) })).json();
            assert.equal(bulk.payloads.length, 1);
            assert.equal(Object.keys(bulk.payloads[0].lifecycle_projection.stages).length, 4);
            if (item.branch === '0000' && String(item.company) === String(data.company)) {
                const excel = Buffer.from(await (await request('/export-excel?' + params)).arrayBuffer());
                const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(excel);
                let found = false; workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => { if (cell.value === 6.37) found = true; })));
                assert.ok(found, 'Excel retains the frozen 6.37, not live 99');
                const pdf = Buffer.from(await (await request('/export-pdf?' + params)).arrayBuffer());
                assert.equal(pdf.subarray(0,4).toString(), '%PDF'); assert.ok(pdf.length > 1000);
            }
        } finally { tracking = false; }
        assert.deepEqual(commands.filter(event => ['insert','update','delete','findAndModify','create','drop','createIndexes','collMod'].includes(event.commandName)).map(event=>event.commandName), []);
        assert.equal(await snapshotDb(), before, 'all collections remain byte-for-byte equivalent');
    });
    await t.test('real Chromium loads the production Search and four stages from frozen v3 without writes', async () => {
        const item = cases.find(item => item.month === '08' && item.branch === '0000');
        Object.assign(data.session, { companyInUse: String(item.company), periodInUse: item.month });
        const before = await snapshotDb(); commands.length = 0; tracking = true;
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        try {
            await page.goto(origin + '/review');
            await page.waitForFunction(() => typeof loadResults === 'function');
            const result = await page.evaluate(async ({ start, end }) => {
                document.getElementById('apo_hmeromhnia').value = start;
                document.getElementById('eos_hmeromhnia').value = end;
                document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
                const success = await loadResults(); await loadPreparedWeeklyHrStage1();
                return { success, stages: Object.keys(currentCanonicalLifecyclePayloads[0].lifecycle_projection.stages),
                    hours: currentReviewRows[0].ores_ergasias_apologistika };
            }, item);
            assert.equal(result.success, true); assert.equal(result.hours, 6.37); assert.equal(result.stages.length, 4);
        } finally { tracking = false; await page.close(); }
        assert.equal(commands.filter(event => ['insert','update','delete','findAndModify'].includes(event.commandName)).length, 0);
        assert.equal(await snapshotDb(), before);
    });
    await t.test('real draft read and real new calculation with a genuine historical gap', async () => {
        Object.assign(data.session, { companyInUse: String(data.company), periodInUse: '09' });
        const employee = cases[0].employees[0];
        const row = { ...data.rows[0], _id: new mongoose.Types.ObjectId(), kodikos: employee.kodikos,
            employee_id: employee._id, hmeromhnia: new Date('2026-09-02'), ores_ergasias_apologistika: 6.37 };
        await data.D.collection.insertOne(row);
        assert.throws(() => assertVerifiedHistoryCoverageForDate('2026-09-02', [], employee), { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });
        const before = await snapshotDb(); commands.length = 0; tracking = true;
        try {
            const params = new URLSearchParams({ apo_hmeromhnia:'2026-09-01', eos_hmeromhnia:'2026-09-30', ypokatasthma:'0000' });
            const draft = await (await request('?' + params)).json();
            assert.equal(draft.rows.find(row => row.kodikos === employee.kodikos).ores_ergasias_apologistika, 6.37);
            assert.ok(draft.rows.some(row => row.kodikos === '0039'));
            assert.ok(draft.read_warnings.length);
            const empty = await (await request('?' + new URLSearchParams({ apo_hmeromhnia:'2026-09-01',
                eos_hmeromhnia:'2026-09-30', ypokatasthma:'0001' }))).json();
            assert.equal(empty.rows.length, 0);
        } finally { tracking = false; }
        assert.equal(commands.filter(event => ['insert','update','delete','findAndModify'].includes(event.commandName)).length, 0);
        assert.equal(await snapshotDb(), before);
        const savedRows = JSON.stringify(await data.D.find().sort({ _id:1 }).lean());
        const response = await fetch(origin + prefix + '/synthetic-calculate', { method:'POST',
            headers:{'Content-Type':'application/json'}, body:JSON.stringify({apo_hmeromhnia:'2026-09-01',eos_hmeromhnia:'2026-09-30',ypokatasthma:'0000'}) });
        const result = await response.json();
        assert.equal(response.status,409,JSON.stringify(result)); assert.equal(result.code,'EMPLOYEE_HISTORY_COVERAGE_REQUIRED');
        assert.equal(JSON.stringify(await data.D.find().sort({ _id:1 }).lean()),savedRows);
    });
});
