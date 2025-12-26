// /server/ergazomenoi/dropdowns/foreas_epikoyrikhs_xoris_efka.js

const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { ForeasEpikoyrikhsXorisEfkaModel } = statheraArxeiaModel;

module. exports = {
    path: '/api/dropdown/ergazomenoi/epikoyrikh_xoris_efka',
    model: ForeasEpikoyrikhsXorisEfkaModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};