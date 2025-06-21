const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  DoyModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/doy',
  model: DoyModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { perigrafh: 1 },
  }
};
