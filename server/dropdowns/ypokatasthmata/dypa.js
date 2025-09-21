const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { DypaModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ypokatasthmata/dypa',
    model: DypaModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};