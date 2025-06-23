const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  DoyModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/logistes',
  model: DoyModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 },
  }
};
