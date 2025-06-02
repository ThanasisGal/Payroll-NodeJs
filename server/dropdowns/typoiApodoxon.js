const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  Typoi_ApodoxonModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/tmhmata',
  model: Typoi_ApodoxonModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    // extraQueryBuilder: (query) => ({
    //   xrhsh: query.xrhsh || new Date().getFullYear().toString()
    // }),
  }
};
