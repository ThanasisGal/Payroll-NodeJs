const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { SxeseisErgasiasModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/sxesh_ergasias',
    model: SxeseisErgasiasModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};