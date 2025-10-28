const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { EidikesKathgoriesModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/eidikh_kathgoria',
    model: EidikesKathgoriesModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};