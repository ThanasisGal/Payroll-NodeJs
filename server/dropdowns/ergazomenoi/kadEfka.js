const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { KpkEfkaModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/kad_efka',
    model: KpkEfkaModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};