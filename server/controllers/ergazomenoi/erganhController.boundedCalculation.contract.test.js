'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const frontend = fs.readFileSync(path.join(root,
    'public/js/ergazomenoi/programmata/calcApasxolhseisPeriodoy.js'), 'utf8');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/calcApasxolhseisPeriodoy.ejs'), 'utf8');
const calculation = controller.slice(controller.indexOf('static calcApasxolhseisPeriodoy = async'),
    controller.indexOf('static getWeeklyHrWorkflowStage1'));
const postCheck = controller.slice(controller.indexOf('async function runWeeklyRepoPostCheck({'),
    controller.indexOf('async function loadWeeklyRepoTransferApiContext'));

assert.match(view, /for="kodikos"[^>]*>[\s\S]*Κωδικός/);
assert.match(view, /id="kodikos"/);
assert.match(frontend, /rawKodikos[\s\S]*padStart\(4, '0'\)/);
assert.match(frontend, /body: JSON\.stringify\(\{[\s\S]*kodikos,[\s\S]*historical_reconstruction_request_id/);
assert.match(frontend, /period-control\/historical-reconstruction\/authorize/);

assert.match(calculation, /employeeCode: scopedEmployeeCode/);
assert.match(calculation, /const calculationPeriodState = await getPeriodControl\(\{ scope: periodControlScope \}\)/);
assert.match(calculation, /assertHistoricalCalculationPeriodWide\(\{[\s\S]*employeeCode: scopedEmployeeCode/);
assert.ok(calculation.indexOf('assertHistoricalCalculationPeriodWide({') <
    calculation.indexOf('acquirePeriodCalculationOwnership({'));
assert.match(calculation, /if \(calculationOwnership\.historical\) \{[\s\S]*completeHistoricalReconstruction\(\{ scope: periodControlScope/);
assert.match(calculation, /if \(scopedEmployeeCode\) employeeQuery\.kodikos = scopedEmployeeCode/);
assert.match(calculation, /selectedEmployeeCode: scopedEmployeeCode/);
assert.match(calculation, /fullNaturalWeekContext: calculationOwnership\.historical === true/);
assert.match(calculation, /periodEnd: calculationOwnership\.historical === true[\s\S]*endOfWeekSundayUtc\(eosDate\)/);
assert.match(postCheck, /analysisEnd = fullNaturalWeekContext \? endOfWeekSundayUtc\(periodEnd\) : periodEnd/);
assert.match(postCheck, /if \(selectedEmployeeCode\) employeeQuery\.kodikos = selectedEmployeeCode/);
assert.match(postCheck, /hmeromhnia: mongoose\.trusted\(\{[\s\S]*\$gte: analysisStart,[\s\S]*\$lte: analysisEnd/);

// The daily calculation and automatic write candidate filters stay inside the requested
// payroll period; cross-month rows exist only in the post-check analysis query.
assert.match(calculation, /const prodhlomenaQuery = \{[\s\S]*\$gte: calculationStartDate,[\s\S]*\$lte: eosDate/);
assert.match(calculation, /const autoFilter = \{[\s\S]*\$gte: apoDate, \$lte: eosDate/);
assert.match(calculation, /if \(scopedEmployeeCode\) autoFilter\.kodikos = scopedEmployeeCode/);
assert.doesNotMatch(calculation, /autoRangeEnd/);

console.log('bounded calculation and cross-month read/write partition contracts: PASS');
