const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { EidikothtesEfarmoghsModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/eidikothta',
    model: EidikothtesEfarmoghsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};