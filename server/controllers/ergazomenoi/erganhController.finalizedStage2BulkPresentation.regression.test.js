'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const mainSearch = controller.slice(
    controller.indexOf('static getProdhlomenaOrariaForReview'),
    controller.indexOf('static getProdhlomenaOrariaOrphanQualityCheck')
);
const completion = controller.slice(
    controller.indexOf('static completeWeeklyHrWorkflowStage2Bulk'),
    controller.indexOf('static saveWeeklyHrStage1DailyClassificationsBulk')
);

assert.match(mainSearch, /let finalizedReadOnly = false/);
assert.match(mainSearch,
    /frozenState\.stored_status === 'FINALIZED'[\s\S]*?finalizedReadOnly = true/);
assert.match(mainSearch,
    /loadWeeklyHrStage2BulkSearchPresentation\(\{[\s\S]*?finalizedReadOnly,[\s\S]*?loadWritablePresentation/);
assert.match(mainSearch, /const stage2BulkPreview = stage2BulkPresentation\?\.preview \|\| null/);
assert.match(mainSearch, /finalized: finalizedReadOnly/);
assert.match(mainSearch, /snapshot_schema_version !== 'employment-period-frozen:v3'/);
assert.match(mainSearch, /projectFrozenReview/);
assert.match(completion, /assertWeeklyHrWorkflowIndexesReady\(\)/);
assert.match(completion, /loadWeeklyHrStage2BatchPreparedContexts/);
assert.match(completion, /runWithPeriodWriteFence|fencePeriodForWrite/);

console.log('finalized Stage-2 bulk presentation regression tests passed');
