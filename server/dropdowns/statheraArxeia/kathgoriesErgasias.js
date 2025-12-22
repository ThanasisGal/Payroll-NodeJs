const statheraArxeiaModel = require('../../models/stathera_arxeia');

const {
  KathgoriesErgasiasModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/ergazomenoi/kathgoria_ergasias',
  model: KathgoriesErgasiasModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
  }
};
