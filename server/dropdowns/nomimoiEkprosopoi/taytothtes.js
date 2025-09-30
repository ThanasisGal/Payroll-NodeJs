const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { TypoiTaytothtonModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/nomimoiEkprosopoi/taytothta',
    model: TypoiTaytothtonModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};