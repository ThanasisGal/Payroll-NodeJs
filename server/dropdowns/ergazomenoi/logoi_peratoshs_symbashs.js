const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { LogoiPeraioshshModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/logos_peratoshs',
    model: LogoiPeraioshshModel,
    options: {
        searchFields: ['kodikos', 'perigrafh']
    }
};
