const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { SyggenikesSxeseisModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/syggenikh_sxesh',
    model: SyggenikesSxeseisModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};