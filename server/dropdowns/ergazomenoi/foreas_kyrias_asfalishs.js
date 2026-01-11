// /server/ergazomenoi/dropdowns/foreas_kyrias_asfalishs.js

const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { ForeasKyriasAsfalishsModel } = statheraArxeiaModel;

module. exports = {
    path: '/api/dropdown/ergazomenoi/foreas_kyrias_asfalishs',
    model: ForeasKyriasAsfalishsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};