'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');
const { buildWeeklyHrLifecycleProjection } = require(
    './apasxoliseisWeeklyHrLifecycleProjectionService');
const { planCanonicalDailyClassification } = require(
    './apasxoliseisCanonicalDailyClassificationWriterService');
const { buildWeeklyHrStage3BulkPreview } = require(
    './apasxoliseisWeeklyHrStage3BulkPreviewService');
const { applyWeeklyHrStage3Bulk } = require(
    './apasxoliseisWeeklyHrWorkflowStage3BulkApplyService');

const employeeId = new mongoose.Types.ObjectId();
const actorId = new mongoose.Types.ObjectId();
const ids = Array.from({ length: 7 }, () => new mongoose.Types.ObjectId());
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: employeeId, employee_kodikos: '0003',
    week_start: new Date('2026-05-25Z'), week_end: new Date('2026-05-31Z') };
const profile = { hmeres_ergasias_ebdomadas: 5, kathestos_apasxolhshs: '0',
    typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH' };
const rows = ids.map((id, index) => ({ _id: id, team: 'THA', company_kod: 'company',
    ypokatasthma: '0000', kodikos: '0003',
    hmeromhnia: new Date(Date.UTC(2026, 4, 25 + index)),
    updatedAt: new Date('2026-09-10Z'),
    kathgoria_ergasias: index === 0 ? 'ΑΝ' : 'ΕΡΓ',
    kathgoria_ergasias_apologistika: index === 0 ? 'ΑΝ' : '',
    ores_ergasias: index === 0 ? 0 : 8,
    repo_apologistika: index === 0,
    cards_ores_ergasias: index >= 4 ? 9 : 0,
    ores_ergasias_apologistika: index >= 4 ? 9 : 0,
    kathgoria_adeias_apologistika: index >= 1 && index <= 3
        ? 'POSSIBLE_LEAVE' : '',
    apousia_apologistika: false, adeia_apologistika: false,
    astheneia_apologistika: false }));
const originalFingerprint = buildStage1Fingerprint(rows).fingerprint;
const state = { stage1: { status: 'COMPLETED', version: 1,
    completion_fingerprint: originalFingerprint,
    effective_fingerprint: originalFingerprint },
stage2: null, stage3: { status: 'OPEN', version: 0 } };
const profiles = Object.fromEntries(rows.map((row) =>
    [row.hmeromhnia.toISOString().slice(0, 10), profile]));
function lifecycle() {
    return buildWeeklyHrLifecycleProjection({ weekRows: rows,
        effectiveProfile: profile, effectiveProfilesByDate: profiles,
        persistedStage1State: state.stage1, persistedStage2State: state.stage2,
        persistedStage3State: state.stage3, scope });
}
function context(item) {
    const current = lifecycle();
    const row = rows.find((candidate) => String(candidate._id) === item.row_id);
    return { scope, row, weekRows: rows, employee_name: 'Εργαζόμενος 0003',
        dailyProfile: profile,
        actualFacts: { countsAsActualWorkDay: false },
        isResidual: current.stages.stage3.pending_dates.includes(item.decision_date),
        upstream: { stage1_attestation_scope: 'FULL_WEEK',
            stage1_current_fingerprint: current.stages.stage1.current_completion_fingerprint,
            stage3_version: state.stage3.version },
        lifecycle: { ...current, employment_date_scope: {
            authoritative_date_set: rows.map((entry) =>
                entry.hmeromhnia.toISOString().slice(0, 10)),
            context_only_dates: [] } }, workflowState: state,
        simulation_inputs: { effectiveProfile: profile,
            effectiveProfilesByDate: profiles,
            periodScope: null, employmentDateScope: null } };
}

(async () => {
    assert.deepEqual(lifecycle().stages.stage3.pending_dates,
        ['2026-05-26', '2026-05-27', '2026-05-28']);
    const items = [1, 2, 3].map((index) => {
        const item = { employee_id: String(employeeId), employee_kodikos: '0003',
            week_start: '2026-05-25', week_end: '2026-05-31',
            row_id: String(ids[index]), decision_date: `2026-05-${25 + index}` };
        return { ...item, expected_input_fingerprint:
            buildStage3InputFingerprint(context(item)).fingerprint,
        expected_stage3_version: 0 };
    });
    const command = { ypokatasthma: '0000', period_start: '2026-05-01',
        period_end: '2026-05-31', final_classification: 'ABSENCE',
        leave_category: '', items };
    const preview = await buildWeeklyHrStage3BulkPreview({ command,
        requestScope: { team: 'THA', company_kod: 'company' },
        loadAuthoritativeContext: context, simulateSequential: true });
    assert.equal(preview.can_apply, true, JSON.stringify(preview.invalid_items));
    assert.equal(preview.selected_count, 3);
    assert.equal(preview.will_apply_count, 2);
    assert.equal(preview.auto_satisfied_count, 1);
    assert.deepEqual(preview.items.map((item) => item.outcome),
        ['APPLY', 'APPLY', 'AUTO_SATISFIED']);
    assert.equal(preview.items[2].automatic_classification, 'REST_REPO');
    assert.equal(preview.items[2].reason, 'DETERMINISTIC_STAGE2_REPO_RESOLUTION');
    assert.equal(rows[3].apousia_apologistika, false);
    assert.equal(state.stage3.version, 0);

    const audits = []; const dailyWrites = [];
    const auditModel = {
        find: (filter) => ({ session() { return this; }, lean: async () => {
            const regex = new RegExp(filter.request_id.$regex);
            return audits.filter((audit) => regex.test(audit.request_id));
        } }),
        create: async ([audit]) => { audits.push(audit); return [audit]; }
    };
    const applyCommand = { ...command,
        bulk_request_id: 'stage3-bulk:preview-parity-fixture',
        expected_preview_fingerprint: preview.preview_fingerprint,
        reason_or_notes: 'Δοκιμή διαδοχικής προεπισκόπησης' };
    const result = await applyWeeklyHrStage3Bulk({ command: applyCommand,
        requestScope: { team: 'THA', company_kod: 'company' },
        actor: { user_id: String(actorId), user_name: 'Ελεγκτής', role: 'A' },
        auditModel, runAtomic: (work) => work({ session: {},
            period_control_version: 1, period_write_fence_version: 1 }),
        loadAuthoritativeContext: context,
        resolveOne: async ({ item, command: selected, request_id, command_identity }) => {
            const row = rows.find((candidate) => String(candidate._id) === item.row_id);
            Object.assign(row, planCanonicalDailyClassification({ row,
                classification: selected.final_classification,
                leave_category: selected.leave_category }),
            { is_locked: true, updatedAt: new Date(Date.UTC(2026, 8, 11 + dailyWrites.length)) });
            dailyWrites.push(item.row_id);
            const after = lifecycle();
            state.stage1.effective_fingerprint = after.stages.stage1.current_completion_fingerprint;
            state.stage1.version++;
            state.stage3.version++;
            state.stage3.status = after.stages.stage3.pending_dates.length
                ? 'OPEN' : 'COMPLETED';
            state.stage3.depends_on_stage2_fingerprint = after.stages.stage3.stage2_fingerprint;
            audits.push({ request_id, command_identity, action: 'STAGE3_DAILY_RESOLVED',
                stage_version: state.stage3.version,
                after_stage: { status: state.stage3.status } });
            return { stage3_status: state.stage3.status,
                stage3_version: state.stage3.version,
                remaining_count: after.stages.stage3.pending_dates.length };
        } });
    assert.deepEqual(result.results.map((item) => item.status),
        preview.items.map((item) => item.outcome === 'APPLY'
            ? 'APPLIED' : 'AUTO_SATISFIED'));
    assert.equal(result.applied_count, preview.will_apply_count);
    assert.equal(result.auto_satisfied_count, preview.auto_satisfied_count);
    assert.equal(dailyWrites.length, 2);
    assert.equal(rows[3].apousia_apologistika, false);
    assert.equal(audits.filter((audit) =>
        audit.action === 'STAGE3_BULK_ITEM_AUTO_SATISFIED').length, 1);
    console.log('Stage-3 sequential bulk preview/apply parity regression passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
