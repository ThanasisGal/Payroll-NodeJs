const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  TameiaModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/tameia',
  model: TameiaModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 },
  }
};
