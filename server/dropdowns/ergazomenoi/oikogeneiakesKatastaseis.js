const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { OikogeneiakhKatastashModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/oikogeneiakh_katastash',
    model: OikogeneiakhKatastashModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};