const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { TheseisEythynhsModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/thesh_eythynhs',
    model: TheseisEythynhsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};