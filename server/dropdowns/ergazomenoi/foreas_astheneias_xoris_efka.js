const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { ForeasAstheneiasXorisEfkaModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/astheneia_xoris_efka',
    model: ForeasAstheneiasXorisEfkaModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
    }
};