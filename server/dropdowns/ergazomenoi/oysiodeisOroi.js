// /server/ergazomenoi/dropdowns/foreas_kyrias_asfalishs.js

const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { ApodoxhOysiodonOronModel } = statheraArxeiaModel;

module. exports = {
    path: '/api/dropdown/ergazomenoi/oysiodeis_oroi',
    model: ApodoxhOysiodonOronModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};