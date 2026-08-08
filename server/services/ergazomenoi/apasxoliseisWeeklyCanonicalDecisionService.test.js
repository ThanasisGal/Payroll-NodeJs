'use strict';

const assert = require('assert/strict');
const {
    APPLICABILITY,
    buildCanonicalWeeklyDecisionSnapshot,
    validateDecisionCommand,
    recordWeeklyCanonicalDecision,
    getLatestApplicableWeeklyCanonicalDecision
} = require('./apasxoliseisWeeklyCanonicalDecisionService');

const session = { userTeam: 'THA', companyInUse: 'company-a', userId: '507f191e810c19729de860ea',
    userName: 'HR User', userRole: 'HR', userStatus: 'A' };
const baseInput = {
    team: 'THA', company_kod: 'company-a', ypokatasthma: '0001', employee_kodikos: '001',
    employee_id: '507f191e810c19729de860eb', week_start: '2026-06-01', week_end: '2026-06-07',
    weekly_rows: [
        { _id: 'row-1', hmeromhnia: '2026-06-01', kathgoria_ergasias: 'ΕΡΓ',
            kathgoria_ergasias_apologistika: 'ΕΡΓ', repo: false, repo_apologistika: false,
            ores_ergasias: 8, ores_ergasias_apologistika: 7.5, cards_ores_ergasias: 7.5,
            cards_apo_ora_01: '09:00', cards_eos_ora_01: '16:30' },
        { _id: 'row-2', hmeromhnia: '2026-06-07', kathgoria_ergasias: 'ΑΝ',
            kathgoria_ergasias_apologistika: 'ΑΝ', repo: true, repo_apologistika: true }
    ],
    current_repo_identities: ['2026-06-06', '2026-06-07'],
    actual_work_facts: { actual_work_dates: ['2026-06-01'] },
    effective_profile: { hmeres_ergasias_ebdomadas: 5, source: 'HISTORY' },
    profile_history: [{ id: 'history-1', effective_from: '2026-05-01', weekly_days: 5 }],
    canonical_status: 'NEEDS_HR_DECISION', canonical_reasons: ['CARD_VERIFICATION_PENDING'],
    policy_version: 'weekly-sixth-seventh:v1', source_version: 'post-check:v1'
};
const commands = {
    profile: { decision_type: 'PROFILE_CHANGED_INSIDE_WEEK', request_id: 'request-profile',
        decision_payload: { profile_outcome: 'USE_PROFILE', profile_reference: { history_id: 'history-1' },
            selected_profile_reference: { kind: 'HISTORY', id: 'history-1' },
            selected_profile_fingerprint: 'a'.repeat(64) } },
    card: { decision_type: 'CARD_VERIFICATION_PENDING', request_id: 'request-card',
        decision_payload: { verified: true, evidence_reference: 'AUDIT:card-correction-1', corrected_row_ids: ['row-1'] } },
    repo: { decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', request_id: 'request-repo',
        decision_payload: { current_repo_identities: ['2026-06-06', '2026-06-07'] } },
    classification: { decision_type: 'CLASSIFICATION_BY_DATE', request_id: 'request-classification',
        decision_payload: { classification_by_date: { '2026-06-06': 'SIXTH', '2026-06-07': 'NORMAL' } } }
};
const indexesReady = async () => ({ ready: true, code: null });

function chain(value) { return { sort() { return this; }, limit() { return this; }, lean: async () => value }; }
function matches(record, filter) {
    return Object.entries(filter).every(([key, value]) => {
        const left = record[key];
        if (left instanceof Date || value instanceof Date) return new Date(left).getTime() === new Date(value).getTime();
        return String(left) === String(value);
    });
}
function model(seed = []) {
    const records = [...seed];
    return {
        records,
        findOne(filter) { return chain(records.find((record) => matches(record, filter)) || null); },
        find(filter) { return chain(records.filter((record) => matches(record, filter))); },
        async create(record) { const saved = { _id: `decision-${records.length + 1}`, ...record }; records.push(saved); return saved; }
    };
}
function changed(path, value) {
    const copy = structuredClone(baseInput);
    let target = copy; const keys = path.split('.');
    keys.slice(0, -1).forEach((key) => { target = target[key]; }); target[keys.at(-1)] = value;
    return copy;
}

(async () => {
    const canonical = buildCanonicalWeeklyDecisionSnapshot(baseInput);
    assert.equal(canonical.scope.scope_key, 'THA|company-a|0001|001|2026-06-01|2026-06-07');
    for (const command of Object.values(commands)) assert.doesNotThrow(() => validateDecisionCommand({ session, command, currentInput: baseInput }));
    assert.throws(() => validateDecisionCommand({ session, currentInput: baseInput, command: {
        decision_type: 'PROFILE_CHANGED_INSIDE_WEEK', request_id: 'request-old-profile',
        decision_payload: { profile_outcome: 'USE_PROFILE',
            profile_reference: { history_id: 'history-1' } }
    } }), /deterministic/);

    const store = model();
    const first = await recordWeeklyCanonicalDecision({ session, command: commands.card, currentInput: baseInput, decisionModel: store, indexReadinessGuard: indexesReady });
    assert.equal(first.idempotent, false);
    const retry = await recordWeeklyCanonicalDecision({ session, command: commands.card, currentInput: baseInput, decisionModel: store, indexReadinessGuard: indexesReady });
    assert.equal(retry.idempotent, true);
    assert.equal(store.records.length, 1);
    assert.equal((await getLatestApplicableWeeklyCanonicalDecision({ session, currentInput: baseInput, decisionModel: store })).applicability, APPLICABILITY.APPLICABLE);
    assert.equal((await getLatestApplicableWeeklyCanonicalDecision({
        session: { ...session, userRole: 'U' }, currentInput: baseInput, decisionModel: store
    })).applicability, APPLICABILITY.APPLICABLE);

    for (const input of [
        changed('weekly_rows.0.cards_ores_ergasias', 6),
        changed('effective_profile.hmeres_ergasias_ebdomadas', 6),
        changed('current_repo_identities.0', '2026-06-05'),
        changed('canonical_reasons.0', 'PROFILE_CHANGED_INSIDE_WEEK')
    ]) assert.equal((await getLatestApplicableWeeklyCanonicalDecision({ session, currentInput: input, decisionModel: store })).applicability, APPLICABILITY.STALE);

    for (const [field, value] of [
        ['employee_kodikos', '002'], ['ypokatasthma', '0002'], ['company_kod', 'company-b'],
        ['week', ['2026-06-08', '2026-06-14']]
    ]) {
        const input = structuredClone(baseInput);
        if (field === 'week') { input.week_start = value[0]; input.week_end = value[1]; input.weekly_rows = []; }
        else input[field] = value;
        const scopedSession = field === 'company_kod' ? { ...session, companyInUse: value } : session;
        assert.equal((await getLatestApplicableWeeklyCanonicalDecision({ session: scopedSession, currentInput: input, decisionModel: store })).applicability, APPLICABILITY.NOT_FOUND);
    }

    const conflictRecord = { ...store.records[0], _id: 'decision-2', request_id: 'request-other',
        decision_type: 'CLASSIFICATION_BY_DATE', decision_payload_fingerprint: 'f'.repeat(64), created_at: new Date() };
    store.records.push(conflictRecord);
    assert.equal((await getLatestApplicableWeeklyCanonicalDecision({ session, currentInput: baseInput, decisionModel: store })).applicability, APPLICABILITY.CONFLICT);
    await assert.rejects(() => recordWeeklyCanonicalDecision({ session,
        command: { ...commands.classification, request_id: 'request-conflict' }, currentInput: baseInput,
        decisionModel: store, indexReadinessGuard: indexesReady }),
    (error) => error.code === 'CONFLICTING_APPLICABLE_DECISIONS');

    const periodLockedStore = model(); let canonicalCreates = 0;
    periodLockedStore.create = async () => { canonicalCreates++; };
    await assert.rejects(() => recordWeeklyCanonicalDecision({ session,
        command: { ...commands.card, request_id: 'request-period-locked' }, currentInput: baseInput,
        decisionModel: periodLockedStore, indexReadinessGuard: indexesReady,
        mutationRunner: async () => { const error = new Error('locked'); error.code = 'PERIOD_CONTROL_STATE_CONFLICT'; throw error; }
    }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    assert.equal(canonicalCreates, 0);

    const rollbackStore = model(); let stagedCanonicalRecord = null;
    rollbackStore.create = async (records, options) => {
        assert.ok(Array.isArray(records)); assert.ok(options.session);
        stagedCanonicalRecord = { _id: 'staged-canonical', ...records[0] };
        return [stagedCanonicalRecord];
    };
    await assert.rejects(() => recordWeeklyCanonicalDecision({ session,
        command: { ...commands.card, request_id: 'request-period-commit-race' }, currentInput: baseInput,
        decisionModel: rollbackStore, indexReadinessGuard: indexesReady,
        mutationRunner: async (write) => {
            await write({ id: 'period-transaction' });
            const error = new Error('transaction rolled back'); error.code = 'PERIOD_CONTROL_STATE_CONFLICT'; throw error;
        }
    }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    assert.ok(stagedCanonicalRecord);
    assert.equal(rollbackStore.records.length, 0);

    await assert.rejects(() => recordWeeklyCanonicalDecision({ session,
        command: { ...commands.card, request_id: 'request-index-missing' }, currentInput: baseInput,
        decisionModel: model(), indexReadinessGuard: async () => {
            const error = new Error('not ready'); error.code = 'CANONICAL_DECISION_INDEXES_NOT_READY';
            error.statusCode = 503; throw error;
        } }), (error) => error.code === 'CANONICAL_DECISION_INDEXES_NOT_READY');

    const raceBase = model();
    const raceValidated = validateDecisionCommand({ session,
        command: { ...commands.card, request_id: 'request-race-same' }, currentInput: baseInput });
    raceBase.create = async (record) => {
        raceBase.records.push({ _id: 'race-winner', ...record });
        const error = new Error('E11000 request race'); error.code = 11000; throw error;
    };
    const racedSame = await recordWeeklyCanonicalDecision({ session,
        command: { ...commands.card, request_id: 'request-race-same' }, currentInput: baseInput,
        decisionModel: raceBase, indexReadinessGuard: indexesReady });
    assert.equal(racedSame.idempotent, true);
    assert.equal(racedSame.record.command_identity, raceValidated.commandIdentity);

    const historyStore = model();
    await recordWeeklyCanonicalDecision({ session, command: commands.card, currentInput: baseInput,
        decisionModel: historyStore, indexReadinessGuard: indexesReady });
    await recordWeeklyCanonicalDecision({ session,
        command: { ...commands.card, request_id: 'request-new-snapshot' },
        currentInput: changed('weekly_rows.0.cards_ores_ergasias', 6),
        decisionModel: historyStore, indexReadinessGuard: indexesReady });
    assert.equal(historyStore.records.length, 2);

    const requestConflict = model();
    requestConflict.create = async (record) => {
        requestConflict.records.push({ ...record, _id: 'other-request-winner', command_identity: '0'.repeat(64) });
        const error = new Error('duplicate request'); error.code = 11000; throw error;
    };
    await assert.rejects(() => recordWeeklyCanonicalDecision({ session,
        command: { ...commands.card, request_id: 'request-race-different' }, currentInput: baseInput,
        decisionModel: requestConflict, indexReadinessGuard: indexesReady }),
    (error) => error.code === 'REQUEST_ID_CONFLICT');

    const logicalConflict = model();
    logicalConflict.create = async (record) => {
        logicalConflict.records.push({ ...record, _id: 'logical-winner', request_id: 'other-request',
            command_identity: '1'.repeat(64), decision_type: 'CLASSIFICATION_BY_DATE',
            decision_payload_fingerprint: '2'.repeat(64) });
        const error = new Error('duplicate snapshot slot'); error.code = 11000; throw error;
    };
    await assert.rejects(() => recordWeeklyCanonicalDecision({ session,
        command: { ...commands.card, request_id: 'request-logical-race' }, currentInput: baseInput,
        decisionModel: logicalConflict, indexReadinessGuard: indexesReady }),
    (error) => error.code === 'CONFLICTING_APPLICABLE_DECISIONS');

    const appliedInput = { ...baseInput, applied_atomic_repo_transfer: { execution_id: 'execution-1' } };
    assert.throws(() => validateDecisionCommand({ session, command: commands.repo, currentInput: appliedInput }),
        (error) => error.code === 'APPLIED_ATOMIC_REPO_TRANSFER_CONFLICT');
    assert.doesNotThrow(() => validateDecisionCommand({ session,
        command: { ...commands.repo, decision_payload: { ...commands.repo.decision_payload, applied_execution_id: 'execution-1' } },
        currentInput: appliedInput }));

    console.log('weekly canonical decision service tests passed (39 contracts)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
