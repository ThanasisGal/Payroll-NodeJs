'use strict';

const assert = require('node:assert/strict');
const dropdown = require('./kathgoria_adeias');

assert.deepEqual(dropdown.options.searchFields, ['kodikos', 'perigrafh']);
assert.deepEqual(dropdown.options.extraQueryBuilder(), {
    $nor: [
        { kodikos: 'POSSIBLE_LEAVE' },
        { perigrafh: /^\s*ΠΙΘΑΝΗ ΑΔΕΙΑ\s*$/i }
    ]
});

console.log('leave category dropdown exclusion tests passed');
