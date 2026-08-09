const assert = require('assert');
const {
    AUTHORITY, RULE, resolveUniquePossibleLeaveTransfer,
    resolvePossibleLeaveTransfersInBatch
} = require('./apasxoliseisPossibleLeaveRepoAutoResolutionService');
const { classifyLeaveProvenance, LEAVE_PROVENANCE } = require('./apasxoliseisLeaveProvenanceService');

function row(day, overrides = {}) {
    return {
        _id: `0001-${day}`, kodikos: '0001', hmeromhnia: `2026-06-0${day}`,
        kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 7.57, cards_ores_ergasias: 7.57,
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '15:34',
        ...overrides
    };
}
function approval(source, overrides = {}) {
    return {
        _id: 'approval-1', reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
        decision_status: 'RECORDED', decision_type: 'APPROVE_PROPOSAL',
        created_by_user_name: 'HR User', created_at: '2026-05-20T10:00:00Z',
        items: [{ prodhlomena_oraria_id: source._id, employee_kodikos: '0001',
            hmeromhnia: source.hmeromhnia, kathgoria_ergasias: source.kathgoria_ergasias,
            cards_ores_ergasias: source.cards_ores_ergasias,
            proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }], ...overrides
    };
}
function exactWeek(extraTargets = 0) {
    const source = row(1, { kathgoria_ergasias: 'ΑΝ', repo: true });
    const target = row(2, { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
        adeia_apologistika: false, kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' });
    const existingRepo = row(3, { kathgoria_ergasias: 'ΑΝ', repo: true, cards_ores_ergasias: 0,
        repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΝ' });
    const rows = [source, target, existingRepo, row(4), row(5), row(6), row(7)];
    for (let index = 0; index < extraTargets; index += 1) Object.assign(rows[3 + index], {
        cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '', adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE'
    });
    return { source, target, rows, approvals: [approval(source)] };
}

(async () => {
    const fresh = exactWeek();
    assert.strictEqual(classifyLeaveProvenance(fresh.target), LEAVE_PROVENANCE.POSSIBLE_LEAVE);
    assert.strictEqual(fresh.target.adeia_apologistika, false);
    assert.strictEqual(fresh.target.kathgoria_adeias_apologistika, 'POSSIBLE_LEAVE');
    const resolved = resolveUniquePossibleLeaveTransfer({ weekRows: fresh.rows, approvals: fresh.approvals });
    assert.strictEqual(resolved.status, 'AUTO_RESOLVED');
    assert.strictEqual(resolved.source._id, '0001-1');
    assert.strictEqual(resolved.target._id, '0001-2');
    assert.strictEqual(resolved.audit.authority, AUTHORITY);
    assert.strictEqual(resolved.audit.rule, RULE);
    assert.strictEqual(resolved.audit.original_approval_id, 'approval-1');

    assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: fresh.rows.map((item) => item._id === fresh.target._id
            ? { ...item, kathgoria_adeias_apologistika: '' } : item), approvals: fresh.approvals
    }).status, 'NEEDS_HR');
    assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: exactWeek(1).rows, approvals: fresh.approvals
    }).status, 'NEEDS_HR');
    for (const overrides of [
        { reuse_status: 'REVOKED' }, { reuse_status: 'ACTIVE', reuse_effective_to: '2026-05-31' }
    ]) assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: fresh.rows, approvals: [approval(fresh.source, overrides)]
    }).status, 'NEEDS_HR');
    assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: fresh.rows, approvals: [fresh.approvals[0],
            { ...fresh.approvals[0], _id: 'approval-2' }]
    }).status, 'NEEDS_HR');
    const crossMonth = fresh.rows.map((item, index) => ({ ...item,
        hmeromhnia: ['2026-06-29', '2026-07-01', '2026-07-02', '2026-07-03',
            '2026-07-04', '2026-07-05', '2026-06-30'][index] }));
    assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: crossMonth, approvals: fresh.approvals
    }).status, 'NEEDS_HR');
    for (const targetOverride of [{ is_locked: true }, { manual_override: true }, { astheneia: true },
        { adeia: true }, { argia: true }]) assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: fresh.rows.map((item) => item._id === fresh.target._id ? { ...item, ...targetOverride } : item),
        approvals: fresh.approvals
    }).status, 'NEEDS_HR');
    assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: fresh.rows.map((item) => ({ ...item, mixed_profile: true })), approvals: fresh.approvals
    }).status, 'NEEDS_HR');

    const identitySet = new Set([resolved.atomic_pair_identity]);
    assert.strictEqual(resolveUniquePossibleLeaveTransfer({
        weekRows: fresh.rows, approvals: fresh.approvals, appliedPairIdentities: identitySet
    }).status, 'ALREADY_APPLIED');

    let queries = 0; let applies = 0;
    const largeWeeks = Array.from({ length: 2000 }, () => fresh.rows);
    const batch = await resolvePossibleLeaveTransfersInBatch({
        approvalModel: { find() { queries += 1; return { lean: async () => fresh.approvals }; } },
        approvalFilter: {}, weeklyRows: largeWeeks, appliedPairIdentities: new Set(),
        applyAtomicPair: async (item) => { applies += 1; return item.audit; }
    });
    assert.strictEqual(queries, 1);
    assert.strictEqual(batch.approval_queries, 1);
    assert.strictEqual(applies, 2000);

    const legacy = { ...fresh.target,
        adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΑΛ' };
    assert.strictEqual(classifyLeaveProvenance(legacy), LEAVE_PROVENANCE.AUTO_CALCULATED_LEAVE);
    assert.strictEqual(classifyLeaveProvenance({ ...legacy, adeia: true }), LEAVE_PROVENANCE.HR_DECLARED_LEAVE);
    console.log('PASS possible-leave automatic repo resolution (18 tests)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
