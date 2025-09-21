const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { SepeModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ypokatasthmata/sepe',
    model: SepeModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};