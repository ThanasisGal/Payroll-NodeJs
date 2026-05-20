const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { KathgoriesAdeiasModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/kathgoria_ergasias',
    model: KathgoriesAdeiasModel,
    options: {
        searchFields: ['kodikos', 'perigrafh']
    }
};
