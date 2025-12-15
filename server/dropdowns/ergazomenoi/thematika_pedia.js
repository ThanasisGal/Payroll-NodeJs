const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { ThematikaPediaModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/thematiko_pedio',
    model: ThematikaPediaModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};