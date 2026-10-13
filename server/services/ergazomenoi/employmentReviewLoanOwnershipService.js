'use strict';
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

const LOAN_FIELDS = 'afora_daneismo_ergazomenoy typos_ergodoth_daneismoy hmnia_enarxhs_daneismoy hmnia_lhxhs_daneismoy';

// The dated agreement is evidence only for its own interval. Never infer an
// earlier loan from the current flag, hire date, or profile change date.
function ownsEmploymentReviewDate(value, employee = {}) {
    const date = dateKeyUtc(value);
    if (!date) return false;
    if (employee.afora_daneismo_ergazomenoy !== true) return true;
    const start = dateKeyUtc(employee.hmnia_enarxhs_daneismoy);
    const end = dateKeyUtc(employee.hmnia_lhxhs_daneismoy);
    if (!start || (employee.hmnia_lhxhs_daneismoy && !end) || (end && end < start)) return false;
    const inside = date >= start && (!end || date <= end);
    if (employee.typos_ergodoth_daneismoy === false) return !inside;
    if (employee.typos_ergodoth_daneismoy === true) return inside;
    return false;
}

module.exports = { LOAN_FIELDS, ownsEmploymentReviewDate };
