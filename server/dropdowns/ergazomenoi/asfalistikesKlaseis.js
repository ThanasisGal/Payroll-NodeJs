const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { AsfalistikesKlaseisModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/asfalistikh_klash',
    model: AsfalistikesKlaseisModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};
