'use strict';
const { ARRANGEMENT_TYPES } = require('./employmentProfileContract');
const { KathgoriesAdeiasModel } = require('../../models/stathera_arxeia');
const { buildHrSelectableLeaveCategoryQuery } = require('../../services/ergazomenoi/apasxoliseisHrLeaveCategoryPolicyService');
const labels = {
    APPROVED_LEAVE_INTERRUPTION: 'Εγκεκριμένη Άδεια / Ωροάδεια',
    APPROVED_TIME_SHIFT_INTERRUPTION: 'Διακοπή με Αναπλήρωση Χρόνου',
    OTHER_APPROVED_ARRANGEMENT: 'Άλλη Εγκεκριμένη Ρύθμιση'
};
// GET/render only. Identifiers come from the foundation contract; no policy activation.
async function getEmploymentProfileUiContext(model = KathgoriesAdeiasModel) {
    const categories = await model.find(buildHrSelectableLeaveCategoryQuery()).select('kodikos perigrafh').sort({ aa: 1 }).lean();
    return {
        types: Object.keys(ARRANGEMENT_TYPES).map(value => ({ value, label: labels[value],
            usesLeaveCategory: value === 'APPROVED_LEAVE_INTERRUPTION' })),
        categories
    };
}
module.exports = { getEmploymentProfileUiContext };
