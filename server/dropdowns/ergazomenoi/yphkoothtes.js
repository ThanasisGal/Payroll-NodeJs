const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { YphkoothtesModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/yphkoothta',
    model: YphkoothtesModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};