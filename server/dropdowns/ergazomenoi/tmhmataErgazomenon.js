const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { TmhmataModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/tmhma',
    model: TmhmataModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};