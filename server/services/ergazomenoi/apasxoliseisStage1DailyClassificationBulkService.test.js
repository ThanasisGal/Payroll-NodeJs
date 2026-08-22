'use strict';

const assert = require('assert/strict');
const { BULK_DAILY_CLASSIFICATION_CONCURRENCY, ERGANI_II_SICKNESS_LEAVE_CATEGORY,
    classificationUpdates,
    applyCanonicalAbsenceMetrics,
    applyCardDerivedAbsenceMetrics,
    resolveEffectiveAbsenceMetrics,
    buildEffectiveAbsenceDaysAggregationExpression,
    buildEffectiveAbsenceHoursAggregationExpression,
    saveStage1DailyClassificationsBulk } = require('./apasxoliseisStage1DailyClassificationBulkService');

(async () => {
    assert.deepEqual(classificationUpdates({ classification: 'SICKNESS' }), {
        repo_apologistika: false, adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'ΑΔΑΣ', astheneia_apologistika: true,
        apousia_apologistika: false });
    assert.equal(ERGANI_II_SICKNESS_LEAVE_CATEGORY, 'ΑΔΑΣ');
    assert.deepEqual(classificationUpdates({ classification: 'ABSENCE' }), {
        repo_apologistika: false, adeia_apologistika: false,
        kathgoria_adeias_apologistika: '', astheneia_apologistika: false,
        apousia_apologistika: true });
    assert.deepEqual(applyCanonicalAbsenceMetrics({ ores_ergasias: 7.5,
        ores_apoysias_apologistika: 1.25, apousia_apologistika: false },
    classificationUpdates({ classification: 'ABSENCE' })), {
        repo_apologistika: false, adeia_apologistika: false,
        kathgoria_adeias_apologistika: '', astheneia_apologistika: false,
        apousia_apologistika: true, ores_apoysias_base_apologistika: 1.25,
        ores_apoysias_apologistika: 7.5, hmeres_apoysias_apologistika: 1 });
    const restored = applyCanonicalAbsenceMetrics({ apousia_apologistika: true,
        ores_apoysias_base_apologistika: 1.25, ores_apoysias_apologistika: 7.5 },
    classificationUpdates({ classification: 'SICKNESS' }));
    assert.equal(restored.hmeres_apoysias_apologistika, 0);
    assert.equal(restored.ores_apoysias_apologistika, 1.25);
    assert.deepEqual(applyCardDerivedAbsenceMetrics({ apousia_apologistika: false },
    { ores_apoysias_apologistika: 2 }), {
        ores_apoysias_base_apologistika: 2,
        ores_apoysias_apologistika: 2,
        hmeres_apoysias_apologistika: 0
    });
    assert.deepEqual(applyCardDerivedAbsenceMetrics({ apousia_apologistika: true,
        ores_ergasias: 8 }, { ores_apoysias_apologistika: 2 }), {
        ores_apoysias_base_apologistika: 2,
        ores_apoysias_apologistika: 8,
        hmeres_apoysias_apologistika: 1
    });
    assert.deepEqual(resolveEffectiveAbsenceMetrics({ apousia_apologistika: true,
        ores_ergasias: 8 }), { days: 1, hours: 8 });
    assert.deepEqual(resolveEffectiveAbsenceMetrics({ apousia_apologistika: false,
        ores_apoysias_apologistika: 2 }), { days: 0, hours: 2 });
    assert.deepEqual(resolveEffectiveAbsenceMetrics({ hmeres_apoysias_apologistika: 0,
        ores_apoysias_apologistika: 2 }), { days: 0, hours: 2 });
    assert.deepEqual(buildEffectiveAbsenceDaysAggregationExpression(), { $cond: [
        { $eq: [{ $type: '$hmeres_apoysias_apologistika' }, 'missing'] },
        { $cond: [{ $eq: ['$apousia_apologistika', true] }, 1, 0] },
        { $ifNull: ['$hmeres_apoysias_apologistika', 0] }
    ] });
    assert.deepEqual(buildEffectiveAbsenceHoursAggregationExpression().$cond[1],
        { $ifNull: ['$ores_ergasias', 0] });
    await assert.rejects(() => saveStage1DailyClassificationsBulk({ reason: 'x',
        changes: [{ row_id: '1', classification: 'LEAVE' }], applyOne: async () => ({}) }),
    (error) => error.code === 'LEAVE_CATEGORY_REQUIRED');

    let sicknessCommand;
    await saveStage1DailyClassificationsBulk({ reason: 'x',
        changes: [{ row_id: 'sickness', classification: 'SICKNESS',
            kathgoria_adeias_apologistika: 'UNTRUSTED' }],
        applyOne: async (command) => { sicknessCommand = command; } });
    assert.deepEqual(sicknessCommand.updates, { repo_apologistika: false,
        adeia_apologistika: false, kathgoria_adeias_apologistika: 'ΑΔΑΣ',
        astheneia_apologistika: true, apousia_apologistika: false });
    const authoritative = { _id: 'authoritative', astheneia_apologistika: true };
    const authoritativeResult = await saveStage1DailyClassificationsBulk({ reason: 'x',
        changes: [{ row_id: 'authoritative', classification: 'SICKNESS' }],
        applyOne: async () => ({ record: authoritative }) });
    assert.strictEqual(authoritativeResult.results[0].record, authoritative);

    const calls = [];
    const result = await saveStage1DailyClassificationsBulk({ reason: 'Κοινή αιτιολογία', changes: [
        { row_id: '11', classification: 'ABSENCE' },
        { row_id: '16', classification: 'SICKNESS' },
        { row_id: '18', classification: 'SICKNESS' }
    ], applyOne: async (command) => { calls.push(command); if (command.row_id === '16') {
        const error = new Error('conflict'); error.code = 'PERIOD_CONTROL_STATE_CONFLICT';
        error.statusCode = 409; throw error; } return command.row_id === '18' ? { unchanged: true } : {}; } });
    assert.equal(calls.length, 3);
    assert.deepEqual(result, { requested_count: 3, saved_count: 1, unchanged_count: 1,
        failed_count: 1, results: [
            { row_id: '11', status: 'SAVED' },
            { row_id: '16', status: 'REVIEW_REQUIRED', code: 'PERIOD_CONTROL_STATE_CONFLICT', message: 'conflict' },
            { row_id: '18', status: 'UNCHANGED' }
        ] });

    let active = 0; let maximum = 0;
    await saveStage1DailyClassificationsBulk({ reason: 'x',
        changes: Array.from({ length: 30 }, (_, index) => ({ row_id: String(index), classification: 'UNCLASSIFIED' })),
        applyOne: async () => { active++; maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 2)); active--; } });
    assert.ok(maximum <= BULK_DAILY_CLASSIFICATION_CONCURRENCY);
    console.log('Stage 1 daily classification bulk service tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
