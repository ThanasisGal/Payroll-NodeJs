'use strict';

const assert = require('node:assert/strict');
const {
    isInternalPossibleLeaveCategory,
    assertHrSelectableLeaveCategory,
    buildHrSelectableLeaveCategoryQuery
} = require('./apasxoliseisHrLeaveCategoryPolicyService');

assert.equal(isInternalPossibleLeaveCategory('POSSIBLE_LEAVE'), true);
assert.equal(isInternalPossibleLeaveCategory('', 'ΠΙΘΑΝΗ ΑΔΕΙΑ'), true);
assert.equal(isInternalPossibleLeaveCategory('ΑΔΚΑΝ', 'Κανονική άδεια'), false);
assert.throws(() => assertHrSelectableLeaveCategory('POSSIBLE_LEAVE'), (error) =>
    error.code === 'POSSIBLE_LEAVE_NOT_HR_SELECTABLE' && error.statusCode === 400);
assert.doesNotThrow(() => assertHrSelectableLeaveCategory('ΑΔΚΑΝ'));
assert.doesNotThrow(() => assertHrSelectableLeaveCategory('ΑΔΑΣ'));
assert.deepEqual(buildHrSelectableLeaveCategoryQuery(), {
    $nor: [
        { kodikos: 'POSSIBLE_LEAVE' },
        { perigrafh: /^\s*ΠΙΘΑΝΗ ΑΔΕΙΑ\s*$/i }
    ]
});

console.log('HR-selectable leave category policy tests passed');
