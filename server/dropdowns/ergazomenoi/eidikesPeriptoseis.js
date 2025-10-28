const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { EidikesPeriptoseisModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/eidikh_periptosh',
    model: EidikesPeriptoseisModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};