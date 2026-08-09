const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const calculation = controller.slice(
    controller.indexOf('function checkRepoAdeiaAstheneiaApologistika'),
    controller.indexOf('function canReviewEdit')
);

assert.match(calculation, /update\.adeia_apologistika = false;[\s\S]*update\.kathgoria_adeias_apologistika = 'POSSIBLE_LEAVE'/);
assert.doesNotMatch(calculation, /kathgoria_adeias_apologistika = 'ΑΔΑΛ'/);
assert.match(calculation, /hasAuthoritativeLeave[\s\S]*update\.adeia_apologistika = true/);
assert.match(ui, /Κατάσταση:<\/strong> ΠΙΘΑΝΗ ΑΔΕΙΑ/);
assert.match(ui, /adeia_apologistika: false/);
assert.match(ui, /data-api="\/api\/dropdown\/ergazomenoi\/kathgoria_adeias"/);
assert.match(ui, /\? 'POSSIBLE_LEAVE' : ''/);
assert.ok(!(controller + ui).includes(['review', 'classification', 'apologistika'].join('_')));
const calc = controller.slice(controller.indexOf('static calcApasxolhseisPeriodoy = async'),
    controller.indexOf('static getCalcApasxolhseisPeriodoyProgress'));
assert.match(calc, /runPossibleLeaveRepoAutoRuntime\(/);
assert.strictEqual((calc.match(/listActiveReusablePolicyDecisionRecords\(/g) || []).length, 1);
assert.match(calc, /applyWeeklyRepoTransfer\([\s\S]*authorizationMetadata/);
assert.match(calc, /fencePeriodCalculationForWrite/);
assert.match(ui, /Αυτόματη μεταφορά ρεπό/);
assert.match(ui, /Βάσει παλαιότερης έγκρισης HR/);
assert.match(ui, /automaticReusable \? '' : applyAction/);
console.log('PASS possible-leave v2 persistence, runtime and catalog UI contract (15 tests)');
