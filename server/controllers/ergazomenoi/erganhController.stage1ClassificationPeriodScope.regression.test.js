'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

function extractControllerMethod(name) {
    const marker = `static ${name} = async (req, res) =>`;
    const start = source.indexOf(marker);
    assert.notStrictEqual(start, -1, `Missing controller method: ${name}`);
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
        else if (character === '}' && --depth === 0) {
            return `const handler = async (req, res) => ${source.slice(bodyStart, index + 1)};`;
        }
    }
    assert.fail(`Incomplete controller method: ${name}`);
}

const methodSource = extractControllerMethod('saveWeeklyHrStage1DailyClassificationsBulk');

function dateKeyUtc(value) {
    const key = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function weeklyHrApiError(code, statusCode, message) {
    return Object.assign(new Error(message), { code, statusCode });
}

async function invoke({ body, activeScope = { period_start: '2026-01-01',
    period_end: '2026-01-31', ypokatasthma: '0000' }, row = null,
applyOne = false }) {
    const queries = [];
    const activeScopeBranches = [];
    const model = { findOne(filter) {
        queries.push(filter);
        const matchesBranch = !filter.ypokatasthma || filter.ypokatasthma === row?.ypokatasthma;
        const value = matchesBranch ? row : null;
        return { select() { return this; }, lean: async () => value };
    } };
    const sandbox = {
        dateKeyUtc,
        weeklyHrApiError,
        REVIEW_SELECT_FIELDS: 'review-fields',
        ProdhlomenaOrariaModel: model,
        activeEmploymentReviewPeriodScope: async (_req, branch) => {
            activeScopeBranches.push(branch);
            return activeScope;
        },
        saveStage1DailyClassificationsBulk: async (options) => {
            if (!applyOne) return { requested_count: 0, saved_count: 0,
                unchanged_count: 0, failed_count: 0, results: [] };
            const record = await options.applyOne({ row_id: 'row-1', classification: 'ABSENCE',
                updates: { apousia_apologistika: true }, reason: 'Regression reason' });
            return { requested_count: 1, saved_count: 1, unchanged_count: 0,
                failed_count: 0, results: [{ row_id: 'row-1', status: 'SAVED', record }] };
        },
        erganhController: { updateProdhlomenaOrariaReviewRecord: async (_req, res) =>
            res.status(200).json({ success: true, message: 'Saved' }) },
        buildNoCardsDisplayContext: async () => ({ argiesByDateKey: new Map(), companyFlags: {} }),
        resolveAuthoritativeHolidayClassification: () => ({ eligible: false }),
        stage1HolidayEligibilityContext: () => ({}),
        buildStage1ClassificationUpdates: (_input, target) => target
    };
    const handler = vm.runInNewContext(`(() => { ${methodSource} return handler; })()`, sandbox);
    const response = { statusCode: 200, payload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return payload; } };
    await handler({ body, session: { userTeam: 'team-1', companyInUse: 'company-1' } }, response);
    return { response, queries, activeScopeBranches };
}

const cases = [
    ['missing-both period is rejected', async () => {
        const { response } = await invoke({ body: { changes: [], reason: 'Reason', ypokatasthma: '0000' } });
        assert.strictEqual(response.statusCode, 400);
        assert.strictEqual(response.payload?.code, 'INVALID_STAGE1_CLASSIFICATION_PERIOD');
    }],
    ['one-sided period is rejected', async () => {
        const { response } = await invoke({ body: { period_start: '2026-01-01',
            changes: [], reason: 'Reason', ypokatasthma: '0000' } });
        assert.strictEqual(response.statusCode, 400);
        assert.strictEqual(response.payload?.code, 'INVALID_STAGE1_CLASSIFICATION_PERIOD');
    }],
    ['start after end is rejected', async () => {
        const { response } = await invoke({ body: { period_start: '2026-01-31',
            period_end: '2026-01-01', changes: [], reason: 'Reason', ypokatasthma: '0000' } });
        assert.strictEqual(response.statusCode, 400);
        assert.strictEqual(response.payload?.code, 'INVALID_STAGE1_CLASSIFICATION_PERIOD');
    }],
    ['active January rejects submitted February', async () => {
        const { response } = await invoke({ body: { period_start: '2026-02-01',
            period_end: '2026-02-28', changes: [], reason: 'Reason', ypokatasthma: '0000' } });
        assert.strictEqual(response.statusCode, 409);
        assert.strictEqual(response.payload?.code, 'STAGE1_CLASSIFICATION_PERIOD_SCOPE_MISMATCH');
    }],
    ['exact January passes the period fence', async () => {
        const { response, activeScopeBranches } = await invoke({ body: {
            period_start: '2026-01-01', period_end: '2026-01-31', changes: [],
            reason: 'Reason', ypokatasthma: '0000' } });
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(activeScopeBranches, ['0000']);
    }],
    ['target lookup is bound to the authorized branch', async () => {
        const { response, queries } = await invoke({ body: { period_start: '2026-01-01',
            period_end: '2026-01-31', changes: [{}], reason: 'Reason', ypokatasthma: '0001' },
        activeScope: { period_start: '2026-01-01', period_end: '2026-01-31',
            ypokatasthma: '0001' },
        row: { _id: 'row-1', hmeromhnia: '2026-01-15', ypokatasthma: '0002' }, applyOne: true });
        assert.strictEqual(queries[0]?.ypokatasthma, '0001');
        assert.strictEqual(response.statusCode, 409);
        assert.strictEqual(response.payload?.code, 'STAGE1_DATE_OUTSIDE_ACTIONABLE_PERIOD');
    }],
    ['target date outside active period is rejected', async () => {
        const { response } = await invoke({ body: { period_start: '2026-01-01',
            period_end: '2026-01-31', changes: [{}], reason: 'Reason', ypokatasthma: '0000' },
        row: { _id: 'row-1', hmeromhnia: '2026-02-01', ypokatasthma: '0000' }, applyOne: true });
        assert.strictEqual(response.statusCode, 409);
        assert.strictEqual(response.payload?.code, 'STAGE1_DATE_OUTSIDE_ACTIONABLE_PERIOD');
    }]
];

(async () => {
    const failures = [];
    for (const [name, test] of cases) {
        try {
            await test();
            console.log(`CASE ${name}: PASS`);
        } catch (error) {
            failures.push({ name, error });
            console.error(`CASE ${name}: FAIL - ${error.message}`);
        }
    }
    assert.strictEqual(failures.length, 0,
        `Server classification-period failures: ${failures.map(({ name }) => name).join(', ')}`);
    console.log('Stage 1 classification period server regression: PASS');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
