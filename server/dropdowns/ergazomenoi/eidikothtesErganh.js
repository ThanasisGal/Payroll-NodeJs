const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { EidikothtesErganhModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/eidikothta',
    model: EidikothtesErganhModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};