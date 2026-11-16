'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startApprovedProposalMongo, seedApprovedProposal, approvedProposalBody, startApprovedProposalHttp } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const P = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const approve = (proposal, preview) => ({ proposal, approval: { token: preview.approval.token, confirmed: true } });
const proxy = (model, overrides) => new Proxy(model, { get(target, key) {
    if (Object.hasOwn(overrides, key)) return overrides[key];
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
} });

test('Εγκεκριμένα ΜΕΤΑ: πραγματικές απομονωμένες συναλλαγές, προστασίες και συμφωνία αποτελέσματος', { skip: !binary, timeout: 180000 }, async t => {
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    console.log(`Απομονωμένη MongoDB και αρχεία καταγραφής: ${db.folder}`);
    const commands = [];
    db.connection.getClient().on('commandStarted', event => commands.push({ name: event.commandName,
        transaction: event.command.autocommit === false, session: JSON.stringify(event.command.lsid), number: String(event.command.txnNumber) }));
    for (const observation of ['', '-', '  Ελεύθερη παρατήρηση χωρίς παραπομπή  ', 'x'.repeat(4000)])
        await t.test(`Προαιρετική αιτιολογία ${observation.length} χαρακτήρων: ακριβής υπογραφή και audit`, async () => {
            const f=await seedApprovedProposal(db),service=create(f.dependencies);
            const proposal=await approvedProposalBody(f,{values:{nomimosMisthos:'1456,78',EVIDENCE:observation}});
            const before=await f.snapshot(),preview=await service.preview(f.req,proposal);
            assert.equal(preview.evidence,observation);assert.equal(preview.approved,true);assert.equal(await f.snapshot(),before);
            const payload=P.verify(preview.approval.token,f.dependencies.approvalSecret);
            assert.equal(payload.approved,true);assert.equal(payload.requestHash,A.hash(proposal));
            const edited=structuredClone(proposal);edited.completion.changes.find(change=>change.index===proposal.completion.changes.at(-2).index).value='άλλη παρατήρηση';
            await assert.rejects(service.apply(f.req,approve(edited,preview)),error=>error.reason==='APPROVAL');
            await service.apply(f.req,approve(proposal,preview));
            const audit=await db.auditModel.findOne({'employeeScope.employee_id':f.employee._id}).lean();
            assert.equal(Object.hasOwn(audit.diagnostics,'evidence'),true);
            assert.equal(audit.diagnostics.evidence,observation);assert.equal(audit.diagnostics.declaration,'Ναι');
            assert.equal(audit.diagnostics.requestHash,A.hash(proposal));
        });
    await t.test('Παράλειψη αιτιολογίας διατηρεί ακριβώς κενό audit, χωρίς επινόηση',async()=>{
        const f=await seedApprovedProposal(db),service=create(f.dependencies),proposal=await approvedProposalBody(f);
        proposal.completion.changes.splice(-2,1);
        const preview=await service.preview(f.req,proposal);assert.equal(preview.evidence,'');
        await service.apply(f.req,approve(proposal,preview));
        const audit=await db.auditModel.findOne({'employeeScope.employee_id':f.employee._id}).lean();
        assert.equal(audit.diagnostics.evidence,'');assert.equal(audit.diagnostics.declaration,'Ναι');
    });
    await t.test('Όχι ή παράλειψη έγκρισης: διαθέσιμη προεπισκόπηση, απαγόρευση εγγραφής και ακύρωση προηγούμενης υπογραφής',async()=>{
        const f=await seedApprovedProposal(db),service=create(f.dependencies),proposal=await approvedProposalBody(f);
        const yes=await service.preview(f.req,proposal),before=await f.snapshot();
        const no=structuredClone(proposal);no.completion.changes.at(-1).value='0';
        const preview=await service.preview(f.req,no);assert.equal(preview.approved,false);assert.equal(preview.executionEnabled,false);
        await assert.rejects(service.apply(f.req,approve(no,preview)),error=>error.reason==='APPROVAL_REQUIRED');
        await assert.rejects(service.apply(f.req,approve(no,yes)),error=>error.reason==='APPROVAL');
        no.completion.changes.pop();
        const omitted=await service.preview(f.req,no);assert.equal(omitted.declaration,'Όχι');
        await assert.rejects(service.apply(f.req,approve(no,omitted)),error=>error.reason==='APPROVAL_REQUIRED');
        for(const value of ['', 'Δηλώνω τεκμηριωμένα στοιχεία','Ναι','2']){
            const invalid=structuredClone(proposal);invalid.completion.changes.at(-1).value=value;
            await assert.rejects(service.preview(f.req,invalid),error=>error.reason==='VALUE');
        }
        assert.equal(await f.snapshot(),before);
    });
    await t.test('Πραγματικό INCOMPLETE: ακριβώς οι αποτυχημένες αποδοχές, ασφαλής απόκριση και αμετάβλητη βάση',async()=>{
        const f=await seedApprovedProposal(db),service=create(f.dependencies);
        const proposal=await approvedProposalBody(f,{values:{nomimosMisthos:'0',pragmatikosMisthos:'0',EVIDENCE:''}});
        const before=await f.snapshot();let rejected;
        await assert.rejects(service.preview(f.req,proposal),error=>{rejected=error;return error.reason==='INCOMPLETE';});
        assert.deepEqual(rejected.problems.map(item=>item.fieldId),['nomimosMisthos','pragmatikosMisthos']);
        const response={set(){return this;},status(value){this.statusCode=value;return this;},json(value){return value;}};
        const body=require('../../server/controllers/ergazomenoi/employeeHistoryApprovedProposalController').sendFailure(response,rejected,'preview');
        assert.equal(body.saved,false);assert.equal(response.statusCode,422);
        assert.ok(body.problems.every(item=>item.field&&item.problem&&item.cause&&item.action));
        assert.doesNotMatch(JSON.stringify(body),new RegExp(String(f.history[0]._id)));
        const generic=require('../../server/controllers/ergazomenoi/employeeHistoryApprovedProposalController').sendFailure(response,P.failure('INCOMPLETE',422),'preview');
        assert.deepEqual(generic.problems,[]);assert.match(generic.message,/Κωδικός αναφοράς/);
        assert.equal(await f.snapshot(),before);
    });
    for(const insert of [false,true])await t.test(`Παλαιό XLSX ${insert?'INSERT':'UPDATE'} σε MongoDB: όλα τα ΜΕΤΑ διατηρούνται μέχρι τη νέα ρητή έγκριση`,async()=>{
        const f=await seedApprovedProposal(db,{insert}),service=create(f.dependencies);
        const X=require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
        const E=require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
        const proposal=await approvedProposalBody(f,{insert,values:{nomimosMisthos:'1234,56',EVIDENCE:'-'}});
        const input=await f.input(),legacy=await X.buildEmployeeHistoryProposalWorkbook(input,f.catalogs,{selection:proposal.selection,legacyLayout:true});
        E.applyLocalCompletion(legacy,proposal.completion,f.req,f.catalogs);
        const imported=await require('../../server/services/ergazomenoi/employeeHistoryProposalImportService').previewEmployeeHistoryProposalImport({
            buffer:await X.serializeEmployeeHistoryProposalWorkbook(legacy.workbook),input,catalogs:f.catalogs,req:f.req,
            loadProtection:args=>require('../../server/services/ergazomenoi/employeeHistoryProposalImportProtectionService').readImportProtection(args,f.dependencies)});
        assert.equal(imported.declaration,'Όχι');
        const baseline=await X.buildEmployeeHistoryProposalWorkbook(input,f.catalogs,{selection:proposal.selection});
        const byField=new Map(imported.editorValues.values.map(item=>[item.fieldId,item.value]));
        proposal.completion.changes=baseline.editableCells.map((entry,index)=>{
            const raw=byField.get(entry.canonicalField||entry.fieldId),choices=E.editorChoices(entry,f.catalogs);
            const value=raw===null?'':choices.length?String(choices.findIndex(option=>A.equal(option.id,raw))):raw;
            return {index,value};
        });
        const before=await f.snapshot(),unapproved=await service.preview(f.req,proposal);
        assert.equal(unapproved.executionEnabled,false);
        await assert.rejects(service.apply(f.req,approve(proposal,unapproved)),error=>error.reason==='APPROVAL_REQUIRED');
        assert.equal(await f.snapshot(),before);
        const business=structuredClone(proposal.completion.changes.slice(0,-1));
        proposal.completion.changes.at(-1).value='1';
        assert.deepEqual(proposal.completion.changes.slice(0,-1),business);
        const preview=await service.preview(f.req,proposal);await service.apply(f.req,approve(proposal,preview));
        const audit=await db.auditModel.findOne({'employeeScope.employee_id':f.employee._id}).lean();
        assert.equal(audit.diagnostics.actualAfter.nomimosMisthos,1234.56);
        assert.equal(audit.diagnostics.evidence,'-');assert.equal(audit.diagnostics.declaration,'Ναι');
    });
    await t.test('UPDATE μόνο εγκεκριμένου πεδίου, ατομικό audit και ασφαλές ίδιο αίτημα', async () => {
        const f = await seedApprovedProposal(db), service = create(f.dependencies), proposal = await approvedProposalBody(f);
        const before = await f.snapshot(), readStart = commands.length, preview = await service.preview(f.req, proposal);
        assert.equal(commands.slice(readStart).some(command => ['insert', 'update', 'delete', 'findAndModify'].includes(command.name)), false);
        assert.equal(preview.executionEnabled, true); assert.equal(await f.snapshot(), before);
        assert.deepEqual(preview.rows.map(row => row.fieldId), ['nomimosMisthos']);
        const start = commands.length, result = await service.apply(f.req, approve(proposal, preview));
        assert.equal(result.applied, true); assert.equal(result.historyStatus, 'REVIEW_REQUIRED');
        const stored = await db.historyModel.collection.findOne({ _id: f.history[0]._id });
        const { updatedAt, ...actual } = stored, { updatedAt: previousRevision, ...original } = f.history[0];
        assert.ok(updatedAt > previousRevision);
        assert.deepEqual(actual, { ...original, nomimosMisthos: 1456.78 });
        assert.deepEqual(await db.historyModel.collection.findOne({ _id: f.history[1]._id }), f.history[1]);
        const audits = await db.auditModel.find({ 'employeeScope.employee_id': f.employee._id }).lean();
        assert.equal(audits.length, 1); assert.equal(audits[0].diagnostics.outcome, 'COMMITTED');
        assert.equal(audits[0].diagnostics.actorUserId, String(f.actor));
        assert.deepEqual(audits[0].currentBefore, f.employee);
        assert.equal(audits[0].diagnostics.actualBefore.nomimosMisthos, 1200);
        assert.equal(audits[0].diagnostics.actualAfter.nomimosMisthos, 1456.78);
        const transaction = commands.slice(start).filter(command => command.transaction);
        assert.equal(transaction.filter(command => command.name === 'commitTransaction').length, 1);
        assert.equal(new Set(transaction.map(command => command.session + ':' + command.number)).size, 1);
        const saved = await f.snapshot(), duplicate = await service.apply(f.req, approve(proposal, preview));
        assert.equal(duplicate.alreadyApplied, true); assert.equal(await f.snapshot(), saved);
        assert.equal((await service.reconcile(f.req, { proposal, token: preview.approval.token })).reconciledReadOnly, true);
        assert.equal(await f.snapshot(), saved);
    });
    await t.test('INSERT μία ακριβής περίοδος, κοινή αρίθμηση και καμία προεπιλεγμένη οικονομική τιμή', async () => {
        const f = await seedApprovedProposal(db, { insert: true }), service = create(f.dependencies);
        const proposal = await approvedProposalBody(f, { insert: true, values: { nomimosMisthos: '1456,78', dialleima_se_lepta: '30' } }), preview = await service.preview(f.req, proposal);
        const result = await service.apply(f.req, approve(proposal, preview)); assert.equal(result.operation, 'INSERT');
        const rows = await db.historyModel.collection.find(f.scope).toArray(); assert.equal(rows.length, 3);
        const added = rows.find(row => !f.history.some(old => String(old._id) === String(row._id)));
        assert.equal(String(added._id), result.targetHistoryId); assert.equal(added.aa_eggrafhs, '0004');
        assert.equal(added.hmeromhnia_isxyos_oron_ergasias_apo.toISOString(), '2026-02-01T00:00:00.000Z');
        assert.equal(added.hmeromhnia_isxyos_oron_ergasias_eos.toISOString(), '2026-02-28T00:00:00.000Z');
        assert.equal(added.afora_proslhpsh, false); assert.equal(Object.hasOwn(added, 'hmeromhnia_apoxorhshs'), false);
        assert.equal(Object.hasOwn(added, 'employment_profile_source'), false);
        for (const row of f.history) assert.deepEqual(rows.find(item => String(item._id) === String(row._id)), row);
        const Profile = require('../../server/utils/ergazomenoi/employmentProfileContract');
        assert.equal(Profile.readEmploymentProfile(added).recorded, true);
        const resolved = require('../../server/utils/ergazomenoi/employmentProfileHistory').resolveEmploymentProfileFactsForDate('2026-02-15', rows, { currentEmployee: f.employee });
        assert.equal(resolved.recorded, true); assert.equal(String(resolved.historyId), String(added._id));
        const breaks = require('../../server/utils/ergazomenoi/resolveBreakConfigurationForDate').resolveBreakConfigurationForDate;
        assert.equal(breaks('2026-02-15', rows, f.employee).break_minutes, 30);
        assert.equal(String(breaks('2026-02-15', rows, f.employee).history_id), String(added._id));
        assert.equal(breaks('2026-01-15', rows, f.employee).break_minutes, 0);
        assert.equal(breaks('2026-03-15', rows, f.employee).break_minutes, 0);
        const saved = await f.snapshot(); await service.apply(f.req, approve(proposal, preview)); assert.equal(await f.snapshot(), saved);
    });
    await t.test('OFF: απευθείας και παραποιημένα αιτήματα δεν ανοίγουν καν συνεδρία ή audit', async () => {
        const f = await seedApprovedProposal(db), proposal = await approvedProposalBody(f), before = await f.snapshot();
        const service = create({ ...f.dependencies, isEnabled: () => false,
            connection: { startSession() { assert.fail('OFF must not open a session'); } } });
        for (const body of [{}, { enabled: true }, { proposal, approval: { confirmed: true, token: 'forged' } }])
            await assert.rejects(service.apply(f.req, body), error => error.reason === 'DISABLED');
        assert.equal(await f.snapshot(), before); assert.equal(P.enabled({}), false); assert.equal(P.enabled({ [P.FLAG]: 'TRUE' }), false);
        assert.equal(create({ ...f.dependencies, approvalSecret: null }).isEnabled(), false);
    });
    for (const [name, change, reason] of [
        ['παρωχημένη αποθηκευμένη κατάσταση', async (f) => db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $set: { updatedAt: new Date() } }), 'STALE'],
        ['νέα επικάλυψη', async (f) => db.historyModel.collection.insertOne({ ...f.history[0], _id: new mongoose.Types.ObjectId(),
            hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-10'), hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-01-20') }), 'STALE'],
        ['κλειδωμένη περίοδος', async (f) => db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod }, { $set: { status: 'LOCKED' } }), 'PERIOD_PROTECTED'],
        ['οριστικοποιημένη περίοδος', async (f) => db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod },
            { $set: { status: 'FINALIZED', frozen_snapshot_id: new mongoose.Types.ObjectId() } }), 'PERIOD_PROTECTED'],
        ['προστατευμένη αναφορά', async (f) => db.frozenModel.collection.insertOne({ team: f.scope.team, company_kod: f.scope.company_kod,
            frozen_snapshot: { daily_results: [{ effective_profile_istoriko_id: String(f.history[0]._id) }] } }), 'STALE'],
        ['αφαίρεση δικαιώματος', async (f) => db.privilegeModel.collection.updateOne({ userId: String(f.actor) }, { $set: { 'privileges.update': false } }), null],
        ['ανενεργός χρήστης', async (f) => db.userModel.collection.updateOne({ _id: f.actor }, { $set: { situation: 'I' } }), null],
        ['λάθος ιστορική περίπτωση', async (f, body) => { body.proposal.selection = `UPDATE:${f.history[1]._id}`; }, 'APPROVAL'],
        ['αλλαγή ΜΕΤΑ μετά την προεπισκόπηση', async (f, body) => { body.proposal.completion.changes[0].value = '1555'; }, 'APPROVAL'],
        ['διαφορετική συνεδρία', async (f) => { f.req.sessionID += '-other'; }, 'APPROVAL'],
        ['διαφορετικός εργαζόμενος', async (f) => { f.req.params.id = String(new mongoose.Types.ObjectId()); }, 'SCOPE'],
        ['χωρίς ρητή έγκριση', async (f, body) => { body.approval.confirmed = false; }, 'APPROVAL']
    ]) await t.test(`Απόρριψη χωρίς μεταβολή: ${name}`, async () => {
        const f = await seedApprovedProposal(db), service = create(f.dependencies), proposal = await approvedProposalBody(f);
        const preview = await service.preview(f.req, proposal), body = approve(proposal, preview);
        await change(f, body); const before = await f.snapshot();
        await assert.rejects(service.apply(f.req, body), error => reason ? error.reason === reason : error.statusCode === 403);
        assert.equal(await f.snapshot(), before);
    });
    for (const [name, mutate, expected] of [
        ['μη επιτρεπόμενη τιμή', proposal => { proposal.completion.changes[0].value = '-2'; }, 'VALUE'],
        ['προστατευμένο πεδίο', proposal => { proposal.completion.changes.push({ index: -1, value: 'other-id' }); }, 'VALUE'],
        ['μεταφορά σε άλλη περίπτωση', proposal => { proposal.completion.caseId = 'other-case'; }, 'VALUE']
    ]) await t.test(`Η αυθεντική προεπισκόπηση απορρίπτει ${name}`, async () => {
        const f = await seedApprovedProposal(db), service = create(f.dependencies), proposal = await approvedProposalBody(f);
        mutate(proposal); const before = await f.snapshot();
        await assert.rejects(service.preview(f.req, proposal), error => error.reason === expected);
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Προϋπάρχουσα προστατευμένη αναφορά στη συγκεκριμένη περίπτωση απορρίπτεται', async () => {
        const f = await seedApprovedProposal(db);
        await db.frozenModel.collection.insertOne({ frozen_snapshot: { daily_results: [{ effective_profile_istoriko_id: String(f.history[0]._id) }] } });
        const proposal = await approvedProposalBody(f), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => error.reason === 'REFERENCE');
        assert.equal(await f.snapshot(), before);
    });
    for (const [field, value, reason] of [
        ['hmeromhnia_isxyos_oron_ergasias_apo', '2025-12-31', 'DATES'],
        ['hmeromhnia_isxyos_oron_ergasias_apo', '2026-01-15', 'COVERAGE_GAP'],
        ['hmeromhnia_isxyos_oron_ergasias_eos', '2026-02-10', 'COVERAGE']
    ]) await t.test(`Αυθεντικός έλεγχος χρονικών ορίων: ${reason}`, async () => {
        const f = await seedApprovedProposal(db), proposal = await approvedProposalBody(f, { values: { [field]: value } }), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => error.reason === reason);
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Μη επαληθεύσιμη προστασία περιόδου παραμένει κλειδωμένη', async () => {
        const f = await seedApprovedProposal(db);
        await db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod }, { $set: { period_end: new Date('2026-01-15') } });
        const proposal = await approvedProposalBody(f), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => error.reason === 'PROTECTION_UNKNOWN');
        assert.equal(await f.snapshot(), before);
    });
    for (const mode of ['arrangement', 'break']) await t.test(`Χωρίς σιωπηρή αλλαγή προστατευμένων μεταδεδομένων: ${mode}`, async () => {
        const f = await seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: mode === 'arrangement' ?
            { employment_profile_schema_version: null } : { afora_allagh_dialleimatos: false } });
        const values = mode === 'arrangement' ? { hmnia_enarxhs_egkekrimenhs_rythmishs: '2026-01-02' } : { dialleima_se_lepta: '30' };
        const proposal = await approvedProposalBody(f, { values }), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => error.reason === (mode === 'arrangement' ? 'PROFILE_CERTIFICATION_REQUIRED' : 'BREAK_SCOPE'));
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Λήξη και αλλοίωση έγκρισης απαιτούν νέα προεπισκόπηση', async () => {
        const f = await seedApprovedProposal(db); let now = Date.now();
        const service = create({ ...f.dependencies, now: () => now }), proposal = await approvedProposalBody(f);
        const preview = await service.preview(f.req, proposal), before = await f.snapshot(), body = approve(proposal, preview);
        body.approval.token += 'A'; await assert.rejects(service.apply(f.req, body), error => error.reason === 'APPROVAL');
        now += 16 * 60 * 1000;
        await assert.rejects(service.apply(f.req, approve(proposal, preview)), error => error.reason === 'EXPIRED');
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Ελλιπές υπόλοιπο Ιστορικό και άλλη προστατευμένη εγγραφή διατηρούνται χωρίς γενική εξυγίανση', async () => {
        const f = await seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({ _id: f.history[1]._id }, { $unset: { nomimosMisthos: 1 } });
        const protectedRow = await db.historyModel.collection.findOne({ _id: f.history[1]._id });
        const reference = { ...f.scope, ypokatasthma: '9999', period_start: new Date('2027-01-01'), period_end: new Date('2027-01-31'),
            frozen_snapshot: { daily_results: [{ effective_profile_istoriko_id: String(f.history[1]._id) }] } };
        await db.frozenModel.collection.insertOne(reference);
        const proposal = await approvedProposalBody(f), service = create(f.dependencies), preview = await service.preview(f.req, proposal);
        const result = await service.apply(f.req, approve(proposal, preview));
        assert.equal(result.historyStatus, 'REVIEW_REQUIRED');
        assert.deepEqual(await db.historyModel.collection.findOne({ _id: f.history[1]._id }), protectedRow);
        assert.deepEqual(await db.frozenModel.collection.findOne({ _id: reference._id }), reference);
        assert.equal(await db.historyModel.countDocuments(f.scope), 3);
    });
    await t.test('Έγκριση άλλου υπαρκτού εργαζομένου ή άλλου εξουσιοδοτημένου χρήστη δεν μεταφέρεται', async () => {
        const f = await seedApprovedProposal(db), other = await seedApprovedProposal(db), service = create(f.dependencies);
        const proposal = await approvedProposalBody(f), preview = await service.preview(f.req, proposal);
        const before = [await f.snapshot(), await other.snapshot()];
        await assert.rejects(service.apply({ ...other.req, session: { ...other.req.session, userId: String(f.actor) } }, approve(proposal, preview)), error => error.reason === 'APPROVAL');
        await assert.rejects(service.apply({ ...f.req, session: { ...f.req.session, userId: String(other.actor) } }, approve(proposal, preview)), error => error.reason === 'APPROVAL');
        assert.deepEqual([await f.snapshot(), await other.snapshot()], before);
    });
    for (const race of ['period', 'reference', 'rights']) await t.test(`Πραγματική ταυτόχρονη μεταβολή ${race}: τα κοινά κλειδώματα αναγκάζουν νέο έλεγχο`, async () => {
        const f = await seedApprovedProposal(db), base = create(f.dependencies), proposal = await approvedProposalBody(f);
        const preview = await base.preview(f.req, proposal);
        let release, reached, wait = true;
        const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { reached = resolve; });
        const service = create({ ...f.dependencies, auditStorage: async args => {
            const storage = await require('../../server/services/ergazomenoi/employeeHistoryRepairAuditSetupService').getEmployeeHistoryRepairAuditStorageState(args);
            if (wait) { wait = false; reached(); await gate; } return storage;
        } });
        const running = service.apply(f.req, approve(proposal, preview));
        // Attach a rejection handler immediately while the independent writer runs.
        const checked = assert.rejects(running, error => race === 'rights' ? error.statusCode === 403 : error.statusCode === 409);
        await started;
        if (race === 'period') await db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod }, { $set: { status: 'LOCKED' } });
        if (race === 'rights') await db.privilegeModel.collection.updateOne({ userId: String(f.actor) }, { $set: { 'privileges.update': false } });
        if (race === 'reference') {
            const session = await db.connection.startSession();
            try { await session.withTransaction(async () => {
                const document = { frozen_snapshot: { daily_results: [{ team: f.scope.team, company_kod: f.scope.company_kod,
                    kodikos: f.scope.kodikos, effective_profile_istoriko_id: String(f.history[0]._id) }] }, ...f.scope };
                await require('../../server/services/ergazomenoi/employeeHistoryReferenceWriteFenceService').fenceEmployeeHistoryReferences({
                    collectionName: 'Apasxoliseis_Period_Frozen_Snapshots', documents: [document], session, historyModel: db.historyModel });
                await db.frozenModel.collection.insertOne(document, { session });
            }); } finally { await session.endSession(); }
        }
        const before = await f.snapshot(); release(); await checked;
        assert.equal(await f.snapshot(), before);
    });
    for (const failure of ['history', 'audit', 'verification']) await t.test(`Πραγματικό rollback μετά από ${failure}`, async () => {
        const f = await seedApprovedProposal(db), base = create(f.dependencies), proposal = await approvedProposalBody(f);
        const preview = await base.preview(f.req, proposal), before = await f.snapshot();
        const historyModel = failure === 'history' ? proxy(db.historyModel, { async updateOne(filter, update, options) {
            const result = await db.historyModel.updateOne(filter, update, options);
            if (Object.hasOwn(update.$set || {}, 'nomimosMisthos')) throw Error('SYNTHETIC_AFTER_REAL_HISTORY_WRITE');
            return result;
        } }) : db.historyModel;
        const auditModel = failure === 'history' ? db.auditModel : proxy(db.auditModel, { async create(records, options) {
            const created = await db.auditModel.create(records, options);
            if (failure === 'audit') throw Error('SYNTHETIC_AFTER_REAL_AUDIT_WRITE');
            await db.historyModel.collection.updateOne({ _id: f.history[1]._id }, { $set: { nomimosMisthos: 999 } }, options);
            return created;
        } });
        const service = create({ ...f.dependencies, historyModel, auditModel });
        await assert.rejects(service.apply(f.req, approve(proposal, preview)));
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Απενεργοποίηση πριν από commit ανακαλεί και τις ήδη εκτελεσμένες εγγραφές της συναλλαγής', async () => {
        const f = await seedApprovedProposal(db); let enabled = true;
        const auditModel = proxy(db.auditModel, { async create(...args) { const rows = await db.auditModel.create(...args); enabled = false; return rows; } });
        const service = create({ ...f.dependencies, auditModel, isEnabled: () => enabled }), proposal = await approvedProposalBody(f);
        const preview = await service.preview(f.req, proposal), before = await f.snapshot();
        await assert.rejects(service.apply(f.req, approve(proposal, preview)), error => error.reason === 'DISABLED');
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Ταυτόχρονη επανάληψη INSERT καταχωρίζει ακριβώς μία εγγραφή και ένα audit', async () => {
        const f = await seedApprovedProposal(db, { insert: true }), service = create(f.dependencies), proposal = await approvedProposalBody(f, { insert: true });
        const preview = await service.preview(f.req, proposal), body = approve(proposal, preview);
        const results = await Promise.all([service.apply(f.req, body), service.apply(f.req, body)]);
        assert.equal(results.filter(result => result.applied).length, 1); assert.equal(results.filter(result => result.alreadyApplied).length, 1);
        assert.equal(await db.historyModel.countDocuments(f.scope), 3);
        assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 1);
    });
    await t.test('Δύο διαφορετικές εγκρίσεις της ίδιας αρχικής κατάστασης: μόνο μία γράφει, η άλλη 409', async () => {
        const f = await seedApprovedProposal(db), service = create(f.dependencies);
        const first = await approvedProposalBody(f), second = await approvedProposalBody(f, { values: { nomimosMisthos: '1555' } });
        const previews = [await service.preview(f.req, first), await service.preview(f.req, second)];
        const results = await Promise.allSettled([service.apply(f.req, approve(first, previews[0])), service.apply(f.req, approve(second, previews[1]))]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
        assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 1);
    });
    await t.test('Απώλεια επιβεβαίωσης πραγματικού commit: αναγνωστική συμφωνία και καμία διπλή εφαρμογή', async () => {
        const f = await seedApprovedProposal(db), service = create(f.dependencies), proposal = await approvedProposalBody(f);
        const preview = await service.preview(f.req, proposal), body = approve(proposal, preview);
        const before = await f.snapshot();
        await assert.rejects(service.reconcile(f.req, { proposal, token: preview.approval.token }), error => error.reason === 'COMMIT_UNCERTAIN');
        assert.equal(await f.snapshot(), before);
        const uncertainConnection = { db: db.connection.db, collection: db.connection.collection.bind(db.connection), async startSession() {
            const session = await db.connection.startSession(), transaction = session.withTransaction.bind(session);
            session.withTransaction = async (...args) => { await transaction(...args);
                throw Object.assign(Error('SYNTHETIC_COMMIT_ACK_LOST'), { errorLabels: ['UnknownTransactionCommitResult'] }); };
            return session;
        } };
        await assert.rejects(create({ ...f.dependencies, connection: uncertainConnection }).apply(f.req, body), error => error.reason === 'COMMIT_UNCERTAIN');
        const committed = await f.snapshot(); assert.notEqual(committed, before);
        assert.equal((await service.reconcile(f.req, { proposal, token: preview.approval.token })).outcome, 'COMMITTED');
        await service.apply(f.req, body); assert.equal(await f.snapshot(), committed);
    });
    await t.test('Η πραγματική ώρα του audit διαχωρίζεται από μελλοντική παλαιά τεχνική έκδοση', async () => {
        const f = await seedApprovedProposal(db), future = new Date('2035-01-01');
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { updatedAt: future } });
        const service = create(f.dependencies), proposal = await approvedProposalBody(f), preview = await service.preview(f.req, proposal);
        const start = Date.now(); await service.apply(f.req, approve(proposal, preview));
        const audit = await db.auditModel.findOne({ 'employeeScope.employee_id': f.employee._id }).lean();
        assert.ok(audit.repairedAt.getTime() >= start && audit.repairedAt.getTime() <= Date.now());
        assert.ok(audit.diagnostics.actualAfter.updatedAt > future);
    });
    await t.test('Μεταγενέστερη αλλαγή: η συμφωνία αναφέρει την αρχική ολοκλήρωση χωρίς ψευδή ακύρωση', async () => {
        const f = await seedApprovedProposal(db), service = create(f.dependencies), proposal = await approvedProposalBody(f);
        const preview = await service.preview(f.req, proposal); await service.apply(f.req, approve(proposal, preview));
        await db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $set: { updatedAt: new Date() } });
        const before = await f.snapshot(); let failure;
        try { await service.reconcile(f.req, { proposal, token: preview.approval.token }); } catch (error) { failure = error; }
        assert.equal(failure.reason, 'COMMITTED_STATE_CHANGED'); assert.equal(failure.saved, true);
        const res = { set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        require('../../server/controllers/ergazomenoi/employeeHistoryApprovedProposalController').sendFailure(res, failure, 'reconcile');
        assert.equal(res.code, 409); assert.equal(res.body.saved, true);
        assert.match(res.body.message, /αρχική εγκεκριμένη ενέργεια καταγράφηκε/);
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Chromium και MongoDB: OFF, ρητή έγκριση, προσαρμογή διαλόγου και ανάκτηση χαμένης απάντησης', async () => {
        const f = await seedApprovedProposal(db); let enabled = false;
        const service = create({ ...f.dependencies, isEnabled: () => enabled }), h = await startApprovedProposalHttp(f, service);
        const { chromium } = require('playwright'), fs = require('node:fs/promises'), path = require('node:path');
        const browser = await chromium.launch({ headless: true }), context = await browser.newContext(), page = await context.newPage();
        const errors = [], external = []; page.on('pageerror', error => errors.push(error.message));
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin === h.origin) return route.continue();
            external.push(route.request().url()); return route.abort();
        });
        try {
            await page.goto(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=UPDATE:${f.history[0]._id}`);
            assert.deepEqual(await page.locator('[data-field-id="DECLARATION"] option').allTextContents(),['Όχι','Ναι']);
            assert.equal(await page.locator('[data-field-id="DECLARATION"] option:checked').textContent(),'Όχι');
            await page.locator('[data-field-id="nomimosMisthos"]').fill('1456,78');
            const before = await f.snapshot();
            const preview = async () => {
                const response = page.waitForResponse(response => response.url().endsWith('/history-proposal-apply-preview'));
                await page.locator('#previewProposalApply').click(); const result = await (await response).json();
                assert.equal(result.success, true, result.message);
                await page.waitForFunction(() => document.querySelector('.proposal-page').getAttribute('aria-busy') === 'false');
                return result;
            };
            const unapproved=await preview();assert.equal(unapproved.approved,false);assert.equal(unapproved.executionEnabled,false);
            await page.locator('[data-field-id="DECLARATION"]').selectOption({label:'Ναι'});
            const off = await preview(); assert.equal(off.executionEnabled, false);assert.equal(off.evidence,'');
            assert.equal(await page.locator('#approveProposalApply').isDisabled(), true);
            const proposal = await approvedProposalBody(f);
            const offStart = commands.length;
            for (const body of [{}, { ...approve(proposal, off), enabled: true }]) {
                const response = await fetch(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-apply`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'synthetic-approved-csrf' }, body: JSON.stringify(body) });
                assert.equal(response.status, 403); assert.equal((await response.json()).saved, false);
            }
            assert.equal(commands.length, offStart);
            assert.equal(await f.snapshot(), before);
            enabled = true;
            await assert.rejects(service.apply(f.req, approve(proposal, off)), error => error.reason === 'DISABLED');
            await preview(); assert.equal(await page.locator('#approveProposalApply').isEnabled(), true);
            await page.locator('[data-field-id="DECLARATION"]').selectOption({label:'Όχι'});
            assert.equal(await page.locator('#approveProposalApply').isDisabled(),true);
            assert.equal(await page.locator('#proposalApplyPreview').isVisible(),false);
            assert.equal((await preview()).approved,false);
            await page.locator('[data-field-id="nomimosMisthos"]').fill('0');
            await page.locator('[data-field-id="pragmatikosMisthos"]').fill('0');
            const rejectedResponse=page.waitForResponse(response=>response.url().endsWith('/history-proposal-apply-preview'));
            await page.locator('#previewProposalApply').click();const rejected=await (await rejectedResponse).json();
            await page.waitForFunction(()=>document.querySelector('.proposal-page').getAttribute('aria-busy')==='false');
            assert.equal(rejected.code,P.OPERATION+'_INCOMPLETE');
            assert.deepEqual(rejected.problems.map(item=>item.fieldId),['nomimosMisthos','pragmatikosMisthos']);
            assert.equal(await page.locator('#proposalApplyIssues tbody tr').count(),2);
            assert.deepEqual(await page.locator('#proposalApplyIssues tbody td:first-child').allTextContents(),rejected.problems.map(item=>item.field));
            for(const [width,height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[480,700],[900,450]])for(const sidebar of [false,true]){
                await page.setViewportSize({width,height});
                await page.evaluate(sidebar=>{const main=document.querySelector('.proposal-page');main.style.width=sidebar?'calc(100% - 160px)':'';main.style.marginLeft=sidebar?'160px':'';},sidebar);
                assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
                assert.equal(await page.locator('#proposalApplyIssues tbody tr').count(),2);
            }
            const responseStub={set(){return this;},status(){return this;},json(value){return value;}};
            const generic=require('../../server/controllers/ergazomenoi/employeeHistoryApprovedProposalController').sendFailure(responseStub,P.failure('INCOMPLETE',422),'preview');
            await page.route('**/history-proposal-apply-preview',route=>route.fulfill({status:422,json:generic}));
            const genericResponse=page.waitForResponse(response=>response.url().endsWith('/history-proposal-apply-preview'));
            await page.locator('#previewProposalApply').click();await genericResponse;
            await page.waitForFunction(()=>document.querySelector('.proposal-page').getAttribute('aria-busy')==='false');
            assert.equal(await page.locator('#proposalApplyIssues').isVisible(),false);
            assert.equal(await page.locator('#proposalApplyIssues table').count(),0);
            assert.match(await page.locator('#proposalApplyStatus').textContent(),/χωρίς να προσδιορίσει αξιόπιστα συγκεκριμένο πεδίο/);
            assert.match(await page.locator('#proposalApplyStatus').textContent(),/Κωδικός αναφοράς/);
            await page.unroute('**/history-proposal-apply-preview');
            await page.locator('[data-field-id="nomimosMisthos"]').fill('1456,78');
            await page.locator('[data-field-id="pragmatikosMisthos"]').fill('1300');
            assert.equal(await page.locator('#proposalApplyIssues').isVisible(),false);
            await page.locator('[data-field-id="DECLARATION"]').selectOption({label:'Ναι'});
            await preview();assert.equal(await page.locator('#proposalApplyIssues').isVisible(),false);
            const folder = await fs.mkdtemp(path.join(process.env.PAYROLL_APPROVED_PROPOSAL_TEST_ARTIFACT_DIR || require('node:os').tmpdir(), 'payroll-approved-proposal-browser-'));
            for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[480,700],[900,450]]) for (const sidebar of [false, true]) {
                await page.setViewportSize({ width, height });
                await page.evaluate(sidebar => { const main = document.querySelector('.proposal-page');
                    main.style.width = sidebar ? 'calc(100% - 160px)' : ''; main.style.marginLeft = sidebar ? '160px' : ''; }, sidebar);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                assert.equal(await page.locator('#proposalApplyPreview .proposal-table-scroll').evaluate(node => node.scrollWidth >= node.clientWidth), true);
                await page.locator('#approveProposalApply').click();
                assert.equal(await page.locator('#proposalApplyWarning').evaluate(node => node.matches(':modal')), true);
                assert.equal(await page.locator('#confirmProposalApply').isDisabled(), true);
                await page.locator('#proposalApplyConsent').check();
                for (const id of ['cancelProposalApply', 'confirmProposalApply']) {
                    const button = page.locator(`#${id}`); await button.scrollIntoViewIfNeeded();
                    assert.equal(await button.evaluate(node => { const rect = node.getBoundingClientRect();
                        return rect.top >= 0 && rect.bottom <= innerHeight && node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); }), true);
                }
                await page.screenshot({ path: path.join(folder, `${width}x${height}${sidebar ? '-sidebar' : ''}.png`) });
                await page.locator('#cancelProposalApply').click();
            }
            assert.equal(await f.snapshot(), before);
            await page.locator('[data-field-id="nomimosMisthos"]').fill('1457');
            assert.equal(await page.locator('#approveProposalApply').isDisabled(), true);
            assert.equal(await page.locator('#proposalApplyPreview').isVisible(), false);
            await preview();
            await page.route('**/history-proposal-apply', async route => {
                const response = await route.fetch(); assert.equal(response.status(), 200, await response.text()); await route.abort();
            });
            await page.locator('#approveProposalApply').click(); await page.locator('#proposalApplyConsent').check();
            await page.locator('#confirmProposalApply').click();
            await page.locator('#reconcileProposalApply').waitFor({ state: 'visible' });
            assert.match(await page.locator('#proposalApplyStatus').textContent(), /Δεν γνωρίζουμε αν αποθηκεύτηκε/);
            assert.equal(await page.locator('#previewProposalApply').isDisabled(), true);
            assert.equal(await page.locator('[data-field-id="nomimosMisthos"]').isDisabled(), true);
            assert.equal(await page.locator('[data-field-id="nomimosMisthos"]').inputValue(), '1457');
            await page.locator('#reconcileProposalApply').click();
            await page.waitForFunction(() => document.getElementById('proposalApplyStatus').textContent.includes('επιβεβαιώθηκαν στην αποθηκευμένη κατάσταση'));
            assert.match(await page.locator('#proposalEditState').textContent(), /αποθηκεύτηκαν στο Ιστορικό/);
            assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 1);
            assert.equal((await db.historyModel.findById(f.history[0]._id).lean()).nomimosMisthos, 1457);
            assert.deepEqual(errors, []); assert.deepEqual(external, []);
            console.log(`Συνθετικές εικόνες έγκρισης: ${folder}`);
        } finally { await browser.close(); await h.close(); }
    });
});
