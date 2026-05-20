const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { ProorhApoxorhshModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/proorhApoxorhsh',
    model: ProorhApoxorhshModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 }
    }
};
