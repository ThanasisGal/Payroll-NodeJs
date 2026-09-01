'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('async function runHistoricalReconstruction()');
const end = source.indexOf('function currentCorrectiveBranch()', start);
const functionSource = source.slice(start, end);
const defaults = {
    reconstruction: 'Ανακατασκευή περιόδου μετά την ολοκλήρωση λήψης προδηλωμένων ωραρίων και ψηφιακών καρτών για πλήρη επανέλεγχο αυτής.',
    reassessment: 'Επανεκτίμηση ανακατασκευασμένης περιόδου μετά από διόρθωση των δεδομένων και πλήρη επανέλεγχο της περιόδου.'
};

async function run({ reassess = false, editedReason = null } = {}) {
    const modalOptions = [];
    const requestBodies = [];
    let refreshes = 0;
    let controlRefreshes = 0;
    const responses = [
        { ok: true, json: async () => ({ success: true,
            historical_reconstruction_version: reassess ? 2 : 1 }) },
        { ok: true, json: async () => ({ success: true }) }
    ];
    const sandbox = {
        historicalReconstructionDefaultReasons: defaults,
        currentEmploymentPeriodControl: { allowed_actions: {
            historical_reassess: reassess
        } },
        getActiveEmploymentReviewScope: () => ({ ypokatasthma: '0000',
            apo_hmeromhnia: '2026-02-01', eos_hmeromhnia: '2026-02-28' }),
        employmentReviewSwal: async (options) => {
            modalOptions.push(options);
            if (options.input === 'textarea') return { isConfirmed: true,
                value: editedReason ?? options.inputValue };
            return { isConfirmed: true };
        },
        fetch: async (_url, options) => {
            requestBodies.push(JSON.parse(options.body));
            return responses.shift();
        },
        loadEmploymentPeriodControl: async () => { controlRefreshes += 1; },
        loadResults: async () => { refreshes += 1; },
        csrfToken: 'test-token', Date, Math, JSON, String, Error
    };
    vm.createContext(sandbox);
    vm.runInContext(`${functionSource}\nthis.runHistoricalReconstruction = runHistoricalReconstruction;`,
        sandbox);
    await sandbox.runHistoricalReconstruction();
    return { modalOptions, requestBodies, refreshes, controlRefreshes };
}

(async () => {
    for (const [reassess, expectedTitle, expectedReason] of [
        [false, 'Ανακατασκευή Εκπρόθεσμης Περιόδου', defaults.reconstruction],
        [true, 'Επανεκτίμηση Ανακατασκευασμένης Περιόδου', defaults.reassessment]
    ]) {
        const result = await run({ reassess });
        const modal = result.modalOptions[0];
        assert.equal(modal.title, expectedTitle);
        assert.equal(modal.input, 'textarea');
        assert.equal(modal.inputValue, expectedReason);
        assert.equal(modal.inputAttributes?.readonly, undefined);
        assert.equal(result.requestBodies[0].reason, expectedReason);
        assert.equal(result.refreshes, 1);
        assert.equal(result.controlRefreshes, 1);
    }

    const edited = 'Νέα επεξεργασμένη αιτιολογία';
    const editedResult = await run({ reassess: true, editedReason: edited });
    assert.equal(editedResult.requestBodies[0].reason, edited);
    assert.match(functionSource,
        /await loadEmploymentPeriodControl\(branch\);\s*await loadResults\(\);/);
    assert.equal((functionSource.match(/loadResults\(\)/g) || []).length, 1);
    console.log('historical reconstruction refresh/default-reason UI regression: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
