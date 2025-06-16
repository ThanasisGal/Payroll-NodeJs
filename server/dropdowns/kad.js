const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  KadModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/kad',
  model: KadModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 },
  }
};
