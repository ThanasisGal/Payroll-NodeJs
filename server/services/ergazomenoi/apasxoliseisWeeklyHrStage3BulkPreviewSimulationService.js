'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { planCanonicalDailyClassification } = require(
    './apasxoliseisCanonicalDailyClassificationWriterService');
const { buildWeeklyHrLifecycleProjection } = require(
    './apasxoliseisWeeklyHrLifecycleProjectionService');
const { findStage1PeriodSlice, periodSliceKey } = require(
    './apasxoliseisStage1PeriodSliceService');
const { positiveClassification } = require('./apasxoliseisStage3FingerprintService');

function fail(code, message) {
    throw Object.assign(new Error(message), { code, statusCode: 409 });
}
function projection(source, rows, state) {
    const inputs = source.simulation_inputs;
    return buildWeeklyHrLifecycleProjection({
        weekRows: rows,
        effectiveProfile: inputs.effectiveProfile,
        effectiveProfilesByDate: inputs.effectiveProfilesByDate,
        persistedStage1State: state.stage1,
        persistedStage2State: state.stage2,
        persistedStage3State: state.stage3,
        scope: source.scope,
        periodScope: inputs.periodScope,
        employmentDateScope: inputs.employmentDateScope
    });
}
function rebaseTrustedStage1(state, lifecycle, source) {
    const stage1 = lifecycle.stages.stage1;
    const current = stage1.current_completion_fingerprint;
    if (!/^[a-f0-9]{64}$/.test(current)) fail('STAGE3_PREVIEW_SIMULATION_FINGERPRINT_MISSING',
        'Δεν υπολογίστηκε ασφαλές αποτύπωμα του Σταδίου 1.');
    if (source.upstream?.stage1_attestation_scope === 'PERIOD_SLICE') {
        const context = stage1.current_context_fingerprint;
        if (!/^[a-f0-9]{64}$/.test(context)) fail(
            'STAGE3_PREVIEW_SIMULATION_CONTEXT_FINGERPRINT_MISSING',
            'Δεν υπολογίστηκε ασφαλές αποτύπωμα εβδομαδιαίου πλαισίου.');
        const old = findStage1PeriodSlice(state.stage1,
            source.upstream.stage1_period_start, source.upstream.stage1_period_end);
        if (!old || old.status !== 'COMPLETED') fail('STAGE3_PREVIEW_SIMULATION_STAGE1_INVALID',
            'Η βεβαίωση του Σταδίου 1 δεν είναι διαθέσιμη.');
        state.stage1 = { ...state.stage1,
            version: Number(state.stage1.version || 0) + 1,
            period_slices: state.stage1.period_slices.map((slice) =>
                periodSliceKey(slice) === periodSliceKey(old)
                    ? { ...slice, context_fingerprint: context,
                        effective_fingerprint: current,
                        version: Number(slice.version || 0) + 1 } : slice) };
    } else {
        state.stage1 = { ...state.stage1, effective_fingerprint: current,
            version: Number(state.stage1.version || 0) + 1 };
    }
}
function makeSimulation(source) {
    if (!source?.simulation_inputs || !source.workflowState ||
        !Array.isArray(source.weekRows)) fail('STAGE3_PREVIEW_SIMULATION_CONTEXT_MISSING',
        'Δεν είναι διαθέσιμο το πλήρες πλαίσιο προεπισκόπησης.');
    const rows = source.weekRows.map((row) => ({ ...row }));
    const state = structuredClone(source.workflowState);
    let lifecycle = projection(source, rows, state);
    let applied = 0;
    return {
        inspect(item) {
            const row = rows.find((candidate) => String(candidate._id) === item.row_id &&
                dateKeyUtc(candidate.hmeromhnia) === item.decision_date);
            if (!row) fail('STAGE3_ROW_SCOPE_MISMATCH',
                'Η επιλεγμένη ημέρα δεν ανήκει στην εβδομάδα.');
            const pending = (lifecycle.stages.stage3.pending_dates || [])
                .includes(item.decision_date);
            if (pending) return { outcome: 'APPLY' };
            const automatic = (lifecycle.stages.stage3.stage2_automatic_resolution_items || [])
                .find((entry) => dateKeyUtc(entry.date) === item.decision_date &&
                    ['REST_REPO', 'NON_WORK'].includes(entry.classification) &&
                    ['DETERMINISTIC_STAGE2_REPO_RESOLUTION',
                        'STAGE1_REVIEWED_NON_FULL_WITHOUT_ACTUAL_WORK'].includes(entry.reason));
            if (!applied || !automatic || positiveClassification(row) || row.is_locked === true ||
                lifecycle.stages.stage1.business_status !== 'COMPLETED' ||
                lifecycle.stages.stage2.business_status !== 'COMPLETED') fail(
                'STAGE3_DATE_NOT_RESIDUAL',
                'Η ημέρα δεν αποτελεί πλέον εκκρεμότητα του Stage 3.');
            return { outcome: 'AUTO_SATISFIED',
                automatic_classification: automatic.classification,
                reason: automatic.reason };
        },
        apply(item, command) {
            const row = rows.find((candidate) => String(candidate._id) === item.row_id);
            const updates = planCanonicalDailyClassification({ row,
                classification: command.final_classification,
                leave_category: command.leave_category });
            Object.assign(row, updates, { is_locked: true });
            if (updates.kathgoria_ergasias_apologistika) {
                row.kathgoria_ergasias = updates.kathgoria_ergasias_apologistika;
                row.kathgoria_ergasias_effective = row.kathgoria_ergasias;
            }
            let after = projection(source, rows, state);
            rebaseTrustedStage1(state, after, source);
            after = projection(source, rows, state);
            const remaining = after.stages.stage3.pending_dates || [];
            if (remaining.includes(item.decision_date) ||
                after.stages.stage1.business_status !== 'COMPLETED' ||
                after.stages.stage2.business_status !== 'COMPLETED') fail(
                'STAGE3_PREVIEW_SIMULATION_DIVERGED',
                'Η διαδοχική προεπισκόπηση δεν μπορεί να ολοκληρωθεί με ασφάλεια.');
            state.stage3 = { ...state.stage3,
                status: remaining.length ? 'OPEN' : 'COMPLETED',
                version: Number(state.stage3?.version || 0) + 1,
                depends_on_stage2_fingerprint: after.stages.stage3.stage2_fingerprint };
            lifecycle = projection(source, rows, state);
            applied++;
        }
    };
}

module.exports = { makeSimulation };
