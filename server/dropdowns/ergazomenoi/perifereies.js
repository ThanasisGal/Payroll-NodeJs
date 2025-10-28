const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { PerifereiesModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/perifereia',
    model: PerifereiesModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};