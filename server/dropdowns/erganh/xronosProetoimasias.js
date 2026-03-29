const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { XronosProetoimasiasModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/xronosProetoimasias',
    model: XronosProetoimasiasModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 }
    }
};
