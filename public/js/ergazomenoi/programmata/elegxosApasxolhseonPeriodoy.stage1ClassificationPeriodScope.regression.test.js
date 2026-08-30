'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');

function extractFunction(name) {
    const functionStart = source.indexOf(`function ${name}(`);
    assert.notStrictEqual(functionStart, -1, `Missing frontend function: ${name}`);
    const start = source.slice(functionStart - 6, functionStart) === 'async '
        ? functionStart - 6 : functionStart;
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = bodyStart; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === quote) quote = '';
            continue;
        }
        if (character === '\'' || character === '"' || character === '`') quote = character;
        else if (character === '{') depth += 1;
        else if (character === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    assert.fail(`Incomplete frontend function: ${name}`);
}

const extracted = [
    extractFunction('stage1DateKey'),
    extractFunction('isFullCalendarMonthRange'),
    extractFunction('saveStage1DailyClassificationDrafts')
].join('\n');

async function capturePayload({ start, end, requestedRowIds = null, draftIds = ['row-1'],
    periodSummary = { period_start: '2026-01-01', period_end: '2026-01-31', branch: '0000' } }) {
    let capturedPayload = null;
    let classificationFetchCount = 0;
    let controlledError = '';
    const sandbox = {
        Map,
        Set,
        console,
        csrfToken: 'test-csrf-token',
        weeklyHrStage1DaySaving: false,
        weeklyHrStage1DayDrafts: new Map(draftIds.map((rowId) => [rowId,
            { classification: 'ABSENCE', kathgoria_adeias_apologistika: '' }])),
        weeklyHrStage1DaySelected: new Set(),
        weeklyHrStage1Payloads: new Map(),
        weeklyHrStage1Scopes: new Map(),
        currentEmploymentPeriodControl: periodSummary
            ? { final_submission_summary: periodSummary } : null,
        updateWeeklyHrStage1BulkToolbar() {},
        rerenderWeeklyHrStage1Rows() {},
        updateAuthoritativeReviewDailyRow() {},
        refreshWeeklyHrStage1Scope: async () => {},
        document: { getElementById(id) {
            if (id === 'apo_hmeromhnia') return { value: start };
            if (id === 'eos_hmeromhnia') return { value: end };
            return null;
        } },
        employmentReviewSwal: async (options) => {
            if (options?.icon === 'error') {
                controlledError = String(options.text || '');
                return { isConfirmed: true };
            }
            return options?.input === 'textarea'
                ? { isConfirmed: true, value: 'Regression reason' } : { isConfirmed: true };
        },
        fetch: async (_url, options) => {
            classificationFetchCount += 1;
            capturedPayload = JSON.parse(options.body);
            return { ok: true, json: async () => ({ success: true,
                requested_count: capturedPayload.changes.length,
                saved_count: capturedPayload.changes.length,
                unchanged_count: 0, failed_count: 0, results: [] }) };
        }
    };
    const run = vm.runInNewContext(`(async () => {
        ${extracted}
        await saveStage1DailyClassificationDrafts(${JSON.stringify(requestedRowIds)});
    })`, sandbox);
    await run();
    return { payload: capturedPayload, classificationFetchCount, controlledError };
}

(async () => {
    const { payload: fullJanuary } = await capturePayload({ start: '2026-01-01', end: '2026-01-31' });
    assert.deepStrictEqual({
        period_start: fullJanuary.period_start,
        period_end: fullJanuary.period_end,
        ypokatasthma: fullJanuary.ypokatasthma
    }, { period_start: '2026-01-01', period_end: '2026-01-31', ypokatasthma: '0000' });

    const { payload: partialJanuary } = await capturePayload({
        start: '2026-01-02', end: '2026-01-31' });
    assert.deepStrictEqual({ period_start: partialJanuary.period_start,
        period_end: partialJanuary.period_end, ypokatasthma: partialJanuary.ypokatasthma },
    { period_start: '2026-01-01', period_end: '2026-01-31', ypokatasthma: '0000' });

    const { payload: wrongEnd } = await capturePayload({ start: '2026-01-01', end: '2026-01-30' });
    assert.deepStrictEqual({ period_start: wrongEnd.period_start, period_end: wrongEnd.period_end,
        ypokatasthma: wrongEnd.ypokatasthma },
    { period_start: '2026-01-01', period_end: '2026-01-31', ypokatasthma: '0000' });

    const { payload: perDay } = await capturePayload({ start: '2026-01-02', end: '2026-01-31',
        requestedRowIds: ['row-2'], draftIds: ['row-1', 'row-2'] });
    assert.deepStrictEqual(perDay.changes.map(({ row_id }) => row_id), ['row-2']);
    assert.deepStrictEqual({ period_start: perDay.period_start, period_end: perDay.period_end,
        ypokatasthma: perDay.ypokatasthma },
    { period_start: '2026-01-01', period_end: '2026-01-31', ypokatasthma: '0000' });

    const { payload: bulk } = await capturePayload({ start: '2026-01-02', end: '2026-01-31',
        draftIds: ['row-1', 'row-2'] });
    assert.deepStrictEqual(bulk.changes.map(({ row_id }) => row_id), ['row-1', 'row-2']);
    assert.deepStrictEqual({ period_start: bulk.period_start, period_end: bulk.period_end,
        ypokatasthma: bulk.ypokatasthma },
    { period_start: '2026-01-01', period_end: '2026-01-31', ypokatasthma: '0000' });

    for (const periodSummary of [null,
        { period_end: '2026-01-31', branch: '0000' },
        { period_start: '2026-01-01', branch: '0000' },
        { period_start: '2026-01-01', period_end: '2026-01-31' }]) {
        const missingSummary = await capturePayload({ start: '2026-01-01', end: '2026-01-31',
            periodSummary });
        assert.strictEqual(missingSummary.classificationFetchCount, 0);
        assert.strictEqual(missingSummary.payload, null);
        assert.ok(missingSummary.controlledError);
    }

    console.log('Stage 1 classification period frontend regression: PASS');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
