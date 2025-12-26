const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { IdiothtaErgoy39Par9Model } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/idiothta_sto_ergo_39',
    model: IdiothtaErgoy39Par9Model,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};