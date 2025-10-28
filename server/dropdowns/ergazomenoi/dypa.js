const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { DypaModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/dypa',
    model: DypaModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};