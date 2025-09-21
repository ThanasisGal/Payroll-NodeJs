const statheraArxeiaModel = require('../../models/stathera_arxeia');

const {
    PararthmataEfkaModel
} = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ypokatasthmata/pararthmataEfkaErgolaboy',
    model: PararthmataEfkaModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};
