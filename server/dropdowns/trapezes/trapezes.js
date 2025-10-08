const statheraArxeiaModel = require('../../models/stathera_arxeia');

const {
  BanksModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/trapezes/trapeza',
  model: BanksModel,
  options: {
    searchFields: ['kodikos_dias', 'perigrafh'],
    sort: { perigrafh: 1 },
  }
};
