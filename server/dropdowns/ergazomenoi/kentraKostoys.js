const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { KentraKostoysModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/kentro_kostoys',
    model: KentraKostoysModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 }
    }
};
