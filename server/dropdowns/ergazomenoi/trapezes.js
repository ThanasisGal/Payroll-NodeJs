const statheraArxeiaModel = require('../../models/companies');

const { BanksPerCompanyModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/trapeza',
    model: BanksPerCompanyModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },
    }
};