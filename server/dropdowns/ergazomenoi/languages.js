const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { LanguagesModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/language',
    model: LanguagesModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};