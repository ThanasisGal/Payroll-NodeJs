const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { ForeisEkpaideyshsModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/foreis_katartishs',
    model: ForeisEkpaideyshsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};