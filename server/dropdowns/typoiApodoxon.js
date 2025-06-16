const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  Typoi_ApodoxonModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/typoiApodoxon',
  model: Typoi_ApodoxonModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 }
    // extraQueryBuilder: (query) => ({
    //   xrhsh: query.xrhsh || new Date().getFullYear().toString()
    // }),
  }
};
