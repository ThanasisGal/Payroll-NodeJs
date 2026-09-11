'use strict';
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
const finalMethod = controller.slice(controller.indexOf('static submitFinalWTODayilyA'),
    controller.indexOf('static linkEmploymentReviewPeriodSubmission'));
assert.match(routes, /deferred-cross-period\/preview'[^;]+requireCriticalEmploymentDecisionRole[^;]+previewDeferredCrossPeriodRepoResolution/s);
assert.match(routes, /deferred-cross-period\/resolve'[^;]+requireCriticalEmploymentDecisionRole[^;]+resolveDeferredCrossPeriodRepoResolution/s);
assert.match(controller, /previewDeferredCrossPeriodRepoResolution[\s\S]*reconstructAuthoritativeDeferredCrossPeriod[\s\S]*buildPreview/);
assert.match(controller, /resolveDeferredCrossPeriodRepoResolution[\s\S]*assertDeferredCrossPeriodResolutionIndexReady/);
assert.ok(finalMethod.indexOf('prepareFinalWtoDailyInput') < finalMethod.indexOf('uploadJsonDocumentToErgani'));
assert.match(controller, /error\.code === 'WTODAILY_DEFERRED_BOUNDARY_RESOLUTION_REQUIRED'[\s\S]*deferredBoundaryReadiness = \{ status: error\.code/);
assert.match(controller, /submit_final_wtodailya: canSubmitFinalWtoDaily\(\{[\s\S]*deferredBoundaryReadiness/);
assert.doesNotMatch(controller.slice(controller.indexOf('static resolveDeferredCrossPeriodRepoResolution'),
    controller.indexOf('static authorizeEmploymentReviewHistoricalReconstruction')), /AtomicWriter|ProdhlomenaOrariaModel\.update|FrozenSnapshotModel\.update/);
console.log('deferred cross-period controller contracts passed');
