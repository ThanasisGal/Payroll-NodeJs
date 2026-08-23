'use strict';

const assert = require('assert');
const {
    NEXT_STAGE,
    resolveWeeklyHrWorkflow
} = require('./apasxoliseisWeeklyHrWorkflowResolverService');

const DATES = ['01', '02', '03', '04', '05', '06', '07']
    .map((day) => `2026-06-${day}`);

function workRow(date) {
    return {
        _id: `row-${date}`,
        hmeromhnia: date,
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_ores_ergasias: 8,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '17:00',
        apo_ora_01: '09:00',
        eos_ora_01: '17:00',
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        ores_ergasias_apologistika: 8,
        repo: false,
        repo_apologistika: false
    };
}

function repoRow(date, worked = false) {
    return {
        ...workRow(date),
        kathgoria_ergasias: 'ΑΝ',
        ores_ergasias: 0,
        cards_ores_ergasias: worked ? 8 : 0,
        cards_apo_ora_01: worked ? '09:00' : '',
        cards_eos_ora_01: worked ? '17:00' : '',
        kathgoria_ergasias_apologistika: worked ? 'ΕΡΓ' : 'ΑΝ',
        ores_ergasias_apologistika: worked ? 8 : 0,
        repo: true,
        repo_apologistika: !worked
    };
}

function possibleLeaveRow(date) {
    return {
        ...workRow(date),
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: '',
        kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ',
        ores_ergasias_apologistika: 0,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE'
    };
}

function profile(workdays = 5, extra = {}) {
    return {
        hmeres_ergasias_ebdomadas: workdays,
        typos_apasxolhshs: '0',
        pososto_prosayxhshs_6hs_hmeras: 40,
        ...extra
    };
}

function weekWith(...replacements) {
    const byDate = new Map(replacements.map((row) => [row.hmeromhnia, row]));
    return DATES.map((date) => byDate.get(date) || workRow(date));
}

function resolve(rows, options = {}) {
    return resolveWeeklyHrWorkflow({
        weekRows: rows,
        effectiveProfile: options.effectiveProfile || profile(),
        effectiveProfilesByDate: options.effectiveProfilesByDate || {},
        leave_classification_completed:
            options.leave_classification_completed ?? true,
        confirmed_leave_dates: options.confirmed_leave_dates || [],
        confirmed_sickness_dates: options.confirmed_sickness_dates || [],
        confirmed_absence_dates: options.confirmed_absence_dates || [],
        repo_resolution_completed: options.repo_resolution_completed ?? false,
        selected_repo_transfers: options.selected_repo_transfers || [],
        remaining_possible_leave_review_completed:
            options.remaining_possible_leave_review_completed ?? false,
        profile_changed_inside_week: options.profile_changed_inside_week === true
    });
}

// A. 01-07: one resting repo and one unclassified possible leave produce a direct proposal.
const directRows = weekWith(repoRow(DATES[2]), possibleLeaveRow(DATES[1]));
const directBeforeClassification = resolve(directRows, {
    leave_classification_completed: false
});
assert.strictEqual(directBeforeClassification.next_required_hr_stage,
    NEXT_STAGE.LEAVE_CLASSIFICATION);
assert.deepStrictEqual(directBeforeClassification.direct_repo_candidates, []);
const direct = resolve(directRows);
assert.deepStrictEqual(direct.direct_repo_candidates, [{
    date: DATES[1],
    reason: 'UNCLASSIFIED_POSSIBLE_LEAVE_CAN_FILL_REPO_REQUIREMENT'
}]);
assert.deepStrictEqual(direct.repo_transfer_candidates, []);
assert.strictEqual(direct.known_repo_identity_count, 1);
assert.strictEqual(direct.known_repo_identity_count_after_proposal, 2);
assert.strictEqual(direct.unresolved_repo_identity_count_after_proposed_resolution, 0);
assert.strictEqual(direct.next_required_hr_stage, NEXT_STAGE.REPO_RESOLUTION);
assert.deepStrictEqual(direct.unclassified_stage2_candidates, [{
    date: DATES[1], candidate_kind: 'REST_REPO',
    label: 'Προς εξέταση ως ΑΝΑΠΑΥΣΗ / ΡΕΠΟ'
}]);
// Employee 0004's confirmed full-time contract follows the same REST/REPO handoff.
const employee0004Candidate = resolve(directRows, {
    effectiveProfilesByDate: { [DATES[1]]: profile(5, { typos_apasxolhshs: '0' }) }
}).unclassified_stage2_candidates[0];
assert.strictEqual(employee0004Candidate.candidate_kind, 'REST_REPO');

// B/C/D. Leave, sickness and absence classifications all exclude the date from repo planning.
for (const field of [
    'confirmed_leave_dates',
    'confirmed_sickness_dates',
    'confirmed_absence_dates'
]) {
    const classified = resolve(directRows, { [field]: [DATES[1]] });
    assert.deepStrictEqual(classified.unclassified_possible_leave_days, []);
    assert.deepStrictEqual(classified.direct_repo_candidates, []);
    assert.deepStrictEqual(classified.repo_transfer_candidates, []);
}

// E. One date cannot receive two Stage-1 classifications.
const conflictingClassification = resolve(directRows, {
    confirmed_leave_dates: [DATES[1]],
    confirmed_sickness_dates: [DATES[1]]
});
assert.strictEqual(conflictingClassification.next_required_hr_stage, NEXT_STAGE.BLOCKED);
assert.ok(conflictingClassification.blocking_reasons.includes(
    'POSSIBLE_LEAVE_CLASSIFICATION_CONFLICT'));
const invalidClassification = resolve(directRows, {
    confirmed_absence_dates: [DATES[4]]
});
assert.strictEqual(invalidClassification.next_required_hr_stage, NEXT_STAGE.BLOCKED);
assert.ok(invalidClassification.blocking_reasons.includes(
    'CLASSIFIED_DATE_NOT_POSSIBLE_LEAVE'));

// ST/Z. 08-14 and 22-28 semantic transfer: worked identity + target identity.
const transferRows = weekWith(repoRow(DATES[2], true), possibleLeaveRow(DATES[3]));
const transfer = resolve(transferRows);
assert.strictEqual(transfer.repo_transfer_candidates.length, 1);
assert.deepStrictEqual(transfer.repo_transfer_candidates[0], {
    source_date: DATES[2],
    target_date: DATES[3],
    pair_key: `${DATES[2]}->${DATES[3]}`,
    semantic_only: true,
    apply_eligibility_not_evaluated: true
});
assert.strictEqual(transfer.resting_repo_count, 0);
assert.strictEqual(transfer.worked_repo_identity_count, 1);
assert.strictEqual(transfer.known_repo_identity_count, 0);
assert.strictEqual(transfer.unresolved_repo_identity_count_before_resolution, 2);
assert.strictEqual(transfer.known_repo_identity_count_after_proposal, 1);
assert.strictEqual(transfer.unresolved_repo_identity_count_after_proposed_resolution, 1);
assert.strictEqual(transfer.resting_repo_count_after_proposal, 1);
assert.strictEqual(transfer.next_required_hr_stage, NEXT_STAGE.REPO_RESOLUTION);

// Multiple equivalent targets remain proposals and are never selected arbitrarily.
const multiple = resolve(weekWith(
    repoRow(DATES[1], true), possibleLeaveRow(DATES[3]), possibleLeaveRow(DATES[4])
));
assert.strictEqual(multiple.repo_transfer_candidates.length, 2);
assert.strictEqual(multiple.unresolved_repo_identity_count_after_proposed_resolution, 2);
assert.ok(multiple.warnings.includes('MULTIPLE_EQUIVALENT_REPO_TRANSFER_CANDIDATES'));

// H. Seven actual workdays prohibit transfer but continue to final weekly checking.
const sevenDays = resolve(weekWith(repoRow(DATES[2], true)));
assert.strictEqual(sevenDays.repo_transfer_allowed, false);
assert.strictEqual(sevenDays.repo_transfer_prohibition_reason,
    'SEVEN_ACTUAL_WORK_DAYS_REPO_TRANSFER_FORBIDDEN');
assert.deepStrictEqual(sevenDays.repo_transfer_candidates, []);
assert.strictEqual(sevenDays.next_required_hr_stage, NEXT_STAGE.FINAL_WEEKLY_CHECK);
assert.deepStrictEqual(sevenDays.blocking_reasons, []);

// TH. Δηλωμένο ρεπό με εργασία δεν αποτελεί πραγματοποιημένη ανάπαυση.
const sixDay = resolve(weekWith(repoRow(DATES[2], true)), {
    effectiveProfile: profile(6)
});
assert.strictEqual(sixDay.expected_repo_count, 1);
assert.strictEqual(sixDay.known_repo_identity_count, 0);
assert.strictEqual(sixDay.unresolved_repo_identity_count_before_resolution, 1);

// I. 0009 stays contractual five-day with zero sixth-day rate.
const hotelProfile = profile(5, {
    eidikh_kathgoria_ergazomenoy: '0009',
    pososto_prosayxhshs_6hs_hmeras: 0
});
const hotel = resolve(transferRows, { effectiveProfile: hotelProfile });
assert.strictEqual(hotel.expected_repo_count, 2);
assert.strictEqual(hotelProfile.pososto_prosayxhshs_6hs_hmeras, 0);

// IA. A raw orphan proves work category but remains duration-blocking until HR approval.
const safeStartOnly = workRow(DATES[6]);
safeStartOnly.cards_apo_ora_01 = '09:00';
safeStartOnly.cards_eos_ora_01 = '';
safeStartOnly.cards_ores_ergasias = 0;
safeStartOnly.ores_ergasias_apologistika = 0;
const safeOrphan = resolve(weekWith(
    repoRow(DATES[2], true), possibleLeaveRow(DATES[3]), safeStartOnly
));
assert.strictEqual(safeOrphan.next_required_hr_stage, NEXT_STAGE.BLOCKED);
assert.ok(safeOrphan.blocking_reasons.includes('UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'));
assert.strictEqual(safeStartOnly.cards_eos_ora_01, '');
const approvedStartOnly = { ...safeStartOnly,
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '17:00',
    ores_ergasias_apologistika: 8,
    orphan_card_resolution: { status: 'HR_APPROVED',
        policy_version: 'orphan-card-continuous:v1' } };
const approvedOrphan = resolve(weekWith(
    repoRow(DATES[2], true), possibleLeaveRow(DATES[3]), approvedStartOnly
));
assert.ok(!approvedOrphan.blocking_reasons.includes('UNRESOLVED_INCOMPLETE_CARD_EVIDENCE'));

// Daily Stage-2 handoff semantics use the terms effective on each date.
const twoPossibleRows = weekWith(possibleLeaveRow(DATES[1]), possibleLeaveRow(DATES[3]));
const mixed = resolve(twoPossibleRows, {
    profile_changed_inside_week: true,
    effectiveProfile: profile(5, { profile_changed_inside_week: true }),
    effectiveProfilesByDate: {
        [DATES[1]]: profile(5, { typos_apasxolhshs: '0' }),
        [DATES[3]]: profile(5, { typos_apasxolhshs: '1' })
    }
});
assert.strictEqual(mixed.next_required_hr_stage, NEXT_STAGE.REPO_RESOLUTION);
assert.ok(!mixed.blocking_reasons.includes('PROFILE_CHANGED_INSIDE_WEEK'));
assert.deepStrictEqual(mixed.unclassified_stage2_candidates, [
    { date: DATES[1], candidate_kind: 'REST_REPO',
        label: 'Προς εξέταση ως ΑΝΑΠΑΥΣΗ / ΡΕΠΟ' },
    { date: DATES[3], candidate_kind: 'POSSIBLE_LEAVE_RESIDUAL',
        label: 'Προς τελική εξέταση ως ΠΙΘΑΝΗ ΑΔΕΙΑ' }
]);
const rotational = resolve(directRows, { effectiveProfilesByDate: {
    [DATES[1]]: profile(5, { typos_apasxolhshs: '2' }) } });
assert.strictEqual(rotational.unclassified_stage2_candidates[0].candidate_kind,
    'POSSIBLE_LEAVE_RESIDUAL');
assert.deepStrictEqual(rotational.direct_repo_candidates, []);

// Non-full daily semantics are driven by the effective profile of that date.
// No declared obligation and no work is ordinary non-work, never possible leave.
const partialNoDeclared = { ...workRow(DATES[1]), ores_ergasias: 0,
    apo_ora_01: '', eos_ora_01: '', cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', ores_ergasias_apologistika: 0,
    kathgoria_ergasias_apologistika: 'ΜΕ', kathgoria_adeias_apologistika: '' };
const partialNoDeclaredResult = resolve(weekWith(partialNoDeclared), {
    effectiveProfilesByDate: { [DATES[1]]: profile(5, { typos_apasxolhshs: '1' }) }
});
assert.deepStrictEqual(partialNoDeclaredResult.possible_leave_days, []);
assert.deepStrictEqual(partialNoDeclaredResult.remaining_possible_leave_days, []);

// Πραγματική Stage-2 canonical μορφή 0014: η προδηλωμένη υποχρέωση μένει
// αμετάβλητη, αλλά ΜΕ + repo=false δεν αποτελεί repo conflict.
const partialCanonicalNonWork = { ...workRow(DATES[1]), apologistiko_biblio: true,
    cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
    ores_ergasias_apologistika: 0, kathgoria_ergasias_apologistika: 'ΜΕ',
    kathgoria_adeias_apologistika: '', repo_apologistika: false,
    adeia_apologistika: false, astheneia_apologistika: false,
    apousia_apologistika: false };
const partialCanonicalNonWorkResult = resolve(weekWith(partialCanonicalNonWork), {
    leave_classification_completed: true,
    effectiveProfilesByDate: { [DATES[1]]: profile(5, { typos_apasxolhshs: '1' }) }
});
assert.ok(!partialCanonicalNonWorkResult.blocking_reasons.includes('CATEGORY_REPO_CONFLICT'));
assert.notStrictEqual(partialCanonicalNonWorkResult.next_required_hr_stage,
    NEXT_STAGE.BLOCKED);

// Actual work remains actual work whether or not a non-full day was declared.
const partialUndeclaredWork = { ...workRow(DATES[1]), ores_ergasias: 0,
    apo_ora_01: '', eos_ora_01: '' };
const partialUndeclaredWorkResult = resolve(weekWith(partialUndeclaredWork), {
    effectiveProfilesByDate: { [DATES[1]]: profile(5, { typos_apasxolhshs: '1' }) }
});
assert.deepStrictEqual(partialUndeclaredWorkResult.possible_leave_days, []);
assert.ok(partialUndeclaredWorkResult.worked_declared_repo_days.length === 0);
const mixedOpen = resolve(twoPossibleRows, { leave_classification_completed: false,
    profile_changed_inside_week: true,
    effectiveProfile: profile(5, { profile_changed_inside_week: true }) });
assert.strictEqual(mixedOpen.next_required_hr_stage, NEXT_STAGE.LEAVE_CLASSIFICATION);
assert.ok(!mixedOpen.blocking_reasons.includes('PROFILE_CHANGED_INSIDE_WEEK'));

// Existing immutability remains intact.
assert.ok(Object.isFrozen(transfer));
assert.ok(Object.isFrozen(transfer.repo_transfer_candidates));

console.log('weekly HR workflow resolver tests passed (11 locked scenarios)');
