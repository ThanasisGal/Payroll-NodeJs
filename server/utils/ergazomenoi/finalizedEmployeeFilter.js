'use strict';
const mongoose = require('mongoose');

// Opt-in at operational reads only. HR lists, Add and Maintenance keep drafts.
// $ne:false also includes legacy documents with no finalization field.
function finalizedEmployeeFilter(filter = {}) {
    return { ...filter, oristikh_enhmerosh: mongoose.trusted({ $ne: false }) };
}
module.exports = { finalizedEmployeeFilter };
