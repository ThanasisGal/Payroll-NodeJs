const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { ApasxolhseisBaseiSymbashsModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/apasxolhsh_basei_symbashs',
    model: ApasxolhseisBaseiSymbashsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};