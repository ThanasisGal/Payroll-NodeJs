const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { IdiothtesModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/nomimoiEkprosopoi/idiothta',
    model: IdiothtesModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};