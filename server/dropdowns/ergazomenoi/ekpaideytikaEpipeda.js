const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { EkpaideytikoEpipedoModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/ekpaideytiko_epipedo',
    model: EkpaideytikoEpipedoModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};