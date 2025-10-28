const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { KathestosApasxolhshsModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/kathestos_apasxolhshs',
    model: KathestosApasxolhshsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};