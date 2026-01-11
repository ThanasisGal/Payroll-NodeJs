// /server/ergazomenoi/dropdowns/foreas_epikoyrikhs_asfalishs.js

const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { ForeasEpikoyrikhsAsfalishsModel } = statheraArxeiaModel;

module. exports = {
    path: '/api/dropdown/ergazomenoi/foreas_epikoyrikhs_asfalishs',
    model: ForeasEpikoyrikhsAsfalishsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};