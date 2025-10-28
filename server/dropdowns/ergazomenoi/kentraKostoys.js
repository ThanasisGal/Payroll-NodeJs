const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { KentraKostoysModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/kad_efka',
    model: KentraKostoysModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};