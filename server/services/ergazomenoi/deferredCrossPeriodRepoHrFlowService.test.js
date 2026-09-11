'use strict';
const assert = require('assert');
const { buildDeferredCrossPeriodRepoResolution } = require('./deferredCrossPeriodRepoResolutionService');
const { buildPreview, resolveDeferredCrossPeriodRepo } = require('./deferredCrossPeriodRepoHrFlowService');

const identity = { team: 'T', company_kod: 'C', ypokatasthma: '0001', employee_id: '507f1f77bcf86cd799439011',
    week_start: '2026-04-27', week_end: '2026-05-03', source_period_start: '2026-04-01', source_period_end: '2026-04-30' };
const deferredWeek = { ...identity, deferred_week_id: JSON.stringify(Object.values(identity)) };
const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date('2026-04-27T00:00:00Z'); date.setUTCDate(date.getUTCDate() + index);
    return { row_id: `r${index}`, _id: `r${index}`, hmeromhnia: date.toISOString().slice(0, 10),
        team: 'T', company_kod: 'C', ypokatasthma: '0001', employee_id: identity.employee_id,
        kodikos: '1', employee_kodikos: '1', kathgoria_ergasias: index === 3 ? 'ΑΝ' : 'ΕΡΓ',
        ores_ergasias: index === 3 ? 0 : 8, apo_ora_01: index === 3 ? '' : '09:00',
        eos_ora_01: index === 3 ? '' : '17:00', cards_ores_ergasias: index === 3 ? 8 : 0,
        cards_apo_ora_01: index === 3 ? '09:00' : '', cards_eos_ora_01: index === 3 ? '17:00' : '',
        kathgoria_ergasias_apologistika: index === 3 ? 'ΑΝ' : 'ΕΡΓ' };
});
function input(reason = 'Επιβεβαίωση HR') { return { deferredWeek, fullWeekContext: days,
    source: { row_id: 'r3', hmeromhnia: '2026-04-30' }, target: { row_id: 'r4', hmeromhnia: '2026-05-01' },
    sourcePeriod: { period_start: '2026-04-01', period_end: '2026-04-30' },
    targetPeriod: { period_start: '2026-05-01', period_end: '2026-05-31' },
    resolutionPeriod: { period_start: '2026-05-01', period_end: '2026-05-31' },
    beforeValues: days, proposedAccountingAfterValues: [
        { row_id: 'r3', hmeromhnia: '2026-04-30', kathgoria_ergasias_apologistika: 'ΕΡΓ', apologistiko_biblio: true },
        { row_id: 'r4', hmeromhnia: '2026-05-01', kathgoria_ergasias_apologistika: 'ΑΝ', apologistiko_biblio: true }
    ], frozenSnapshotFingerprint: 'frozen', resolution_reason: reason } }
const session = { userId: '507f191e810c19729de860ea', userName: 'HR User', userRole: 'HR' };

(async () => {
    const preview = buildPreview({ authoritativeInput: input(), session, now: new Date('2026-05-04') });
    assert.equal(preview.days.length, 7); assert.equal(preview.period_projections.length, 2);
    assert.equal(preview.before_after.source.before.kathgoria_ergasias_apologistika, 'ΑΝ');
    assert.equal(preview.before_after.source.after.kathgoria_ergasias_apologistika, 'ΕΡΓ');
    assert.equal(preview.before_after.target.after.kathgoria_ergasias_apologistika, 'ΑΝ');
    assert.deepEqual(preview.days[3].declared, { category: 'ΑΝ', hours: 0, intervals: [] });
    assert.deepEqual(preview.days[3].cards, { hours: 8,
        intervals: [{ from: '09:00', to: '17:00' }] });
    const later = buildPreview({ authoritativeInput: input(), session, now: new Date('2026-05-05') });
    assert.equal(preview.resolution_fingerprint, later.resolution_fingerprint,
        'ο χρόνος καταγραφής δεν αποτελεί authoritative business input του stale fingerprint');
    assert.equal(buildPreview({ authoritativeInput: input('Άλλη σημείωση'), session,
        now: new Date('2026-05-04') }).resolution_fingerprint, preview.resolution_fingerprint);

    let creates = 0; const records = [];
    const store = { findByRequest: async (id) => records.find((r) => r.request_id === id),
        findByDeferredWeek: async (id) => records.filter((r) => r.deferred_week_id === id),
        create: async (record) => { creates += 1; const saved = { ...record, _id: `d${creates}` };
            records.push(saved); return saved; } };
    const body = { deferred_week_id: deferredWeek.deferred_week_id,
        proposal_identity: preview.proposal_identity, resolution_fingerprint: preview.resolution_fingerprint,
        source_row_id: 'r3', target_row_id: 'r4', request_id: 'req-1', resolution_reason: 'Επιβεβαίωση HR' };
    let reconstructions = 0;
    const reconstruct = async () => { reconstructions += 1; return input(); };
    const first = await resolveDeferredCrossPeriodRepo({ body, session, reconstruct, decisionStore: store,
        now: new Date('2026-05-05') });
    assert.equal(first.idempotent, false); assert.equal(creates, 1); assert.equal(reconstructions, 1);
    assert.equal(first.decision.resolved_by_user_name, 'HR User');
    const replay = await resolveDeferredCrossPeriodRepo({ body, session, reconstruct, decisionStore: store });
    assert.equal(replay.idempotent, true); assert.equal(creates, 1); assert.equal(reconstructions, 2);
    const correctionPreview = buildPreview({ authoritativeInput: { ...input(), target: { row_id: 'r5', hmeromhnia: '2026-05-02' },
        proposedAccountingAfterValues: [input().proposedAccountingAfterValues[0],
            { row_id: 'r5', hmeromhnia: '2026-05-02', kathgoria_ergasias_apologistika: 'ΑΝ', apologistiko_biblio: true }] },
        session, now: new Date('2026-05-06') });
    const correctionBody = { ...body, request_id: 'req-2', proposal_identity: correctionPreview.proposal_identity,
        resolution_fingerprint: correctionPreview.resolution_fingerprint, target_row_id: 'r5',
        correction_reason: '', expected_previous_decision_id: first.decision._id,
        expected_previous_resolution_fingerprint: first.decision.resolution_fingerprint };
    const correctionInput = () => ({ ...input(), target: { row_id: 'r5', hmeromhnia: '2026-05-02' },
        proposedAccountingAfterValues: [input().proposedAccountingAfterValues[0],
            { row_id: 'r5', hmeromhnia: '2026-05-02', kathgoria_ergasias_apologistika: 'ΑΝ', apologistiko_biblio: true }] });
    const second = await resolveDeferredCrossPeriodRepo({ body: correctionBody, session,
        reconstruct: async () => correctionInput(), decisionStore: store, now: new Date('2026-05-06') });
    assert.equal(second.decision.resolution_revision, 2);
    assert.equal(String(second.decision.supersedes_decision_id), String(first.decision._id));
    assert.equal(records[0].resolution_revision, 1);
    let correctionRaceRead = 0;
    const correctionRaceStore = { findByRequest: async () => null,
        findByDeferredWeek: async () => (++correctionRaceRead === 1 ? [first.decision] : [first.decision, second.decision]),
        create: async () => { throw Object.assign(new Error('duplicate revision'), { code: 11000 }); } };
    const concurrentCorrection = await resolveDeferredCrossPeriodRepo({ body: { ...correctionBody,
        request_id: 'req-concurrent-same' }, session, reconstruct: async () => correctionInput(),
        decisionStore: correctionRaceStore, now: new Date('2026-05-06') });
    assert.equal(concurrentCorrection.idempotent, true);
    const thirdInput = () => ({ ...input(), target: { row_id: 'r6', hmeromhnia: '2026-05-03' },
        proposedAccountingAfterValues: [input().proposedAccountingAfterValues[0],
            { row_id: 'r6', hmeromhnia: '2026-05-03', kathgoria_ergasias_apologistika: 'ΑΝ', apologistiko_biblio: true }] });
    const thirdPreview = buildPreview({ authoritativeInput: thirdInput(), session, now: new Date('2026-05-06') });
    correctionRaceRead = 0;
    await assert.rejects(() => resolveDeferredCrossPeriodRepo({ body: { ...correctionBody,
        request_id: 'req-concurrent-different', proposal_identity: thirdPreview.proposal_identity,
        resolution_fingerprint: thirdPreview.resolution_fingerprint, target_row_id: 'r6' }, session,
        reconstruct: async () => thirdInput(), decisionStore: correctionRaceStore }),
    (error) => error.code === 'DEFERRED_CROSS_PERIOD_RESOLUTION_STALE');
    const staleStore = { findByRequest: async () => null, findByDeferredWeek: async () => [],
        create: async () => { throw new Error('write must not occur'); } };
    await assert.rejects(() => resolveDeferredCrossPeriodRepo({ body: { ...body,
        resolution_fingerprint: 'stale' }, session, reconstruct, decisionStore: staleStore }),
    (error) => error.code === 'DEFERRED_CROSS_PERIOD_RESOLUTION_STALE');
    let absentIndexWrites = 0;
    await assert.rejects(() => resolveDeferredCrossPeriodRepo({ body, session, reconstruct,
        indexGuard: async () => { throw Object.assign(new Error('index absent'), {
            code: 'DEFERRED_CROSS_PERIOD_RESOLUTION_INDEX_NOT_READY', statusCode: 503 }); },
        decisionStore: { findByRequest: async () => null, findByDeferredWeek: async () => [],
            create: async () => { absentIndexWrites += 1; } } }),
    (error) => error.code === 'DEFERRED_CROSS_PERIOD_RESOLUTION_INDEX_NOT_READY' && error.statusCode === 503);
    assert.equal(absentIndexWrites, 0);
    const concurrentWinner = { ...first.decision };
    let duplicateHappened = false;
    const concurrentStore = { findByRequest: async () => null,
        findByDeferredWeek: async () => duplicateHappened ? [concurrentWinner] : [],
        create: async () => { duplicateHappened = true;
            throw Object.assign(new Error('duplicate'), { code: 11000 }); } };
    const concurrent = await resolveDeferredCrossPeriodRepo({ body, session, reconstruct,
        decisionStore: concurrentStore });
    assert.equal(concurrent.idempotent, true);
    assert.equal(Object.prototype.hasOwnProperty.call(first.decision.canonical_snapshot, 'client_employee'), false);
    assert.throws(() => buildDeferredCrossPeriodRepoResolution({}), /deferred_week_id/);
    console.log('deferred cross-period HR flow tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
