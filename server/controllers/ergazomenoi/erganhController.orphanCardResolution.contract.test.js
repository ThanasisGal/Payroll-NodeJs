'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const model = fs.readFileSync(path.join(__dirname, '../../models/ergazomenoi.js'), 'utf8');

assert.match(model, /orphan_card_resolution:\s*\{\s*type:\s*Schema\.Types\.Mixed/);
assert.match(controller, /resolveOrphanCardResolution\(\{/);
assert.match(controller, /riskAcknowledged:\s*orphanResolutionCommand\.risk_acknowledged === true/);
assert.match(controller, /ORPHAN_REST_RISK_ACKNOWLEDGEMENT_REQUIRED/);
assert.match(controller, /raw_cards_preserved:\s*true/);
assert.match(controller, /reusable_decision_rule:\s*[\s\S]*approvedOrphanResolution\.reusableDecisionRule/);
assert.match(controller, /runWithStaleOrphanResolutionWriteFence/);
assert.match(controller, /buildStaleOrphanResolutionWriteSet\(\{/);
assert.match(controller, /buildApprovedOrphanDailyDerivedUpdate\(\{/);
assert.match(controller, /Object\.assign\(cleanUpdates, dailyDerived\.derivedUpdate\)/);
assert.match(controller, /ORPHAN_DAILY_DERIVED_FIELDS/);
assert.doesNotMatch(controller,
    /Object\.assign\(cleanUpdates,\s*orphanResolutionCommand\.(?:derived|compensation)/);
assert.match(controller, /rowFilter\.updatedAt\s*=\s*oldRecord\.updatedAt/);
assert.match(controller, /createOrphanReusablePolicyDecisionRecord\(\{/);
assert.match(controller, /previewProdhlomenaOrariaOrphanResolution/);
const reviewHandler = controller.slice(
    controller.indexOf('static getProdhlomenaOrariaForReview'),
    controller.indexOf('static getApasxoliseisPolicyCatalog')
);
const primaryReviewQuery = reviewHandler.slice(
    reviewHandler.indexOf('const [rows, total, deviationContextRows]'),
    reviewHandler.indexOf('ProdhlomenaOrariaModel.countDocuments(filter)')
);
assert.match(primaryReviewQuery, /orphan_card_resolution/);
assert.doesNotMatch(controller, /approvedUpdates\.cards_(?:apo|eos)_ora/);
assert.match(frontend, /Απόφαση ορφανού χτυπήματος/);
assert.match(frontend, /orphanRestRiskAcknowledged/);
assert.match(frontend, /Μόνο για αυτή την περίπτωση/);
assert.match(frontend, /Και για μελλοντικές ίδιες περιπτώσεις/);
assert.match(frontend, /renderApprovedOrphanAuditBadge\(row\)/);
assert.match(frontend, /orphan_resolution:\s*orphanResolution/);
assert.match(frontend, /orphan-resolution\/preview/);
assert.match(frontend, /bindOrphanResolutionManualPreview/);

console.log('orphan card resolution controller/UI contracts passed');
