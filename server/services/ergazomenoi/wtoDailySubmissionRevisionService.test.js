'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildEmploymentPeriodFrozenSnapshot } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { previewSubmissionRevision, createSubmissionRevision, baselineFingerprint } = require('./wtoDailySubmissionRevisionService');
const clone = value => structuredClone(value);
global.fetch = async () => { throw new Error('External network forbidden'); };
require('mongoose').connect = async () => { throw new Error('Real database forbidden'); };

function fixture() {
    const scope = { team: 'synthetic', company_kod: 'synthetic-company', ypokatasthma: '0000',
        period_start: new Date('2026-09-01'), period_end: new Date('2026-09-30') };
    const session = { userId: '507f1f77bcf86cd799439011', userTeam: scope.team,
        companyInUse: scope.company_kod, userRole: 'HR', userName: 'Συνθετικός Ελεγκτής' };
    const row = { _id: '507f1f77bcf86cd799439012', kodikos: '001', ypokatasthma: '0000',
        hmeromhnia: '2026-09-27', apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΕΡΓ', is_locked: true,
        apo_ora_01: '18:30', eos_ora_01: '00:30', cards_apo_ora_01: '00:30', cards_eos_ora_01: '00:30',
        cards_apo_ora_02: '18:28', cards_eos_ora_02: '00:30',
        apo_ora_01_apologistika: '18:28', eos_ora_01_apologistika: '00:28',
        apo_ora_02_apologistika: '18:28', eos_ora_02_apologistika: '00:30',
        ores_ergasias_apologistika: 123.45,
        hr_daily_actual_work_resolution: { keep_original_approval: true } };
    const touching = { ...row, _id: '507f1f77bcf86cd799439013', hmeromhnia: '2026-09-25',
        apo_ora_01_apologistika: '18:00', eos_ora_01_apologistika: '18:29',
        apo_ora_02_apologistika: '18:29', eos_ora_02_apologistika: '22:00' };
    const built = buildEmploymentPeriodFrozenSnapshot({ scope, dailyResults: [row, touching],
        employees: [{ kodikos: '001', afm: '123456789', eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΛΕΓΧΟΣ',
            afora_daneismo_ergazomenoy: false }],
        appliedRepoTransfers: [{ _id: 'keep-transfer', decision_id: 'keep-decision', execution_status: 'APPLIED',
            before_snapshot: { repo: false }, after_snapshot: { repo: true },
            created_by_user_id: 'original-approver', applied_at: new Date('2026-09-29') }],
        canonicalDecisions: [{ _id: 'keep-decision', employee_kodikos: '001', decision_payload: { keep: true } }] });
    const document = { _id: '507f1f77bcf86cd799439014', ...scope,
        frozen_snapshot_fingerprint: built.frozen_snapshot_fingerprint, frozen_snapshot: built.snapshot };
    const state = { control: { ...scope, status: 'FINALIZED', version: 4, write_fence_version: 0,
        frozen_snapshot_id: document._id, frozen_snapshot_fingerprint: built.frozen_snapshot_fingerprint },
        document, revisions: [], fences: 0, inserts: 0, reads: [], fenceConflict: false, insertFailure: false };
    const command = { ypokatasthma: '0000', reason: 'Επιβεβαιωμένη μία συνεχής απασχόληση μέχρι 00:30 επόμενης ημέρας',
        correction: { row_id: row._id, date: '2026-09-27', confirmed_actual_hours: true, intervals: [{ start: '18:28', end: '00:30' }] } };
    const query = value => ({ session() { return this; }, async lean() { return clone(value); } });
    const checkScope = filter => {
        assert.equal(filter.team, scope.team); assert.equal(filter.company_kod, scope.company_kod);
        assert.equal(filter.ypokatasthma, scope.ypokatasthma);
    };
    let queue = Promise.resolve();
    const options = { scope, session, command,
        periodModel: { findOne(filter) { checkScope(filter); state.reads.push('period'); return query(state.control); },
            async updateOne(filter, update) {
                checkScope(filter); assert.deepEqual(update, { $inc: { write_fence_version: 1 } });
                assert.equal(filter.frozen_snapshot_id, state.control.frozen_snapshot_id);
                assert.equal(filter.write_fence_version, state.control.write_fence_version);
                if (state.fenceConflict) return { matchedCount: 0 };
                state.control.write_fence_version += 1; state.fences += 1; return { matchedCount: 1 };
            } },
        frozenModel: { findOne(filter) { checkScope(filter); state.reads.push('frozen'); return query(state.document); } },
        revisionModel: { collection: { indexes: async () => [{ name: '_id_', key: { _id: 1 } }] },
            findOne(filter) { checkScope(filter); return query(state.revisions.find(row => row._id === filter._id) || null); },
            async create(documents) {
                if (state.insertFailure) throw new Error('synthetic failed insert');
                if (state.revisions.some(row => row._id === documents[0]._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
                state.revisions.push(clone(documents[0])); state.inserts += 1; return clone(documents);
            } },
        transactionRunner: work => {
            const run = queue.then(async () => {
                const before = clone(state);
                try { return await work({ syntheticTransaction: true }); }
                catch (error) { Object.assign(state, before); throw error; }
            });
            queue = run.catch(() => {}); return run;
        } };
    const approve = preview => ({ ...options, command: { ...command, approve: true, reviewed_entire_preview: true,
        expected_preview_fingerprint: preview.preview_fingerprint, request_id: 'synthetic-request' } });
    return { state, options, command, approve };
}
const analytics = (payload, date) => payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO
    .find(row => row.f_date === date).ErgazomenosAnalytics.ErgazomenosWTOAnalytics;

test('full preview: one 18:28–00:30 interval, 362 minutes; 25/09 touching merged', async () => {
    const f = fixture(); const original = JSON.stringify(f.state.document);
    const preview = await previewSubmissionRevision(f.options);
    assert.deepEqual(analytics(preview.payload, '27/09/2026'), [{ f_type: 'ΕΡΓ', f_from: '18:28', f_to: '00:30' }]);
    assert.deepEqual(analytics(preview.payload, '25/09/2026'), [{ f_type: 'ΕΡΓ', f_from: '18:00', f_to: '22:00' }]);
    assert.equal(preview.correction.confirmed_work_minutes, 362);
    assert.equal(preview.correction.after.apo_ora_02_apologistika, '');
    assert.equal(preview.correction.after.eos_ora_03_apologistika, '');
    assert.equal(preview.contacts.length, 0);
    assert.equal(preview.corrections.length, 2);
    assert.equal(preview.submission_enabled, false);
    assert.equal(preview.payroll_recalculated, false);
    assert.equal(JSON.stringify(f.state.document), original);
    assert.equal(f.state.inserts + f.state.fences, 0);
});

test('approved edition is separate; original cards, approvals, schedules and snapshot unchanged', async () => {
    const f = fixture(); const original = JSON.stringify(f.state.document);
    const preview = await previewSubmissionRevision(f.options);
    const result = await createSubmissionRevision(f.approve(preview));
    assert.equal(result.idempotent, false); assert.equal(f.state.inserts, 1); assert.equal(f.state.fences, 1);
    assert.equal(result.revision.baseline_snapshot_id, f.state.document._id);
    assert.equal(result.revision.baseline_fingerprint, f.state.document.frozen_snapshot_fingerprint);
    assert.equal(result.revision.approval.user_id, f.options.session.userId);
    assert.equal(result.revision.correction.before.eos_ora_01_apologistika, '00:28');
    assert.equal(result.revision.submission_enabled, false);
    assert.equal(JSON.stringify(f.state.document), original);
    assert.equal(f.state.control.status, 'FINALIZED');
    assert.equal(f.state.control.frozen_snapshot_id, f.state.document._id);
});

test('requires explicit approval and full-preview confirmation before any writes', async () => {
    const f = fixture(); const preview = await previewSubmissionRevision(f.options);
    for (const field of ['approve', 'reviewed_entire_preview', 'expected_preview_fingerprint', 'request_id']) {
        const input = f.approve(preview); delete input.command[field];
        await assert.rejects(createSubmissionRevision(input), { code: 'WTODAILY_REVISION_EXPLICIT_APPROVAL_REQUIRED' });
    }
    assert.equal(f.state.inserts + f.state.fences, 0);
});

test('same approved request is idempotent; different request cannot create a second edition', async () => {
    const f = fixture(); const preview = await previewSubmissionRevision(f.options); const input = f.approve(preview);
    await createSubmissionRevision(input);
    assert.equal((await createSubmissionRevision(input)).idempotent, true);
    await assert.rejects(createSubmissionRevision({ ...input, command: { ...input.command, request_id: 'different' } }),
        { code: 'WTODAILY_REVISION_ALREADY_EXISTS' });
    assert.equal(f.state.inserts, 1); assert.equal(f.state.fences, 1);
});

test('concurrent approvals produce exactly one revision', async () => {
    const f = fixture(); const preview = await previewSubmissionRevision(f.options); const input = f.approve(preview);
    const results = await Promise.allSettled([createSubmissionRevision(input),
        createSubmissionRevision({ ...input, command: { ...input.command, request_id: 'concurrent' } })]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, 'WTODAILY_REVISION_ALREADY_EXISTS');
    assert.equal(f.state.inserts, 1);
});

test('source tampering and legitimately changed source fingerprints invalidate prior preview', async () => {
    for (const refreshFingerprint of [false, true]) {
        const f = fixture(); const preview = await previewSubmissionRevision(f.options);
        f.state.document.frozen_snapshot.daily_results[0].cards_apo_ora_01 = '18:27';
        if (refreshFingerprint) {
            f.state.document.frozen_snapshot_fingerprint = baselineFingerprint(f.state.document.frozen_snapshot);
            f.state.control.frozen_snapshot_fingerprint = f.state.document.frozen_snapshot_fingerprint;
        }
        await assert.rejects(createSubmissionRevision(f.approve(preview)), {
            code: refreshFingerprint ? 'WTODAILY_REVISION_PREVIEW_STALE' : 'WTODAILY_REVISION_BASELINE_INVALID' });
        assert.equal(f.state.inserts + f.state.fences, 0);
    }
});

test('changed reason, correction or reviewer cannot reuse prior approval fingerprint', async () => {
    const f = fixture(); const preview = await previewSubmissionRevision(f.options);
    for (const change of [input => { input.command.reason = 'Διαφορετική αιτιολογία'; },
        input => { input.command.correction = { ...input.command.correction, intervals: [{ start: '18:28', end: '00:29' }] }; },
        input => { input.session = { ...input.session, userId: '507f1f77bcf86cd799439099' }; }]) {
        const input = f.approve(preview); change(input);
        await assert.rejects(createSubmissionRevision(input), { code: 'WTODAILY_REVISION_PREVIEW_STALE' });
    }
    assert.equal(f.state.inserts + f.state.fences, 0);
});

test('role, company and team isolation rejected before storage reads', async () => {
    for (const session of [{ userRole: 'U' }, { userTeam: 'different' }, { companyInUse: 'different' }]) {
        const f = fixture();
        await assert.rejects(previewSubmissionRevision({ ...f.options, session: { ...f.options.session, ...session } }),
            error => error.statusCode === 403);
        assert.equal(f.state.reads.length, 0); assert.equal(f.state.inserts, 0);
    }
});

test('non-finalized period, wrong branch and nonexistent target fail closed', async () => {
    const a = fixture(); a.state.control.status = 'LOCKED';
    await assert.rejects(previewSubmissionRevision(a.options), { code: 'WTODAILY_REVISION_FINALIZED_REQUIRED' });
    const b = fixture(); b.state.document.ypokatasthma = '0001';
    await assert.rejects(previewSubmissionRevision(b.options), { code: 'WTODAILY_REVISION_SCOPE_FORBIDDEN' });
    const c = fixture(); c.command.correction.row_id = 'missing-row';
    await assert.rejects(previewSubmissionRevision(c.options), { code: 'WTODAILY_REVISION_ROW_NOT_FOUND' });
});

test('overlapping correction or another unchanged overlapping day blocks whole preview', async () => {
    const a = fixture(); a.command.correction.intervals.push({ start: '18:29', end: '00:29' });
    await assert.rejects(previewSubmissionRevision(a.options), { code: 'ACCOUNTING_INTERVALS_OVERLAP' });
    const b = fixture(); const other = b.state.document.frozen_snapshot.daily_results.find(row => row.hmeromhnia.startsWith('2026-09-25'));
    other.apo_ora_02_apologistika = '18:28';
    b.state.document.frozen_snapshot_fingerprint = baselineFingerprint(b.state.document.frozen_snapshot);
    b.state.control.frozen_snapshot_fingerprint = b.state.document.frozen_snapshot_fingerprint;
    const blocked = await previewSubmissionRevision(b.options);
    assert.equal(blocked.ready_to_create, false);
    assert.equal(blocked.payload, null);
    await assert.rejects(createSubmissionRevision(b.approve(blocked)), { code: 'WTODAILY_REVISION_UNRESOLVED' });
});

test('time-only correction cannot silently turn a nonworking category into work', async () => {
    const f = fixture(); const target = f.state.document.frozen_snapshot.daily_results.find(row => row.hmeromhnia.startsWith('2026-09-27'));
    target.kathgoria_ergasias_apologistika = 'ΜΕ';
    f.state.document.frozen_snapshot_fingerprint = baselineFingerprint(f.state.document.frozen_snapshot);
    f.state.control.frozen_snapshot_fingerprint = f.state.document.frozen_snapshot_fingerprint;
    await assert.rejects(previewSubmissionRevision(f.options), { code: 'WTODAILY_REVISION_ROW_NOT_SUBMITTABLE' });
    assert.equal(f.state.inserts + f.state.fences, 0);
});

test('transaction rollback protects fence when insertion fails; stale fence cannot insert', async () => {
    for (const type of ['insertFailure', 'fenceConflict']) {
        const f = fixture(); const preview = await previewSubmissionRevision(f.options); f.state[type] = true;
        await assert.rejects(createSubmissionRevision(f.approve(preview)));
        assert.equal(f.state.control.write_fence_version, 0); assert.equal(f.state.inserts, 0);
    }
});

test('unprovisioned revision collection is blocked without creating collection or indexes', async () => {
    const f = fixture(); const preview = await previewSubmissionRevision(f.options);
    f.options.revisionModel.collection.indexes = async () => { throw new Error('NamespaceNotFound'); };
    await assert.rejects(createSubmissionRevision(f.approve(preview)), { code: 'WTODAILY_REVISION_STORAGE_NOT_READY' });
    assert.equal(f.state.inserts + f.state.fences, 0);
});

test('new routes retain existing authentication and critical-role gates; no sender wired to revision', () => {
    const routes = fs.readFileSync(require.resolve('../../routes/usersRoute'), 'utf8');
    for (const [suffix, handler] of [['preview', 'previewWtoDailySubmissionRevision'], ['create', 'createWtoDailySubmissionRevision']]) {
        assert.match(routes, new RegExp('submission/revision/' + suffix + "', checkAuth,[\\s\\S]*?requireEmploymentReviewAccess, requireCriticalEmploymentDecisionRole,[\\s\\S]*?erganhController\\." + handler));
    }
    const source = fs.readFileSync(require.resolve('../../controllers/ergazomenoi/erganhController'), 'utf8');
    const methods = source.slice(source.indexOf('static previewWtoDailySubmissionRevision'), source.indexOf('static currentWtoDailySubmissionRevision'));
    assert.doesNotMatch(methods, /uploadJsonDocumentToErgani|submitDocument|linkEmploymentPeriodSubmission/);
    const finalMethod = source.slice(source.indexOf('static submitFinalWTODayilyA'), source.indexOf('static linkEmploymentReviewPeriodSubmission'));
    assert.doesNotMatch(finalMethod, /revisionModel|revision\.payload/);
    assert.match(finalMethod, /WTODAILY_REVISION_SUBMISSION_DISABLED/);
});

test('revision model refuses update, replacement and deletion without any database connection', async () => {
    const Model = require('../../models/wtoDailySubmissionRevision');
    for (const query of [Model.updateOne({}, { $set: { submission_enabled: true } }),
        Model.replaceOne({}, {}), Model.deleteOne({}), Model.findOneAndUpdate({}, {})]) {
        await assert.rejects(query.exec(), /append-only/);
    }
    assert.equal(Model.schema.options.autoCreate, false);
    assert.equal(Model.schema.options.autoIndex, false);
});

test('approved revision validates against real schema and cannot enable submission', async () => {
    const f = fixture(); const preview = await previewSubmissionRevision(f.options);
    const result = await createSubmissionRevision(f.approve(preview));
    const Model = require('../../models/wtoDailySubmissionRevision');
    await new Model(result.revision).validate();
    await assert.rejects(new Model({ ...result.revision, submission_enabled: true }).validate(),
        error => Boolean(error.errors?.submission_enabled));
});

test('actual preview/create handlers use active server scope and require a separate approved request', async () => {
    const f = fixture();
    const source = fs.readFileSync(require.resolve('../../controllers/ergazomenoi/erganhController'), 'utf8');
    const bind = (name, next, dependencies) => {
        const start = source.indexOf('static ' + name + ' =');
        const section = source.slice(start, source.indexOf('static ' + next + ' =', start));
        return Function(...Object.keys(dependencies), 'return (' + section.slice(section.indexOf('=') + 1).trim().replace(/;$/, '') + ');')(...Object.values(dependencies));
    };
    const dependencies = { activeEmploymentReviewPeriodScope: async (_req, branch) => {
        assert.equal(branch, '0000'); return f.options.scope;
    }, previewSubmissionRevision: input => previewSubmissionRevision({ ...f.options, ...input }),
    createSubmissionRevision: input => createSubmissionRevision({ ...f.options, ...input }) };
    const previewHandler = bind('previewWtoDailySubmissionRevision', 'createWtoDailySubmissionRevision', dependencies);
    const createHandler = bind('createWtoDailySubmissionRevision', 'currentWtoDailySubmissionRevision', dependencies);
    const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; } });
    const request = { body: f.command, session: f.options.session };
    const previewResponse = response(); await previewHandler(request, previewResponse);
    assert.equal(previewResponse.body.success, true); assert.equal(f.state.inserts, 0);
    const unapproved = response(); await createHandler(request, unapproved);
    assert.equal(unapproved.statusCode, 409); assert.equal(f.state.inserts, 0);
    const approved = response(); await createHandler({ ...request,
        body: f.approve(previewResponse.body.preview).command }, approved);
    assert.equal(approved.statusCode, 201); assert.equal(approved.body.success, true);
    assert.equal(approved.body.revision.submission_enabled, false);
    assert.equal(f.state.inserts, 1);
});

test('unresolved inspection offers both endings and cannot save even with generic approval', async () => {
    const f = fixture(); const command = { reason: 'Συνθετικός έλεγχος', corrections: [] };
    const preview = await previewSubmissionRevision({ ...f.options, command });
    assert.equal(preview.ready_to_create, false); assert.equal(preview.payload, null);
    assert.deepEqual(preview.unresolved[0].options.map(item => item.end), ['00:28', '00:30']);
    assert.equal(preview.corrections[0].date, '2026-09-25');
    await assert.rejects(createSubmissionRevision({ ...f.approve(preview), command: { ...f.approve(preview).command,
        correction: undefined, ...command } }), { code: 'WTODAILY_REVISION_UNRESOLVED' });
    assert.equal(f.state.inserts + f.state.fences, 0);
});

for (const [keep, end, duration] of [[1, '00:28', 360], [2, '00:30', 362]]) {
    test(`explicit choice ${keep} creates one two-day edition with ending ${end} and full report parity`, async () => {
        const f = fixture(); const original = JSON.stringify(f.state.document);
        const command = { reason: 'Συνθετική ρητή επιλογή', corrections: [{ row_id: f.command.correction.row_id,
            date: '2026-09-27', keep_pair: keep, confirmed_actual_hours: true, intervals: [{ start: '18:28', end }] }] };
        const preview = await previewSubmissionRevision({ ...f.options, command });
        assert.equal(preview.corrections.length, 2);
        assert.equal(preview.corrections.find(row => row.date === '2026-09-27').confirmed_work_minutes, duration);
        const { assertWtoDailyControlPayloadParity } = require('./wtoDailySubmissionProjectionService');
        assert.equal(assertWtoDailyControlPayloadParity(preview.control_report.canonicalRows, preview.payload).valid, true);
        const input = { ...f.approve(preview), command: { ...f.approve(preview).command,
            correction: undefined, ...command } };
        const result = await createSubmissionRevision(input);
        assert.equal(result.revision.corrections.length, 2);
        assert.equal(result.revision.control_report.rows.find(row => row._date === '2026-09-25').zeugos1, '18:00 – 22:00');
        assert.equal((await createSubmissionRevision(input)).idempotent, true);
        assert.equal(f.state.inserts, 1); assert.equal(f.state.fences, 1);
        assert.equal(JSON.stringify(f.state.document), original);
    });
}

test('choice requires specific confirmation; mismatched pair and partial-overlap deletion are rejected', async () => {
    const f = fixture(); delete f.command.correction.confirmed_actual_hours;
    await assert.rejects(previewSubmissionRevision(f.options), { code: 'WTODAILY_REVISION_ACTUAL_HOURS_CONFIRMATION_REQUIRED' });
    f.command.correction.confirmed_actual_hours = true; f.command.correction.keep_pair = 1;
    await assert.rejects(previewSubmissionRevision(f.options), { code: 'WTODAILY_REVISION_SELECTION_MISMATCH' });
    const row = f.state.document.frozen_snapshot.daily_results.find(row => row.hmeromhnia.startsWith('2026-09-27'));
    row.apo_ora_02_apologistika = '20:00'; row.eos_ora_02_apologistika = '02:00';
    f.state.document.frozen_snapshot_fingerprint = baselineFingerprint(f.state.document.frozen_snapshot);
    f.state.control.frozen_snapshot_fingerprint = f.state.document.frozen_snapshot_fingerprint;
    f.command.correction.intervals = [{ start: '18:28', end: '00:28' }];
    await assert.rejects(previewSubmissionRevision(f.options), { code: 'WTODAILY_REVISION_PARTIAL_OVERLAP_REVIEW_REQUIRED' });
    assert.equal(f.state.inserts + f.state.fences, 0);
});

test('multiple explicitly selected dates share approval; duplicate row commands are rejected', async () => {
    const f = fixture(); const command = { reason: 'Πολλές ημέρες', corrections: [f.command.correction,
        { row_id: '507f1f77bcf86cd799439013', date: '2026-09-25', intervals: [{ start: '18:00', end: '22:00' }] }] };
    const preview = await previewSubmissionRevision({ ...f.options, command });
    assert.equal(preview.corrections.length, 2); assert.equal(preview.ready_to_create, true);
    command.corrections.push(f.command.correction);
    await assert.rejects(previewSubmissionRevision({ ...f.options, command }), { code: 'WTODAILY_REVISION_COMMAND_INVALID' });
});

test('human-reviewed partial overlap accepts only explicit nonoverlapping final hours', async () => {
    const f = fixture(); const row = f.state.document.frozen_snapshot.daily_results.find(row => row.hmeromhnia.startsWith('2026-09-27'));
    row.apo_ora_02_apologistika = '20:00'; row.eos_ora_02_apologistika = '02:00';
    f.state.document.frozen_snapshot_fingerprint = baselineFingerprint(f.state.document.frozen_snapshot);
    f.state.control.frozen_snapshot_fingerprint = f.state.document.frozen_snapshot_fingerprint;
    const original = JSON.stringify(f.state.document);
    f.command.correction.intervals = [{ start: '18:28', end: '23:00' }, { start: '23:30', end: '02:00' }];
    const preview = await previewSubmissionRevision(f.options);
    assert.equal(preview.ready_to_create, true);
    assert.deepEqual(analytics(preview.payload, '27/09/2026'), [
        { f_type: 'ΕΡΓ', f_from: '18:28', f_to: '23:00' }, { f_type: 'ΕΡΓ', f_from: '23:30', f_to: '02:00' }]);
    assert.equal(JSON.stringify(f.state.document), original);
});
