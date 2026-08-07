const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildReviewExportProjection,
    illegalBreakdown,
    decisionIsActiveApplied
} = require('./apasxoliseisReviewExportProjectionService');

function day(date, cards, declared = cards, extra = {}) {
    return {
        hmeromhnia: date, kodikos: '0004', ypokatasthma: '0001', exportYpokatasthma: '0001',
        employeeName: 'ΔΟΚΙΜΗ ΕΛΕΝΗ', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: declared,
        cards_ores_ergasias: cards, cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
        effective_weekly_workdays: 5, effective_sixth_day_rate: 40,
        ores_ergasias_apologistika: declared, ...extra
    };
}
function week(start = '2026-06-15', cards = [8.6, 7.97, 6.48, 7.32, 7.42, 8.12, 7.28]) {
    return cards.map((hours, index) => {
        const date = new Date(`${start}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + index);
        return day(date.toISOString().slice(0, 10), hours, index === 6 ? 6.78 : hours);
    });
}

function atomicFixture({ status = 'NEEDS_REVIEW', diagnostics = [], reusableDecision } = {}) {
    return {
        groups: [{
            group_id: 'atomic-export-1',
            group_key: 'atomic-export-key-1',
            group_type: 'ATOMIC_PAIRED_PROPOSAL',
            decision_grain: 'ATOMIC_LINKED_SET',
            count: 2,
            decision_units_count: 1,
            status,
            atomic_reusable_diagnostics: diagnostics,
            reusable_decision: reusableDecision,
            items: [
                { role: 'SOURCE_BECOMES_WORK', prodhlomena_oraria_id: 'row-source' },
                { role: 'TARGET_BECOMES_REPO', prodhlomena_oraria_id: 'row-target' }
            ]
        }]
    };
}

function atomicRows() {
    const rows = week('2026-06-29', [0, 7, 7, 7, 7, 0, 0]);
    rows.forEach((row, index) => { row._id = `week-row-${index}`; });
    Object.assign(rows[0], {
        _id: 'row-source',
        kathgoria_ergasias: 'ΑΝ',
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        ores_ergasias_apologistika: 7.25
    });
    Object.assign(rows[1], {
        _id: 'row-target',
        kathgoria_ergasias: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: 'ΑΝ',
        ores_ergasias_apologistika: 0
    });
    return rows;
}

test('Monday-Sunday boundaries survive month and year changes', () => {
    const rows = week('2026-12-28', [7, 7, 7, 7, 7, 7, 0]);
    const projection = buildReviewExportProjection({ rows });
    assert.equal(projection.rows[0].policy.weekStart, '2026-12-28');
    assert.equal(projection.rows[0].policy.weekEnd, '2027-01-03');
    assert.equal(projection.rows.filter((row) => row.policy.classification === 'SIXTH').length, 1);
    assert.equal(projection.rows.filter((row) => row.policy.classification === 'SEVENTH').length, 0);
});

test('0004 regression: 19/06 sixth 7.42, 21/06 seventh, illegal total 6.78', () => {
    const rows = week();
    Object.assign(rows[6], {
        ores_paranomhs_yperorias_argion_apologistika: 6.78,
        ores_nominhs_yperorias_apologistika: 0,
        ores_yperergasias_apologistika: 0
    });
    const projection = buildReviewExportProjection({ rows });
    const friday = projection.rows.find((row) => String(row.hmeromhnia).startsWith('2026-06-19'));
    const sunday = projection.rows.find((row) => String(row.hmeromhnia).startsWith('2026-06-21'));
    assert.equal(friday.policy.classification, 'SIXTH');
    assert.equal(friday.policy.sixthDayHours, 7.42);
    assert.equal(sunday.policy.classification, 'SEVENTH');
    assert.equal(sunday.illegalOvertime.total, 6.78);
    assert.equal(sunday.ores_nominhs_yperorias_apologistika, 0);
    assert.equal(sunday.ores_yperergasias_apologistika, 0);
    assert.equal(projection.totals.grand.illegalTotal, 6.78);
});

test('sixth-day export prefers declared row hours and uses them in every total', () => {
    const rows = week('2026-06-15', [8.6, 7.97, 6.48, 7.32, 7.92, 8.12, 7.28]);
    rows[4].ores_ergasias = 7.42;
    rows[4].ores_ergasias_apologistika = 7.42;

    const projection = buildReviewExportProjection({ rows });
    const sixthDay = projection.rows.find((row) => row.policy.classification === 'SIXTH');

    assert.equal(sixthDay.policy.sixthDayHours, 7.42);
    assert.equal(projection.totals.employees['0004'].sixthDayHours, 7.42);
    assert.equal(projection.totals.branches['0001'].sixthDayHours, 7.42);
    assert.equal(projection.totals.grand.sixthDayHours, 7.42);
});

test('export policy status is presentation-safe Greek while internal status stays unchanged', () => {
    const normalProjection = buildReviewExportProjection({
        rows: week('2026-06-15', [0, 0, 0, 0, 0, 0, 0])
    });
    assert.equal(normalProjection.rows[0].policy.status, 'NOT_APPLICABLE');
    assert.equal(normalProjection.rows[0].policy.statusLabel, '');

    const readyProjection = buildReviewExportProjection({ rows: week() });
    assert.equal(readyProjection.rows[0].policy.status, 'READY');
    assert.equal(readyProjection.rows[0].policy.statusLabel, 'Έτοιμο');
    assert.ok(readyProjection.rows.every((row) => row.policy.statusLabel !== 'NOT_APPLICABLE'));
});

test('mixed-profile deviation blocks automatic sixth/seventh-day export classification', () => {
    const rows = week();
    const projection = buildReviewExportProjection({
        rows,
        deviations: [{
            kodikos: '0004',
            week_apo: '2026-06-15',
            week_eos: '2026-06-21',
            profile_changed_inside_week: true
        }]
    });

    assert.ok(projection.rows.every((row) => row.policy.status === 'NEEDS_HR_DECISION'));
    assert.ok(projection.rows.every((row) => row.policy.source === 'PENDING_HR'));
    assert.ok(projection.rows.every((row) => row.policy.classification === 'NORMAL'));
    assert.ok(projection.rows.every((row) =>
        row.policy.note.includes('PROFILE_CHANGED_INSIDE_WEEK')
    ));
});

test('illegal categories are exclusive, total is categorized only, mismatch threshold is > 0.02', () => {
    const mapped = illegalBreakdown({
        ores_paranomhs_yperorias_apologistika: 1,
        ores_paranomhs_yperorias_nyxtas_apologistika: 2,
        ores_paranomhs_yperorias_argion_apologistika: 3,
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: 4,
        canonical_illegal_overtime_total: 10.02
    });
    assert.deepEqual([mapped.normal, mapped.night, mapped.holiday, mapped.holidayNight, mapped.total], [1, 2, 3, 4, 10]);
    assert.equal(mapped.mismatch, false);
    assert.equal(illegalBreakdown({ ...mapped, canonical_illegal_overtime_total: 10.03 }).mismatch, true);
});

test('HR exact-week applied decision wins; pending/stale/cancelled decisions do not', () => {
    const rows = week();
    const base = { employee_kodikos: '0004', week_start: '2026-06-15', week_end: '2026-06-21',
        decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', applied: true,
        classification_by_date: { '2026-06-19': 'SEVENTH' }, created_at: '2026-06-22' };
    let projection = buildReviewExportProjection({ rows, decisions: [base] });
    assert.equal(projection.rows[4].policy.source, 'HR');
    assert.equal(projection.rows[4].policy.classification, 'SEVENTH');
    for (const invalid of [{ stale: true }, { decision_status: 'CANCELLED' }, { applied: false, apply_status: 'PENDING' }]) {
        projection = buildReviewExportProjection({ rows, decisions: [{ ...base, ...invalid }] });
        assert.notEqual(projection.rows[4].policy.source, 'HR');
    }
    assert.equal(decisionIsActiveApplied({ ...base, is_current: false }), false);
});

test('policy approval precedence, pending HR, rates, legacy and employee/branch/grand totals', () => {
    const rows = week();
    rows.forEach((row) => { row.policyVersion = undefined; });
    const approval = { decision_status: 'RECORDED', decision_type: 'MARK_REVIEWED', created_at: '2026-06-22',
        apo_hmeromhnia: '2026-06-15', eos_hmeromhnia: '2026-06-21',
        items: [{ employee_kodikos: '0004', hmeromhnia: '2026-06-19', proposed_values: { classification: 'SIXTH' } }] };
    let projection = buildReviewExportProjection({ rows, approvals: [approval] });
    assert.equal(projection.rows[4].policy.source, 'HR');
    assert.equal(projection.rows[4].policy.legacy, true);
    assert.deepEqual(projection.totals.employees['0004'], projection.totals.branches['0001']);
    assert.deepEqual(projection.totals.branches['0001'], projection.totals.grand);
    assert.equal(projection.totals.grand.sixthDayCount, 1);
    assert.equal(projection.totals.grand.seventhDayCount, 1);
    for (const rate of [null, '', -1, 'missing']) {
        const rateRows = week();
        rateRows.forEach((row) => { row.effective_sixth_day_rate = rate; });
        projection = buildReviewExportProjection({ rows: rateRows });
        assert.equal(projection.rows[4].policy.source, 'PENDING_HR');
        assert.equal(projection.rows[4].policy.severity, 'ΑΠΑΙΤΕΙ ΑΠΟΦΑΣΗ HR');
    }
    for (const rate of [0, 12.5, 40]) {
        const rateRows = week();
        rateRows.forEach((row) => { row.effective_sixth_day_rate = rate; });
        if (rate === 0) rateRows.forEach((row) => { row.eidikh_kathgoria_ergazomenoy = '0009'; });
        projection = buildReviewExportProjection({ rows: rateRows });
        assert.equal(projection.rows[4].policy.sixthDayRate, rate);
    }
});

test('filter parity: projection never introduces rows outside its pure input', () => {
    const policyRows = week();
    const rows = policyRows.filter((row) => String(row.hmeromhnia).startsWith('2026-06-19'));
    const projection = buildReviewExportProjection({ rows, policyRows });
    assert.equal(projection.rows.length, 1);
    assert.equal(String(projection.rows[0].hmeromhnia).slice(0, 10), '2026-06-19');
    assert.equal(projection.rows[0].policy.classification, 'SIXTH');
});

test('findings-only excludes normal, zero and plain NOT_APPLICABLE rows without changing default projection', () => {
    const rows = week('2026-06-15', [0, 0, 0, 0, 0, 0, 0]);
    assert.equal(buildReviewExportProjection({ rows }).rows.length, 7);
    assert.equal(buildReviewExportProjection({ rows, findingsOnly: true }).rows.length, 0);
});

test('findings-only retains every material numeric finding, mismatch and actual sixth/seventh day', () => {
    const rows = week();
    Object.assign(rows[0], { ores_apoysias_apologistika: 1 });
    Object.assign(rows[1], { ores_prostheths_ergasias_apologistika: 1 });
    Object.assign(rows[2], { ores_yperergasias_apologistika: 1 });
    Object.assign(rows[3], { ores_nominhs_yperorias_apologistika: 1 });
    Object.assign(rows[6], {
        ores_paranomhs_yperorias_apologistika: 1,
        canonical_illegal_overtime_total: 2
    });
    const projection = buildReviewExportProjection({ rows, findingsOnly: true });
    assert.deepEqual(projection.rows.map((row) => String(row.hmeromhnia).slice(0, 10)), [
        '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18',
        '2026-06-19', '2026-06-20', '2026-06-21'
    ]);
    assert.equal(projection.totals.grand.illegalTotal, 1);
});

test('findings-only keeps one representative HR-only row per employee and week', () => {
    const rows = week('2026-06-15', [0, 0, 0, 0, 0, 0, 0]);
    const approval = {
        decision_status: 'RECORDED', decision_type: 'MARK_REVIEWED', notes: 'Εγκρίθηκε από HR',
        apo_hmeromhnia: '2026-06-15', eos_hmeromhnia: '2026-06-21',
        items: rows.map((row) => ({ employee_kodikos: '0004', hmeromhnia: row.hmeromhnia }))
    };
    const projection = buildReviewExportProjection({ rows, approvals: [approval], findingsOnly: true });
    assert.equal(projection.rows.length, 1);
    assert.equal(projection.rows[0].policy.source, 'HR');
});

test('atomic export keeps the authoritative source and target together', () => {
    const rows = atomicRows();
    const projection = buildReviewExportProjection({
        rows: [rows[0], rows[1]],
        policyRows: rows,
        atomicGroupProjection: atomicFixture(),
        findingsOnly: true
    });
    assert.deepEqual(projection.rows.map((row) => row._id), ['row-source', 'row-target']);
    assert.deepEqual(projection.rows.map((row) => row.policy.atomicGroup.role), [
        'SOURCE_BECOMES_WORK', 'TARGET_BECOMES_REPO'
    ]);
    assert.ok(projection.rows.every((row) => row.policy.status === 'NEEDS_HR_DECISION'));
});

test('atomic export never emits a half pair when source or target context is missing', () => {
    const rows = atomicRows();
    for (const missingId of ['row-source', 'row-target']) {
        const available = rows.filter((row) => row._id !== missingId);
        const presentation = available.filter((row) =>
            ['row-source', 'row-target'].includes(row._id)
        );
        const projection = buildReviewExportProjection({
            rows: presentation,
            policyRows: available,
            atomicGroupProjection: atomicFixture(),
            findingsOnly: true
        });
        assert.equal(projection.rows.length, 0);
    }
});

test('presentation-boundary atomic export adds the context-only member only with full context', () => {
    const rows = atomicRows();
    const projection = buildReviewExportProjection({
        rows: [rows[1]],
        policyRows: rows,
        atomicGroupProjection: atomicFixture(),
        findingsOnly: true
    });
    assert.deepEqual(projection.rows.map((row) => row._id), ['row-source', 'row-target']);

    const incomplete = buildReviewExportProjection({
        rows: [rows[1]],
        policyRows: rows.filter((row) => row._id !== 'row-source'),
        atomicGroupProjection: atomicFixture(),
        findingsOnly: true
    });
    assert.equal(incomplete.rows.length, 0);
});

test('resolved atomic export includes reusable metadata without replacing current values', () => {
    const rows = atomicRows();
    const originalValues = rows.slice(0, 2).map((row) => ({
        id: row._id,
        category: row.kathgoria_ergasias_apologistika,
        hours: row.ores_ergasias_apologistika
    }));
    const projection = buildReviewExportProjection({
        rows: rows.slice(0, 2),
        policyRows: rows,
        atomicGroupProjection: atomicFixture({
            status: 'RESOLVED_BY_POLICY',
            reusableDecision: {
                approval_id: 'approval-v5',
                approved_by_user_name: 'HR User',
                approved_at: '2026-06-20T10:00:00.000Z',
                effective_from: '2026-06-01',
                effective_to: null,
                fingerprint_version: 5,
                reuse_fingerprint: 'must-not-be-exported'
            }
        }),
        findingsOnly: true
    });
    assert.equal(projection.rows.length, 2);
    assert.ok(projection.rows.every((row) =>
        row.policy.statusLabel === 'Εγκρίθηκε βάσει παλιότερης απόφασης HR'
    ));
    assert.match(projection.rows[0].policy.note, /HR User/);
    assert.match(projection.rows[0].policy.note,
        /Έκδοση επαναχρησιμοποιήσιμου αποτυπώματος: 5/);
    assert.doesNotMatch(projection.rows[0].policy.note, /must-not-be-exported/);
    assert.deepEqual(projection.rows.map((row) => ({
        id: row._id,
        category: row.kathgoria_ergasias_apologistika,
        hours: row.ores_ergasias_apologistika
    })), originalValues);
});

test('atomic overlap and reusable conflict export as a complete pending pair', () => {
    const rows = atomicRows();
    for (const diagnostic of [
        'ATOMIC_LINKED_SET_ROW_OVERLAP',
        'ATOMIC_REUSABLE_MULTIPLE_ACTIVE_MATCHES',
        'ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED'
    ]) {
        const projection = buildReviewExportProjection({
            rows: rows.slice(0, 2),
            policyRows: rows,
            atomicGroupProjection: atomicFixture({ diagnostics: [diagnostic] }),
            findingsOnly: true
        });
        assert.equal(projection.rows.length, 2);
        assert.ok(projection.rows.every((row) => row.policy.source === 'PENDING_HR'));
        assert.ok(projection.rows.every((row) => row.policy.severity === 'ΑΠΑΙΤΕΙ ΑΠΟΦΑΣΗ HR'));
        assert.ok(projection.rows.every((row) => row.policy.note.trim().length > 0));
    }
});
