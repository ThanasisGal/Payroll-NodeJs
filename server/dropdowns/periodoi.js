const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  PeriodsModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/periodoi',
  model: PeriodsModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikosSort: 1 },
    extraQueryBuilder: (query) => ({
      xrhsh: query.xrhsh || new Date().getFullYear().toString()
    }),
  }
};
