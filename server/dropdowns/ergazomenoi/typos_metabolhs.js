// /server/ergazomenoi/dropdowns/foreas_epikoyrikhs_asfalishs.js

const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { TypoiMetabolonModelModel } = statheraArxeiaModel;

module.exports = {
    path: 'api/dropdown/ergazomenoi/typos_metabolhs',
    model: TypoiMetabolonModelModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 }
    }
};
