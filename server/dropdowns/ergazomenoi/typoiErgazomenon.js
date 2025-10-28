const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { TypoiErgazomenonModel } = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/ergazomenoi/typos_ergazomenon',
  model: TypoiErgazomenonModel,
  options: {
    searchFields: ['kodikos', 'perigrafh', 'aa_taxinomhshs'],
    sort: { aa_taxinomhshs: 1, perigrafh: 1 },
  }
};
