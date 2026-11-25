'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Types, connection } = require('mongoose');
const F = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const { accessForUser, ACCESS_MODES } = require('../../server/services/ergazomenoi/employeeHistoryAuthorizationService');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;

async function scenario(db, team = 'BLG', role = 'A') {
    const f = await F.seedApprovedProposal(db, { employeeCode: '0040' });
    f.scope.team = team; f.req.session.userTeam = team;
    await db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $set: { team } });
    await db.historyModel.collection.updateMany({ company_kod: f.scope.company_kod }, { $set: { team } });
    await db.companyModel.collection.updateOne({ _id: new Types.ObjectId(f.scope.company_kod) }, { $set: { team, kod: '0008' } });
    await db.periodControlModel.collection.updateMany({ company_kod: f.scope.company_kod }, { $set: { team } });
    await db.userModel.collection.updateOne({ _id: f.actor }, { $set: { team, privileges: role } });
    const input = f.input;
    f.input = async () => ({ ...await input(), companyBusinessCode: '0008' });
    f.dependencies.logger = { info() {} };
    return f;
}
async function securityState(db, f) {
    return A.stringify({ user: await db.userModel.collection.findOne({ _id: f.actor }),
        permissions: await db.privilegeModel.collection.find({ userId: String(f.actor) }).sort({ _id: 1 }).toArray(),
        users: (await db.companyModel.collection.findOne({ _id: new Types.ObjectId(f.scope.company_kod) })).users });
}
async function post(h, f, suffix, body) {
    const response = await fetch(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-${suffix}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'synthetic-approved-csrf' },
        body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
}
async function xlsx(h, f, proposal) {
    const response = await fetch(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal.xlsx?selection=${proposal.selection}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'synthetic-approved-csrf' },
        body: JSON.stringify(proposal.completion) });
    return { status: response.status, buffer: Buffer.from(await response.arrayBuffer()) };
}
async function importXlsx(h, f, buffer) {
    const data = new FormData(); data.append('proposal', new Blob([buffer]), 'synthetic-history.xlsx');
    const response = await fetch(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-import-preview`, {
        method: 'POST', headers: { 'X-CSRF-Token': 'synthetic-approved-csrf' }, body: data });
    return { status: response.status, body: await response.json() };
}
async function importedProposal(f, original, imported) {
    const baseline = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs, { selection: original.selection });
    const raw = new Map(imported.editorValues.values.map(item => [item.fieldId, item.value]));
    return { selection: original.selection, completion: { ...original.completion,
        changes: baseline.editableCells.map((entry, index) => {
            const value = raw.get(entry.canonicalField || entry.fieldId), choices = E.editorChoices(entry, f.catalogs);
            return { index, value: entry.role === 'DECLARATION' ? '0' : value == null ? '' :
                choices.length ? String(choices.findIndex(option => A.equal(option.id, value))) : value };
        }) } };
}

test('Η χειροκίνητη πολιτική δεν επεκτείνει το ADMIN_FULL ή την αυτόματη ανακατασκευή', () => {
    assert.equal(accessForUser({ privileges: 'A', team: 'THA', situation: 'A' }).mode, ACCESS_MODES.ADMIN_FULL);
    for (const [privileges, team] of [['A', 'BLG'], ['A', 'FUTURE_GROUP'], ['HR', 'THA']])
        assert.equal(accessForUser({ privileges, team, situation: 'A' }).mode, ACCESS_MODES.NONE);
    assert.equal(accessForUser({ privileges: 'S', team: 'BLG', situation: 'A' }).mode, ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE);
});

test('Δ: ίδια δικαιώματα ανά Group σε Editor → XLSX → Preview → Approval → Apply → Reconcile',
    { skip: !binary, timeout: 180000 }, async t => {
    const db = await F.startApprovedProposalMongo(binary); t.after(db.close);
    assert.equal(connection.readyState, 0);
    for (const [name, team, role, moduleAdmin] of [
        ['Admin THA', 'THA', 'A'], ['Admin BLG / 0008 / 0040', 'BLG', 'A'],
        ['Admin μελλοντικού Group', 'FUTURE_GROUP', 'A'], ['Supervisor', 'BLG', 'S'], ['HR', 'BLG', 'HR'],
        ['Admin BLG με Ergazomenoi.admin', 'BLG', 'A', true]
    ]) await t.test(name, async () => {
        const f = await scenario(db, team, role), service = create(f.dependencies);
        if (moduleAdmin) await db.privilegeModel.collection.updateOne({ userId: String(f.actor), form: 'Ergazomenoi' },
            { $set: { privileges: { admin: true } } });
        const h = await F.startApprovedProposalHttp(f, service, { realProposalController: true });
        try {
            const securityBefore = await securityState(db, f), before = await f.snapshot();
            const original = await F.approvedProposalBody(f, { values: { nomimosMisthos: '1456,78', DECLARATION: '0' } });
            const editor = await fetch(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=${original.selection}`);
            assert.equal(editor.status, 200); assert.match(await editor.text(), /historyProposalEditor/);
            const exported = await xlsx(h, f, original); assert.equal(exported.status, 200);
            const imported = await importXlsx(h, f, exported.buffer);
            assert.equal(imported.status, 200, imported.body.message); assert.equal(imported.body.success, true);
            const proposal = await importedProposal(f, original, imported.body);
            const unapproved = await post(h, f, 'apply-preview', proposal);
            assert.equal(unapproved.status, 200, unapproved.body.message); assert.equal(unapproved.body.executionEnabled, false);
            const refused = await post(h, f, 'apply', { proposal, approval: { token: unapproved.body.approval.token, confirmed: true } });
            assert.equal(refused.body.saved, false); assert.match(refused.body.code, /APPROVAL_REQUIRED$/);
            assert.equal(await f.snapshot(), before);
            const baseline = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs, { selection: proposal.selection });
            proposal.completion.changes.find(change => baseline.editableCells[change.index].role === 'DECLARATION').value = '1';
            const preview = await post(h, f, 'apply-preview', proposal);
            assert.equal(preview.status, 200, preview.body.message); assert.equal(preview.body.executionEnabled, true);
            assert.equal(await f.snapshot(), before);
            const approval = { token: preview.body.approval.token, confirmed: true };
            const applied = await post(h, f, 'apply', { proposal, approval });
            assert.equal(applied.status, 200, applied.body.message); assert.equal(applied.body.verification.persisted, true);
            const saved = await f.snapshot();
            const reconciled = await post(h, f, 'apply-reconcile', { proposal, token: approval.token });
            assert.equal(reconciled.status, 200, reconciled.body.message); assert.equal(reconciled.body.reconciledReadOnly, true);
            assert.equal(await f.snapshot(), saved); assert.equal(await securityState(db, f), securityBefore);
        } finally { await h.close(); }
    });
    const denials = [
        ['χωρίς ενημέρωση', (f) => db.privilegeModel.collection.updateOne({ userId: String(f.actor), form: 'Ergazomenoi' }, { $set: { privileges: { read: true } } })],
        ['μη εξουσιοδοτημένη εταιρεία', (f) => db.companyModel.collection.updateOne({ _id: new Types.ObjectId(f.scope.company_kod) }, { $set: { users: [] } })],
        ['διαφορετικό Group', (f) => db.userModel.collection.updateOne({ _id: f.actor }, { $set: { team: 'OTHER' } })],
        ['THA προς διαφορετικό Group', (f) => db.userModel.collection.updateOne({ _id: f.actor }, { $set: { team: 'THA' } })],
        ['μη εξουσιοδοτημένο πεδίο αποδοχών', (f) => db.privilegeModel.collection.updateOne({ userId: String(f.actor), form: 'ErgazomenoiApodoxes' }, { $set: { privileges: { read: true } } })],
        ['μη εξουσιοδοτημένο πεδίο κρατήσεων', (f) => db.privilegeModel.collection.updateOne({ userId: String(f.actor), form: 'ErgazomenoiKrathseis' }, { $set: { privileges: { read: true } } }), { krathsh_01: '0' }],
        ['ανενεργός χρήστης', (f) => db.userModel.collection.updateOne({ _id: f.actor }, { $set: { situation: 'I' } })],
        ['μη εξουσιοδοτημένος ρόλος', (f) => db.userModel.collection.updateOne({ _id: f.actor }, { $set: { privileges: 'C' } })]
    ];
    for (const [name, revoke, values] of denials) await t.test(`Απόρριψη και νέος έλεγχος δικαιωμάτων: ${name}`, async () => {
        const f = await scenario(db), service = create(f.dependencies);
        const proposal = await F.approvedProposalBody(f, values ? { values } : {}), preview = await service.preview(f.req, proposal);
        const h = await F.startApprovedProposalHttp(f, service, { realProposalController: true });
        try {
            const exported = await xlsx(h, f, proposal); assert.equal(exported.status, 200);
            await revoke(f);
            const before = await f.snapshot(), securityBefore = await securityState(db, f);
            assert.ok([403, 404].includes((await xlsx(h, f, proposal)).status));
            assert.ok([403, 404].includes((await importXlsx(h, f, exported.buffer)).status));
            assert.equal((await post(h, f, 'apply-preview', proposal)).status, 403);
            const denied = await post(h, f, 'apply', { proposal, approval: { token: preview.approval.token, confirmed: true } });
            assert.equal(denied.status, 403); assert.equal(denied.body.saved, false);
            assert.equal((await post(h, f, 'apply-reconcile', { proposal, token: preview.approval.token })).status, 403);
            assert.equal(await f.snapshot(), before); assert.equal(await securityState(db, f), securityBefore);
        } finally { await h.close(); }
    });
    for (const [name, revoke, values] of denials) await t.test(`Ήδη εφαρμοσμένο αποτέλεσμα με ανακληθέν δικαίωμα: ${name}`, async () => {
        const f = await scenario(db), service = create(f.dependencies), proposal = await F.approvedProposalBody(f, values ? { values } : {});
        const preview = await service.preview(f.req, proposal);
        const body = { proposal, approval: { token: preview.approval.token, confirmed: true } };
        await service.apply(f.req, body); await revoke(f);
        const before = await f.snapshot();
        await assert.rejects(service.reconcile(f.req, { proposal, token: preview.approval.token }), error => error.statusCode === 403);
        await assert.rejects(service.apply(f.req, body), error => error.statusCode === 403);
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Διαφορετικός εργαζόμενος και προστατευμένο πεδίο απορρίπτονται', async () => {
        const f = await scenario(db), service = create(f.dependencies), proposal = await F.approvedProposalBody(f);
        const originalId = f.req.params.id, before = await f.snapshot();
        f.req.params.id = String(new Types.ObjectId());
        await assert.rejects(service.preview(f.req, proposal), error => error.statusCode === 403);
        f.req.params.id = originalId;
        proposal.completion.changes.push({ index: -1, value: 'forged-employee' });
        await assert.rejects(service.preview(f.req, proposal), error => error.statusCode === 422);
        assert.equal(await f.snapshot(), before);
    });
});
