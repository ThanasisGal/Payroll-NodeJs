const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { TypoiDaneismoyModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/typos_daneismoy',
    model: TypoiDaneismoyModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};