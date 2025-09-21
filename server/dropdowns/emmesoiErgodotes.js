const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  NomikesMorfesModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/emmesosErgodoths',
  model: NomikesMorfesModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { perigrafh: 1 },
  }
};
